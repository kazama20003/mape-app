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

    const setup = async () => {
      try {
        const caps = await ack<any>(socket, 'ms:rtpCapabilities');
        const device = new Device();
        await device.load({ routerRtpCapabilities: caps });
        if (cancelled) return;
        deviceRef.current = device;

        // Transporte de recepción (para escuchar).
        const recvParams = await ack<any>(socket, 'ms:createTransport', {
          direction: 'recv',
        });
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
        if (current?.producerId) await consume(current.producerId);
      } catch {
        /* noop */
      }
    };

    const onNewProducer = (d: { producerId: string }) => void consume(d.producerId);
    const onProducerClosed = () => {
      consumersRef.current.forEach((c) => c.close());
      consumersRef.current.clear();
      setSpeaking(false);
    };

    socket.on('ms:newProducer', onNewProducer);
    socket.on('ms:producerClosed', onProducerClosed);
    void setup();

    return () => {
      cancelled = true;
      socket.off('ms:newProducer', onNewProducer);
      socket.off('ms:producerClosed', onProducerClosed);
      consumersRef.current.forEach((c) => c.close());
      consumersRef.current.clear();
      try {
        recvRef.current?.close();
      } catch {
        /* noop */
      }
      recvRef.current = null;
      deviceRef.current = null;
    };
  }, [token, channelId]);

  const startTalking = useCallback(async () => {
    if (!channelId || !token || talking) return;
    const device = deviceRef.current;
    if (!device) return;
    const socket = getSocket('/radio', token);
    setTalking(true);
    try {
      // Transporte de envío (una vez).
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
