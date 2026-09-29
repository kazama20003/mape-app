import { useCallback, useEffect, useRef, useState } from 'react';
import { Device, type types as msTypes } from 'mediasoup-client';
import { mediaDevices, registerGlobals, type MediaStream } from 'react-native-webrtc';

type Consumer = msTypes.Consumer;
type Producer = msTypes.Producer;
type Transport = msTypes.Transport;

import { useAuth } from '@/features/auth/auth-context';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

// react-native-webrtc expone los objetos WebRTC globales que mediasoup-client usa.
registerGlobals();

const ack = <T = any>(socket: Socket, ev: string, data?: unknown): Promise<T> =>
  new Promise((resolve) => socket.emit(ev, data, resolve));

/**
 * Audio en vivo por SFU (mediasoup). Al HABLAR publica el micrófono; escucha en
 * tiempo real a quien hable en el canal. La GRABACIÓN se hace en el servidor
 * (ffmpeg), así que al soltar la nota queda guardada en el chat (llega por
 * `ptt:ended`, que ya maneja useChannelChat).
 *
 * RESISTENTE A RECONEXIÓN: si la conexión se cae (red móvil, timeout del proxy,
 * suspensión del teléfono…), socket.io reconecta solo y el servidor destruye los
 * transportes de esa sesión. Por eso volvemos a montar TODA la sesión de audio
 * en cada evento `connect`; así la radio se recupera sola en vez de quedar muda.
 */
export function useRadioSfu(channelId: string | undefined, muted: boolean) {
  const { token } = useAuth();
  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const deviceRef = useRef<Device | null>(null);
  const recvRef = useRef<Transport | null>(null);
  const sendRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    if (!token || !channelId) return;
    const socket = getSocket('/radio', token);
    let cancelled = false;
    let settingUp = false;

    const consume = async (producerId: string) => {
      if (mutedRef.current) return;
      const device = deviceRef.current;
      const recv = recvRef.current;
      if (!device || !recv) return;
      try {
        const params = await ack<any>(socket, 'ms:consume', {
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        });
        if (params?.error) return;
        const consumer = await recv.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });
        consumersRef.current.set(consumer.id, consumer);
        await ack(socket, 'ms:resume', { consumerId: consumer.id });
        setSpeaking(true);
      } catch {
        /* noop */
      }
    };

    // Cierra transportes/consumers/producer locales. Se llama antes de re-montar
    // (tras reconexión) y al desmontar: el servidor ya los destruyó de su lado.
    const teardownLocal = () => {
      consumersRef.current.forEach((c) => {
        try {
          c.close();
        } catch {
          /* noop */
        }
      });
      consumersRef.current.clear();
      try {
        producerRef.current?.close();
      } catch {
        /* noop */
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        sendRef.current?.close();
      } catch {
        /* noop */
      }
      try {
        recvRef.current?.close();
      } catch {
        /* noop */
      }
      producerRef.current = null;
      localStreamRef.current = null;
      sendRef.current = null;
      recvRef.current = null;
      deviceRef.current = null;
      setSpeaking(false);
      setTalking(false);
    };

    const setup = async () => {
      if (settingUp) return; // evita montajes solapados si 'connect' se repite
      settingUp = true;
      try {
        // Partimos de cero: al reconectar, los transportes viejos ya no sirven.
        teardownLocal();
        const caps = await ack<any>(socket, 'ms:rtpCapabilities');
        if (cancelled) return;
        const device = new Device();
        await device.load({ routerRtpCapabilities: caps });
        if (cancelled) return;
        deviceRef.current = device;

        // Transporte de recepción (para escuchar).
        const recvParams = await ack<any>(socket, 'ms:createTransport', {
          direction: 'recv',
        });
        if (cancelled) return;
        const recv = device.createRecvTransport(recvParams);
        recv.on('connect', ({ dtlsParameters }, cb, errb) => {
          ack(socket, 'ms:connectTransport', { direction: 'recv', dtlsParameters })
            .then(() => cb())
            .catch(errb);
        });
        recvRef.current = recv;

        socket.emit('channel:join', channelId);
        // Si ya hay alguien hablando, empezar a escucharlo.
        const current = await ack<any>(socket, 'ms:getProducer', { channelId });
        if (cancelled) return;
        if (current?.producerId) await consume(current.producerId);
      } catch {
        /* noop */
      } finally {
        settingUp = false;
      }
    };

    const onNewProducer = (d: { producerId: string }) => void consume(d.producerId);
    const onProducerClosed = () => {
      consumersRef.current.forEach((c) => c.close());
      consumersRef.current.clear();
      setSpeaking(false);
    };
    // Cada (re)conexión vuelve a montar la sesión de audio -> recuperación sola.
    const onConnect = () => void setup();
    // Al caerse: soltamos el estado local muerto (el server ya lo liberó).
    const onDisconnect = () => teardownLocal();

    socket.on('ms:newProducer', onNewProducer);
    socket.on('ms:producerClosed', onProducerClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Si el socket ya estaba conectado (se reutiliza entre pantallas), 'connect'
    // no volverá a dispararse, así que montamos ahora.
    if (socket.connected) void setup();

    return () => {
      cancelled = true;
      socket.off('ms:newProducer', onNewProducer);
      socket.off('ms:producerClosed', onProducerClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      teardownLocal();
    };
  }, [token, channelId]);

  const startTalking = useCallback(async () => {
    if (!channelId || !token || talking) return;
    const device = deviceRef.current;
    if (!device) return;
    const socket = getSocket('/radio', token);
    setTalking(true);
    try {
      // Transporte de envío (una vez por sesión; se recrea tras reconexión).
      if (!sendRef.current) {
        const sendParams = await ack<any>(socket, 'ms:createTransport', {
          direction: 'send',
        });
        const send = device.createSendTransport(sendParams);
        send.on('connect', ({ dtlsParameters }, cb, errb) => {
          ack(socket, 'ms:connectTransport', { direction: 'send', dtlsParameters })
            .then(() => cb())
            .catch(errb);
        });
        send.on('produce', ({ rtpParameters }, cb, errb) => {
          ack<any>(socket, 'ms:produce', { channelId, rtpParameters })
            .then((r) => (r?.id ? cb({ id: r.id }) : errb(new Error('no id'))))
            .catch(errb);
        });
        sendRef.current = send;
      }
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      // react-native-webrtc y mediasoup-client difieren en el tipo del track,
      // pero registerGlobals los hace compatibles en runtime.
      producerRef.current = await sendRef.current.produce({
        track: track as unknown as MediaStreamTrack,
      });
    } catch {
      // Si algo falla, liberar el micrófono: nunca debe quedar abierto sin hablar.
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setTalking(false);
    }
  }, [channelId, token, talking]);

  const stopTalking = useCallback(() => {
    if (!channelId || !token) return;
    const socket = getSocket('/radio', token);
    try {
      producerRef.current?.close();
    } catch {
      /* noop */
    }
    producerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    socket.emit('ms:closeProducer');
    setTalking(false);
  }, [channelId, token]);

  return { talking, speaking, startTalking, stopTalking };
}
