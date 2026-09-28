import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import {
  cacheDirectory,
  EncodingType,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { useSettings } from '@/features/settings/settings-context';
import { api, mediaUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface SpeakingUser {
  id: string;
  name?: string;
  nickname?: string | null;
  email?: string;
}

/** Nombre a mostrar: apelativo (indicativo de radio) si existe, si no el nombre. */
function radioName(u?: { name?: string; nickname?: string | null } | null): string {
  return u?.nickname || u?.name || 'Operador';
}

export interface RadioTransmission {
  id: string;
  senderName: string;
  durationSec: number;
  at: string;
  audioKey?: string | null;
  imageKey?: string | null;
  mine?: boolean;
}

let rxCounter = 0;

/**
 * Opciones de grabación para radio/PTT: fuente `voice_communication` (activa la
 * cancelación de eco por hardware y el control de ganancia en Android), mono y
 * bitrate moderado (voz clara, clip liviano y baja latencia).
 */
const RADIO_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    audioSource: 'voice_communication' as const,
  },
};

/**
 * Push-to-talk por internet: graba al mantener presionado, envía el clip por
 * el WebSocket del canal y reproduce automáticamente los que llegan.
 */
export function useRadio(channelId: string | undefined) {
  const { token, user } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();
  // Grabación con cancelación de eco (voice_communication) para radio.
  const recorder = useAudioRecorder(RADIO_RECORDING);

  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState<SpeakingUser | null>(null);
  const [history, setHistory] = useState<RadioTransmission[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const startedAtRef = useRef<number>(0);
  const rxPlayerRef = useRef<AudioPlayer | null>(null);
  const permissionRef = useRef<boolean | null>(null);
  const recordingRef = useRef(false);
  const armedRef = useRef(false);
  const keepAliveRef = useRef<AudioPlayer | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Conexión al canal + listeners
  useEffect(() => {
    if (!token || !channelId) return;
    const socket = getSocket('/radio', token);
    socket.emit('channel:join', channelId);

    const onSpeaking = (data: { channelId: string; user: SpeakingUser }) => {
      if (data.channelId !== channelId) return;
      setSpeaking(data.user);
    };

    const onAudio = async (data: {
      channelId: string;
      chunk: string;
      mime?: string;
      senderId?: string;
      sender?: SpeakingUser;
    }) => {
      if (data.channelId !== channelId) return;
      // Nunca reproducir el propio clip (evita eco de escucharte a ti mismo).
      if (data.senderId && data.senderId === user?.id) return;
      if (!mutedRef.current) await playClip(data.chunk); // altavoz apagado = no reproduce
      // el "hablando ahora" se apaga poco después de recibir el clip
      setTimeout(() => setSpeaking(null), 400);
    };

    type RawTx = {
      id: string;
      durationSec?: number;
      senderId?: string;
      sender?: { name?: string; nickname?: string | null };
      createdAt: string;
      audioKey?: string | null;
      imageKey?: string | null;
    };
    const addToHistory = (t: RawTx) => {
      setHistory((prev) => {
        if (prev.some((h) => h.id === t.id)) return prev; // sin duplicados
        return [
          {
            id: t.id,
            senderName: radioName(t.sender),
            durationSec: t.durationSec ?? 0,
            at: t.createdAt,
            audioKey: t.audioKey ?? null,
            imageKey: t.imageKey ?? null,
            mine: t.senderId === user?.id,
          },
          ...prev,
        ].slice(0, 50);
      });
    };

    const onEnded = (data: { channelId: string; transmission?: RawTx }) => {
      if (data.channelId !== channelId) return;
      if (data.transmission) addToHistory(data.transmission);
      setSpeaking(null);
    };

    // Nueva imagen compartida en el canal.
    const onPost = (data: { channelId: string; transmission?: RawTx }) => {
      if (data.channelId !== channelId) return;
      if (data.transmission) addToHistory(data.transmission);
    };

    // Tras una interrupción (llamada entrante, red caída, app suspendida) el
    // socket se reconecta solo; al reconectar hay que volver a unirse al canal.
    const onConnect = () => socket.emit('channel:join', channelId);

    socket.on('connect', onConnect);
    socket.on('ptt:speaking', onSpeaking);
    socket.on('ptt:audio', onAudio);
    socket.on('ptt:ended', onEnded);
    socket.on('channel:post', onPost);

    return () => {
      socket.emit('channel:leave', channelId);
      socket.off('connect', onConnect);
      socket.off('ptt:speaking', onSpeaking);
      socket.off('ptt:audio', onAudio);
      socket.off('ptt:ended', onEnded);
      socket.off('channel:post', onPost);
    };
  }, [token, channelId]);

  // FOREGROUND SERVICE (Android): un audio silencioso en bucle con
  // `shouldPlayInBackground` mantiene un servicio de reproducción en primer
  // plano, así el proceso y el socket siguen vivos y la radio NO se corta en
  // segundo plano. Se activa mientras estás conectado a un canal.
  useEffect(() => {
    if (!token || !channelId) return;
    let player: AudioPlayer | null = null;
    (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: true,
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        player = createAudioPlayer(require('../../../assets/silence.wav'));
        player.loop = true;
        player.volume = 0;
        player.play();
        keepAliveRef.current = player;
      } catch {
        // sin audio de keep-alive: la radio funciona igual en primer plano
      }
    })();
    return () => {
      try {
        player?.remove();
      } catch {
        /* noop */
      }
      keepAliveRef.current = null;
    };
  }, [token, channelId]);

  // Al volver del segundo plano, reconecta y re-entra al canal para que la
  // radio no quede "cortada" tras suspender la app o recibir una llamada.
  useEffect(() => {
    if (!token || !channelId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const socket = getSocket('/radio', token);
      if (!socket.connected) socket.connect();
      socket.emit('channel:join', channelId);
    });
    return () => sub.remove();
  }, [token, channelId]);

  const ensurePermission = useCallback(async () => {
    if (permissionRef.current === null) {
      const res = await requestRecordingPermissionsAsync();
      permissionRef.current = res.granted;
    }
    return permissionRef.current;
  }, []);

  /** Libera el micrófono: saca la sesión de audio del modo grabación. */
  const releaseMic = useCallback(async () => {
    armedRef.current = false;
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false, // vuelve al altavoz, no al auricular
      });
    } catch {
      // sin sesión activa: nada que liberar
    }
  }, []);

  /**
   * Deja el micrófono LISTO para grabar al instante. Sin esto, `record()` tiene
   * latencia (preparar sesión + recorder) y recorta el inicio: dices "hola" y se
   * oye "la". Pre-armamos el recorder para capturar desde el primer instante.
   */
  const arm = useCallback(async () => {
    if (armedRef.current || recordingRef.current) return;
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false, // salida por altavoz (evita eco)
        shouldPlayInBackground: true,
      });
      await recorder.prepareToRecordAsync();
      armedRef.current = true;
    } catch {
      armedRef.current = false;
    }
  }, [recorder]);

  // Definido antes de startTalking porque el auto-corte de seguridad lo usa.
  const stopTalking = useCallback(async () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    // Idempotente: si no estábamos grabando, re-armamos para el próximo toque.
    if (!recordingRef.current) {
      setTalking(false);
      void arm();
      return;
    }
    recordingRef.current = false;
    setTalking(false);

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // aunque falle el stop, seguimos
    }

    if (!channelId || !token || !uri) {
      void arm();
      return;
    }
    try {
      const durationSec = Math.max(
        0.5,
        (Date.now() - startedAtRef.current) / 1000,
      );
      const base64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      const socket = getSocket('/radio', token);
      // 1) Relay en vivo del clip a quienes están escuchando ahora.
      socket.emit('ptt:audio', { channelId, chunk: base64, mime: 'audio/mp4' });
      // 2) Subir el clip para guardarlo en el canal (permite reescuchar el último).
      let audioKey: string | undefined;
      try {
        const up = await api.upload(uri, { name: 'radio.m4a', type: 'audio/m4a' });
        audioKey = up.key;
      } catch {
        // si falla la subida, igual soltamos la palabra (sin audio guardado)
      }
      // 3) Soltar la palabra (el backend persiste metadatos + audioKey y avisa).
      socket.emit('ptt:release', { channelId, durationSec, audioKey });
    } catch {
      // no rompemos la UI si falla el envío
    }
    // Re-armar el micrófono para que la próxima transmisión capture al instante.
    void arm();
  }, [channelId, token, recorder, arm]);

  const startTalking = useCallback(async () => {
    if (!channelId || !token || recordingRef.current) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      // El recorder ya está pre-armado (arm); si no, lo preparamos ahora.
      if (!armedRef.current) await arm();
      recorder.record(); // instantáneo: captura desde el primer instante ("hola")
      recordingRef.current = true;
      armedRef.current = false; // se consumió la preparación
      startedAtRef.current = Date.now();
      setTalking(true);
      // Pedir la palabra: el backend concede el turno y avisa al canal.
      getSocket('/radio', token).emit('ptt:request', { channelId });
      // Seguridad: corta solo tras 60 s para que el micro nunca quede abierto
      // si por alguna razón no llega el evento de soltar el botón.
      maxTimerRef.current = setTimeout(() => {
        void stopTalking();
      }, 60000);
    } catch {
      recordingRef.current = false;
      setTalking(false);
      await releaseMic();
    }
  }, [channelId, token, recorder, ensurePermission, arm, stopTalking, releaseMic]);

  async function playClip(base64: string) {
    try {
      const uri = `${cacheDirectory}rx-${rxCounter++}.m4a`;
      await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
      // Si el micrófono ya está armado (estás en la pestaña Radio) NO tocamos el
      // modo de audio: cambiarlo des-prepara el recorder y recorta el inicio de
      // tu próxima transmisión ("hola" -> "la"). Solo lo ajustamos si no lo está.
      if (!armedRef.current) {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: true, // seguir escuchando en 2.º plano
        });
      }
      // Corta cualquier clip anterior para que no se superpongan (doble audio = eco).
      rxPlayerRef.current?.remove();
      rxPlayerRef.current = null;
      const player = createAudioPlayer(uri);
      rxPlayerRef.current = player;
      player.play();
    } catch {
      // clip corrupto o sin permiso de audio: se ignora
    }
  }

  useEffect(
    () => () => {
      rxPlayerRef.current?.remove();
      // Si se desmonta mientras grababa, corta y libera el micrófono.
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current = false;
        void recorder.stop?.();
      }
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    },
    [recorder],
  );

  // Carga el historial persistido del canal al entrar / cambiar de canal.
  useEffect(() => {
    if (!channelId || !token) return;
    let cancelled = false;
    interface ApiTx {
      id: string;
      durationSec: number;
      createdAt: string;
      senderId?: string;
      sender?: { name?: string; nickname?: string | null };
      audioKey?: string | null;
      imageKey?: string | null;
    }
    api
      .get<ApiTx[]>(`/radio/channels/${channelId}/history?limit=50`)
      .then((rows) => {
        if (cancelled) return;
        setHistory(
          rows.map((t) => ({
            id: t.id,
            senderName: radioName(t.sender),
            durationSec: t.durationSec,
            at: t.createdAt,
            audioKey: t.audioKey ?? null,
            imageKey: t.imageKey ?? null,
            mine: t.senderId === user?.id,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, token]);

  // Estado inicial del altavoz según la configuración guardada del teléfono.
  const muteInitRef = useRef(false);
  useEffect(() => {
    if (settingsLoaded && !muteInitRef.current) {
      muteInitRef.current = true;
      const m = !settings.radioSound;
      mutedRef.current = m;
      setMuted(m);
    }
  }, [settingsLoaded, settings.radioSound]);

  // Arma el micrófono al enfocar la pestaña de Radio y lo libera al salir, para
  // que el PTT capture al instante sin dejar el micrófono activo en otras vistas.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!channelId) return;
        if ((await ensurePermission()) && active) await arm();
      })();
      return () => {
        void releaseMic();
      };
    }, [channelId, ensurePermission, arm, releaseMic]),
  );

  /** Reproduce un audio guardado del canal por su key (reescuchar). */
  const playAudio = useCallback(async (audioKey?: string | null) => {
    const url = mediaUrl(audioKey);
    if (!url) return;
    try {
      // No des-armar el micrófono si ya está listo (evita recortar el inicio).
      if (!armedRef.current) {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldRouteThroughEarpiece: false,
          shouldPlayInBackground: true,
        });
      }
      rxPlayerRef.current?.remove();
      rxPlayerRef.current = null;
      const player = createAudioPlayer(url);
      rxPlayerRef.current = player;
      player.play();
    } catch {
      // sin audio guardado o sin red
    }
  }, []);

  /** Reproduce el último audio guardado del canal. */
  const playLast = useCallback(async () => {
    const last = history.find((h) => h.audioKey);
    await playAudio(last?.audioKey);
  }, [history, playAudio]);

  /** Comparte una imagen en el chat del canal (la sube y avisa al canal). */
  const sendImage = useCallback(
    async (uri: string) => {
      if (!channelId || !token) return;
      try {
        const up = await api.upload(uri, { name: 'foto.jpg', type: 'image/jpeg' });
        getSocket('/radio', token).emit('channel:image', {
          channelId,
          imageKey: up.key,
        });
      } catch {
        // sin red o subida fallida: se ignora
      }
    },
    [channelId, token],
  );

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      // Al silenciar, corta de inmediato lo que esté sonando.
      if (next) {
        rxPlayerRef.current?.remove();
        rxPlayerRef.current = null;
      }
      return next;
    });
  }, []);

  return {
    talking,
    speaking,
    history,
    muted,
    toggleMuted,
    startTalking,
    stopTalking,
    playLast,
    playAudio,
    sendImage,
    hasLastAudio: history.some((h) => h.audioKey),
    meId: user?.id,
  };
}
