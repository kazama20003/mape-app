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
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { useSettings } from '@/features/settings/settings-context';
import { api } from '@/lib/api';
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
}

let rxCounter = 0;

/**
 * Push-to-talk por internet: graba al mantener presionado, envía el clip por
 * el WebSocket del canal y reproduce automáticamente los que llegan.
 */
export function useRadio(channelId: string | undefined) {
  const { token, user } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);

  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState<SpeakingUser | null>(null);
  const [history, setHistory] = useState<RadioTransmission[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const startedAtRef = useRef<number>(0);
  const rxPlayerRef = useRef<AudioPlayer | null>(null);
  const permissionRef = useRef<boolean | null>(null);
  const recordingRef = useRef(false);
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
      sender?: SpeakingUser;
    }) => {
      if (data.channelId !== channelId) return;
      if (!mutedRef.current) await playClip(data.chunk); // altavoz apagado = no reproduce
      // el "hablando ahora" se apaga poco después de recibir el clip
      setTimeout(() => setSpeaking(null), 400);
    };

    const onEnded = (data: {
      channelId: string;
      transmission?: {
        id: string;
        durationSec: number;
        sender?: { name?: string; nickname?: string | null };
        createdAt: string;
      };
    }) => {
      if (data.channelId !== channelId) return;
      const t = data.transmission;
      if (t) {
        setHistory((prev) =>
          [
            {
              id: t.id,
              senderName: radioName(t.sender),
              durationSec: t.durationSec,
              at: t.createdAt,
            },
            ...prev,
          ].slice(0, 20),
        );
      }
      setSpeaking(null);
    };

    socket.on('ptt:speaking', onSpeaking);
    socket.on('ptt:audio', onAudio);
    socket.on('ptt:ended', onEnded);

    return () => {
      socket.emit('channel:leave', channelId);
      socket.off('ptt:speaking', onSpeaking);
      socket.off('ptt:audio', onAudio);
      socket.off('ptt:ended', onEnded);
    };
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
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // sin sesión activa: nada que liberar
    }
  }, []);

  // Definido antes de startTalking porque el auto-corte de seguridad lo usa.
  const stopTalking = useCallback(async () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    // Idempotente: si no estábamos grabando, solo asegura estado/mic apagados.
    if (!recordingRef.current) {
      setTalking(false);
      await releaseMic();
      return;
    }
    recordingRef.current = false;
    setTalking(false);

    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // aunque falle el stop, seguimos para liberar el micro
    }
    await releaseMic(); // clave: sin esto el indicador de micrófono queda activo

    if (!channelId || !token || !uri) return;
    try {
      const durationSec = Math.max(
        0.5,
        (Date.now() - startedAtRef.current) / 1000,
      );
      const base64 = await readAsStringAsync(uri, {
        encoding: EncodingType.Base64,
      });
      const socket = getSocket('/radio', token);
      // Enviar el clip y soltar la palabra (el backend persiste y avisa al canal).
      socket.emit('ptt:audio', { channelId, chunk: base64, mime: 'audio/mp4' });
      socket.emit('ptt:release', { channelId, durationSec });
    } catch {
      // no rompemos la UI si falla el envío
    }
  }, [channelId, token, recorder, releaseMic]);

  const startTalking = useCallback(async () => {
    if (!channelId || !token || recordingRef.current) return;
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
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
  }, [channelId, token, recorder, ensurePermission, stopTalking, releaseMic]);

  async function playClip(base64: string) {
    try {
      const uri = `${cacheDirectory}rx-${rxCounter++}.m4a`;
      await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
      rxPlayerRef.current?.remove();
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
      sender?: { name?: string; nickname?: string | null };
    }
    api
      .get<ApiTx[]>(`/radio/channels/${channelId}/history?limit=20`)
      .then((rows) => {
        if (cancelled) return;
        setHistory(
          rows.map((t) => ({
            id: t.id,
            senderName: radioName(t.sender),
            durationSec: t.durationSec,
            at: t.createdAt,
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

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      return !m;
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
    meId: user?.id,
  };
}
