import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
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
import {
  startKeepAliveService,
  stopKeepAliveService,
} from '@/features/radio/keep-alive';
import type { Socket } from 'socket.io-client';

// react-native-webrtc expone los objetos WebRTC globales que mediasoup-client usa.
registerGlobals();

// ack con TIMEOUT: si el socket se cae en medio de una petición, el callback de
// socket.io nunca llega; sin timeout, el `await` se colgaría para siempre y
// bloquearía setup(). Al vencer, resuelve undefined -> la operación falla limpio
// y se puede reintentar en la próxima (re)conexión.
const ack = <T = any>(
  socket: Socket,
  ev: string,
  data?: unknown,
  timeoutMs = 8000,
): Promise<T> =>
  new Promise((resolve) => {
    let done = false;
    const finish = (res: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    };
    const timer = setTimeout(() => finish(undefined as unknown as T), timeoutMs);
    socket.emit(ev, data, finish);
  });

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
export function useRadioSfu(
  channelId: string | undefined,
  muted: boolean,
  speaker = true,
) {
  const { token } = useAuth();
  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [connected, setConnected] = useState(false); // socket vivo (internet)
  const [txFailed, setTxFailed] = useState(false); // la última transmisión falló
  // Salida de audio real en uso, para mostrarla en la UI.
  const [outputDevice, setOutputDevice] = useState<
    'speaker' | 'bluetooth' | 'wired' | 'earpiece'
  >('speaker');

  const deviceRef = useRef<Device | null>(null);
  const recvRef = useRef<Transport | null>(null);
  const sendRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  // ¿El usuario quiere estar transmitiendo AHORA? Sirve para cancelar un
  // produce() en curso si soltó el botón antes de que terminara (evita quedar
  // transmitiendo "huérfano" con la UI en no-transmitiendo).
  const wantsTalkRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  // Dispositivos de salida disponibles (se actualizan por evento de InCallManager).
  const devicesRef = useRef({ bt: false, wired: false });
  // Última ruta REALMENTE aplicada. Evita re-elegir Bluetooth en bucle: cada
  // chooseAudioRoute('BLUETOOTH') reinicia el SCO (corta el audio), y el propio
  // cambio dispara onAudioDeviceChanged -> si re-rutéabamos, era un bucle infinito.
  const lastRouteRef = useRef<string | null>(null);

  // Aplica el ruteo según el botón:
  //  - Altavoz -> parlante del teléfono.
  //  - Normal  -> audífono Bluetooth si hay; si no, audífono con cable; si no,
  //               auricular del teléfono.
  const applyRoute = useCallback(() => {
    try {
      if (speakerRef.current) {
        // Altavoz: re-aplicar es barato (no toca SCO) y corrige el desfase de
        // arranque, así que no deduplicamos.
        InCallManager.setForceSpeakerphoneOn(true);
        void InCallManager.chooseAudioRoute('SPEAKER_PHONE').catch(() => {});
        lastRouteRef.current = 'SPEAKER_PHONE';
        setOutputDevice('speaker');
      } else {
        InCallManager.setForceSpeakerphoneOn(false);
        const desired = devicesRef.current.bt
          ? 'BLUETOOTH'
          : devicesRef.current.wired
            ? 'WIRED_HEADSET'
            : 'EARPIECE';
        // Solo cambiar si el destino cambió: re-elegir la MISMA ruta (sobre todo
        // Bluetooth) reinicia el SCO y produce el corte/lag continuo.
        if (desired === lastRouteRef.current) return;
        lastRouteRef.current = desired;
        void InCallManager.chooseAudioRoute(desired).catch(() => {});
        setOutputDevice(
          desired === 'BLUETOOTH'
            ? 'bluetooth'
            : desired === 'WIRED_HEADSET'
              ? 'wired'
              : 'earpiece',
        );
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!token || !channelId) return;
    const socket = getSocket('/radio', token);
    let cancelled = false;
    let settingUp = false;
    let pendingSetup = false;
    let connectedOnce = socket.connected;

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
      // Si ya hay un montaje en curso, no lo solapamos; marcamos que hace falta
      // re-montar al terminar (p.ej. si llegó una reconexión durante el montaje).
      if (settingUp) {
        pendingSetup = true;
        return;
      }
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
        // Si se pidió re-montar mientras montábamos (reconexión), hacerlo ahora.
        if (pendingSetup && !cancelled) {
          pendingSetup = false;
          void setup();
        }
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
      setConnected(true);
      if (connectedOnce) void setup();
      else connectedOnce = true;
    };
    // Al caerse: soltamos el estado local muerto (el server ya lo liberó).
    const onDisconnect = () => {
      setConnected(false);
      teardownLocal();
    };
    setConnected(socket.connected);

    socket.on('ms:newProducer', onNewProducer);
    socket.on('ms:producerClosed', onProducerClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Monta la sesión de audio SIEMPRE al entrar (los ack se bufferean hasta que
    // el socket conecta). Así el `device` queda listo aunque el socket todavía no
    // haya conectado, y el botón Hablar funciona apenas se abre la pantalla.
    void setup();

    // Vigilante de reconexión. socket.io ya reintenta solo, pero en 2do plano
    // Android espacia mucho los timers y a veces la señal no vuelve hasta que
    // se reabre la app. Mientras el foreground service (keepalive de silencio)
    // mantenga vivo el proceso, forzamos el reintento cada pocos segundos:
    //  - si el socket está caído -> socket.connect() (fuerza reconexión)
    //  - si reconectó pero la sesión de audio no quedó armada -> re-armar
    const ensureAlive = () => {
      if (cancelled) return;
      if (!socket.connected) {
        try {
          socket.connect();
        } catch {
          /* noop */
        }
      } else if (!deviceRef.current && !settingUp) {
        void setup();
      }
    };
    const watchdog = setInterval(ensureAlive, 4000);
    // Al volver al frente, recupera de inmediato (sin esperar el tick).
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') ensureAlive();
    });

    return () => {
      cancelled = true;
      clearInterval(watchdog);
      appSub.remove();
      socket.off('ms:newProducer', onNewProducer);
      socket.off('ms:producerClosed', onProducerClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      teardownLocal();
    };
  }, [token, channelId]);

  // Sesión de audio de comunicación (InCallManager) + keep-alive (silencio en
  // loop para el foreground service). Se inicia UNA sola vez al entrar a la radio
  // y NO se reinicia al cambiar de canal -> el ruteo de audio (altavoz/audífono)
  // ya no se cruza entre canales. Se libera al salir de la radio.
  const radioActive = !!token && !!channelId;
  useEffect(() => {
    if (!radioActive) return;
    // Foreground service nativo (tipo micrófono) para sobrevivir en 2do plano
    // sin tocar el ruteo de audio (ver keep-alive.ts / RadioKeepAliveService.kt).
    startKeepAliveService();
    try {
      InCallManager.start({ media: 'audio' });
    } catch {
      /* noop */
    }
    // Aplica la ruta AHORA y varias veces después: InCallManager.start() resetea
    // la ruta a "auto" con un retardo interno, así que re-aplicamos para que el
    // Altavoz (o Normal) quede fijo desde el inicio (sin el desfase del arranque).
    applyRoute();
    // InCallManager.start() resetea la ruta a "auto" con un retardo interno. Para
    // corregir ese desfase re-aplicamos un par de veces, FORZANDO (reset del
    // dedupe) para que también se re-rutee a Bluetooth si hiciera falta. Solo 2
    // veces para no reiniciar el SCO de más.
    const forceApply = () => {
      lastRouteRef.current = null;
      applyRoute();
    };
    const routeTimers = [800, 2000].map((ms) => setTimeout(forceApply, ms));
    // Cuando cambian los dispositivos disponibles (conectas/desconectas el
    // audífono Bluetooth o el cable), re-aplicamos la ruta. IMPORTANTE: solo si
    // la lista de disponibles CAMBIÓ. InCallManager dispara este evento también
    // en cada cambio de estado del SCO (CONNECTED/AVAILABLE); si re-rutéabamos
    // ahí, chooseAudioRoute reiniciaba el SCO y se realimentaba en bucle -> lag.
    const deviceSub = DeviceEventEmitter.addListener(
      'onAudioDeviceChanged',
      (d: { availableAudioDeviceList?: string }) => {
        try {
          const list: string[] = d?.availableAudioDeviceList
            ? JSON.parse(d.availableAudioDeviceList)
            : [];
          const bt = list.includes('BLUETOOTH');
          const wired = list.includes('WIRED_HEADSET');
          if (bt === devicesRef.current.bt && wired === devicesRef.current.wired) {
            return; // sin cambios de dispositivos -> no re-rutear (evita bucle SCO)
          }
          devicesRef.current = { bt, wired };
        } catch {
          /* noop */
        }
        applyRoute();
      },
    );
    void (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        });
      } catch {
        /* noop */
      }
    })();
    // NOTA: ya NO usamos un reproductor de silencio como keepalive. Reproducir
    // audio (aunque sea a volumen 0) usa el stream de música y en Bluetooth
    // fuerza A2DP, que choca con la voz por SCO (lag/cortes). El proceso se
    // mantiene vivo en 2do plano con el foreground service nativo tipo micrófono
    // (startKeepAliveService), que NO toca el ruteo de audio.
    return () => {
      routeTimers.forEach(clearTimeout);
      deviceSub.remove();
      stopKeepAliveService();
      try {
        InCallManager.setForceSpeakerphoneOn(false);
        InCallManager.stop();
      } catch {
        /* noop */
      }
    };
  }, [radioActive, applyRoute]);

  // Re-aplica la ruta cuando el usuario cambia Altavoz/Normal.
  useEffect(() => {
    if (radioActive) applyRoute();
  }, [speaker, radioActive, applyRoute]);

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
    wantsTalkRef.current = true;
    setTxFailed(false);
    // Pitido en paralelo; el envío ya está PRE-ARMADO, así que transmitir es
    // instantáneo (no se abre el micrófono en este momento -> 0 desfase).
    playStartBeep();

    // Si el usuario soltó mientras se creaba el productor, se cierra (huérfano).
    const commit = (producer: Producer) => {
      if (!wantsTalkRef.current) {
        try {
          producer.close();
        } catch {
          /* noop */
        }
        socket.emit('ms:closeProducer'); // que el backend también lo cierre
        return;
      }
      producerRef.current = producer;
    };

    // Intenta transmitir: asegura transporte de envío + micrófono y produce.
    const attempt = async () => {
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
      // stopTracks:false -> no detener el mic pre-armado al cerrar el productor.
      return await sendRef.current.produce({
        track: track as unknown as MediaStreamTrack,
        stopTracks: false,
      });
    };

    try {
      commit(await attempt());
    } catch {
      // REINTENTO: el transporte de envío pudo quedar en mal estado (típico tras
      // una reconexión). Lo reconstruimos y volvemos a intentar una vez, así no
      // se queda en "pitido pero sin transmisión".
      try {
        sendRef.current?.close();
      } catch {
        /* noop */
      }
      sendRef.current = null;
      try {
        commit(await attempt());
      } catch {
        producerRef.current = null;
        setTalking(false);
        setTxFailed(true); // no se pudo transmitir (se avisa en pantalla)
      }
    }
  }, [channelId, token, talking]);

  const stopTalking = useCallback(() => {
    if (!channelId || !token) return;
    wantsTalkRef.current = false; // cancela un produce() que siga en curso
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

  return {
    talking,
    speaking,
    startTalking,
    stopTalking,
    connected,
    txFailed,
    outputDevice,
  };
}
