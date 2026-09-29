import { useCallback, useEffect, useRef, useState } from 'react';
import { setAudioModeAsync } from 'expo-audio';
import InCallManager from 'react-native-incall-manager';
import { Device, type types as msTypes } from 'mediasoup-client';
import { mediaDevices, registerGlobals, type MediaStream } from 'react-native-webrtc';

type Consumer = msTypes.Consumer;
type Producer = msTypes.Producer;
type Transport = msTypes.Transport;

import { useAuth } from '@/features/auth/auth-context';
import { getSocket } from '@/lib/socket';
import { playEndBeep, playStartBeep } from '@/features/radio/beeps';
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
    let connectedOnce = socket.connected;

    // Sesión de audio de comunicación (volumen propio de la app, sin tocar el
    // volumen multimedia del sistema) que sigue viva con la pantalla apagada /
    // en segundo plano y no se cae en llamadas. El ruteo (altavoz vs auricular/
    // audífonos) lo controla el toggle de la pantalla de radio.
    try {
      InCallManager.start({ media: 'audio' });
    } catch {
      /* noop */
    }

    const consume = async (producerId: string) => {
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
        // Si el canal está en silencio, se pausa la reproducción localmente.
        if (mutedRef.current) {
          try {
            consumer.pause();
          } catch {
            /* noop */
          }
        }
        setSpeaking(true);
        if (!mutedRef.current) playStartBeep(); // señal: alguien empezó a hablar
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
        // Audio en 2.º plano: la radio sigue sonando con la pantalla apagada y
        // "duckea" (baja) en vez de cortarse cuando entra otra fuente / llamada.
        try {
          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'duckOthers',
            shouldRouteThroughEarpiece: false,
          });
        } catch {
          /* noop */
        }
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

        // PRE-ARMAR el envío: transporte de salida + micrófono listos desde ya,
        // para que al presionar HABLAR se transmita AL INSTANTE (0 desfase). El
        // micrófono queda abierto solo mientras estás en la vista de radio; se
        // libera al salir (teardownLocal).
        try {
          const sendParams = await ack<any>(socket, 'ms:createTransport', {
            direction: 'send',
          });
          if (cancelled) return;
          const send = device.createSendTransport(sendParams);
          send.on('connect', ({ dtlsParameters }, cb, errb) => {
            ack(socket, 'ms:connectTransport', { direction: 'send', dtlsParameters })
              .then(() => cb())
              .catch(errb);
          });
          send.on('produce', ({ rtpParameters }, cb, errb) => {
            ack<any>(socket, 'ms:produce', { channelId, rtpParameters })
              .then((r) =>
                r?.id ? cb({ id: r.id }) : errb(new Error(r?.error ?? 'no id')),
              )
              .catch(errb);
          });
          sendRef.current = send;
          const stream = await mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = stream;
        } catch {
          // sin permiso de micrófono: se intentará abrir al presionar HABLAR
        }
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
      if (!mutedRef.current) playEndBeep(); // señal: el otro terminó (canal libre)
    };
    // La primera conexión ya la monta el setup() inicial de abajo; solo volvemos
    // a montar en las RE-conexiones, para recuperar el audio tras un corte.
    const onConnect = () => {
      if (connectedOnce) void setup();
      else connectedOnce = true;
    };
    // Al caerse: soltamos el estado local muerto (el server ya lo liberó).
    const onDisconnect = () => teardownLocal();

    socket.on('ms:newProducer', onNewProducer);
    socket.on('ms:producerClosed', onProducerClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Monta la sesión de audio SIEMPRE al entrar (los ack se bufferean hasta que
    // el socket conecta). Así el `device` queda listo aunque el socket todavía no
    // haya conectado, y el botón Hablar funciona apenas se abre la pantalla.
    void setup();

    return () => {
      cancelled = true;
      socket.off('ms:newProducer', onNewProducer);
      socket.off('ms:producerClosed', onProducerClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      teardownLocal();
      try {
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.stop();
      } catch {
        /* noop */
      }
    };
  }, [token, channelId]);

  // Silencio (mute): pausa/reanuda la reproducción de los consumers en curso,
  // sin desconectar. Así el botón de silencio afecta al audio que ya está sonando.
  useEffect(() => {
    consumersRef.current.forEach((c) => {
      try {
        if (muted) c.pause();
        else c.resume();
      } catch {
        /* noop */
      }
    });
  }, [muted]);

  const startTalking = useCallback(async () => {
    if (!channelId || !token || talking) return;
    const device = deviceRef.current;
    if (!device) return;
    const socket = getSocket('/radio', token);
    setTalking(true);
    // Pitido en paralelo; el envío ya está PRE-ARMADO, así que transmitir es
    // instantáneo (no se abre el micrófono en este momento -> 0 desfase).
    playStartBeep();
    try {
      // Fallback por si el pre-armado no alcanzó a montarse (o falló el permiso).
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
            .then((r) =>
              r?.id ? cb({ id: r.id }) : errb(new Error(r?.error ?? 'no id')),
            )
            .catch(errb);
        });
        sendRef.current = send;
      }
      if (!localStreamRef.current) {
        localStreamRef.current = await mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
      const track = localStreamRef.current.getAudioTracks()[0];
      // react-native-webrtc y mediasoup-client difieren en el tipo del track,
      // pero registerGlobals los hace compatibles en runtime.
      producerRef.current = await sendRef.current.produce({
        track: track as unknown as MediaStreamTrack,
        // CLAVE: no detener el track al cerrar el productor. Así el micrófono
        // pre-armado sigue vivo y se puede volver a hablar (sin esto, la 2.ª vez
        // el track esta muerto y no transmite).
        stopTracks: false,
      });
    } catch {
      // Falló (canal ocupado / sin permiso): no transmitimos. El track pre-armado
      // se mantiene listo; solo cerramos el productor a medias.
      try {
        producerRef.current?.close();
      } catch {
        /* noop */
      }
      producerRef.current = null;
      setTalking(false);
    }
  }, [channelId, token, talking]);

  const stopTalking = useCallback(() => {
    if (!channelId || !token) return;
    const socket = getSocket('/radio', token);
    playEndBeep(); // señal "roger": terminaste de hablar
    try {
      producerRef.current?.close();
    } catch {
      /* noop */
    }
    producerRef.current = null;
    // NO detenemos el track: el micrófono queda PRE-ARMADO para volver a hablar
    // al instante. Se libera al salir de la vista de radio (teardownLocal).
    socket.emit('ms:closeProducer');
    setTalking(false);
  }, [channelId, token]);

  return { talking, speaking, startTalking, stopTalking };
}
