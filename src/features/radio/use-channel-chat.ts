import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { api, mediaUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { RadioTransmission } from '@/features/radio/use-radio';

function radioName(u?: { name?: string; nickname?: string | null } | null): string {
  return u?.nickname || u?.name || 'Operador';
}

type RawTx = {
  id: string;
  durationSec?: number;
  senderId?: string;
  sender?: { name?: string; nickname?: string | null };
  createdAt: string;
  audioKey?: string | null;
  imageKey?: string | null;
  text?: string | null;
};

/**
 * Hook LIGERO para la vista de chat de un canal: solo carga el historial
 * (notas de voz + imágenes), escucha los nuevos, reproduce audios y envía
 * imágenes. No toca el micrófono ni el push-to-talk (eso vive en useRadio).
 */
export function useChannelChat(channelId: string | undefined) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<RadioTransmission[]>([]);
  const playerRef = useRef<AudioPlayer | null>(null);
  // Reproductor pre-cargado de la última nota de voz (para que "Último" suene al
  // instante, sin esperar el buffer al presionar).
  const preloadRef = useRef<{ key: string; player: AudioPlayer } | null>(null);
  // Nota que se está reproduciendo ahora (para el indicador visual "sonando").
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapTx = useCallback(
    (t: RawTx): RadioTransmission => ({
      id: t.id,
      senderName: radioName(t.sender),
      durationSec: t.durationSec ?? 0,
      at: t.createdAt,
      audioKey: t.audioKey ?? null,
      imageKey: t.imageKey ?? null,
      text: t.text ?? null,
      mine: t.senderId === user?.id,
    }),
    [user?.id],
  );

  // Carga inicial del historial del canal.
  useEffect(() => {
    if (!channelId || !token) return;
    let cancelled = false;
    api
      .get<RawTx[]>(`/radio/channels/${channelId}/history?limit=50`)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map(mapTx));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [channelId, token, mapTx]);

  // Escucha nuevos mensajes en vivo (audios terminados e imágenes).
  useEffect(() => {
    if (!channelId || !token) return;
    const socket = getSocket('/radio', token);
    socket.emit('channel:join', channelId);

    const add = (data: { channelId: string; transmission?: RawTx }) => {
      if (data.channelId !== channelId || !data.transmission) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.transmission!.id)) return prev;
        return [mapTx(data.transmission!), ...prev].slice(0, 50);
      });
    };

    socket.on('ptt:ended', add);
    socket.on('channel:post', add);
    return () => {
      socket.off('ptt:ended', add);
      socket.off('channel:post', add);
    };
  }, [channelId, token, mapTx]);

  const playAudio = useCallback(
    async (audioKey?: string | null, durationSec?: number) => {
    const url = mediaUrl(audioKey);
    if (!url || !audioKey) return;
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      // Marca "reproduciendo" y lo limpia al terminar (según la duración).
      setPlayingKey(audioKey);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      playTimerRef.current = setTimeout(
        () => setPlayingKey((k) => (k === audioKey ? null : k)),
        Math.max(1, durationSec ?? 3) * 1000 + 600,
      );
      // Si la nota está PRE-CARGADA, suena al instante (sin esperar el buffer).
      if (preloadRef.current?.key === audioKey) {
        playerRef.current?.remove();
        const p = preloadRef.current.player;
        preloadRef.current = null;
        playerRef.current = p;
        p.volume = 1;
        try {
          p.seekTo(0);
        } catch {
          /* noop */
        }
        p.play();
        // Re-pre-carga la MISMA nota para que una 2.ª reproducción seguida
        // también sea instantánea.
        try {
          const np = createAudioPlayer(url);
          np.volume = 1;
          preloadRef.current = { key: audioKey, player: np };
        } catch {
          /* noop */
        }
        return;
      }
      playerRef.current?.remove();
      playerRef.current = null;
      const player = createAudioPlayer(url);
      player.volume = 1;
      playerRef.current = player;
      player.play();
    } catch {
      // sin red o audio inválido
    }
  }, []);

  // Pre-carga la ÚLTIMA nota de voz apenas llega, para que "Último" suene ya.
  useEffect(() => {
    const lastAudio = messages.find((m) => m.audioKey)?.audioKey;
    if (!lastAudio || preloadRef.current?.key === lastAudio) return;
    const url = mediaUrl(lastAudio);
    if (!url) return;
    try {
      preloadRef.current?.player.remove();
    } catch {
      /* noop */
    }
    preloadRef.current = null;
    try {
      const p = createAudioPlayer(url);
      p.volume = 1;
      preloadRef.current = { key: lastAudio, player: p };
    } catch {
      preloadRef.current = null;
    }
  }, [messages]);

  const sendImage = useCallback(
    async (uri: string, opts?: { name?: string; type?: string }) => {
      if (!channelId || !token) return;
      try {
        const up = await api.upload(uri, {
          name: opts?.name ?? 'foto.jpg',
          type: opts?.type ?? 'image/jpeg',
        });
        getSocket('/radio', token).emit('channel:image', {
          channelId,
          imageKey: up.key,
        });
      } catch {
        // subida fallida
      }
    },
    [channelId, token],
  );

  const sendText = useCallback(
    (text: string) => {
      const body = text.trim();
      if (!channelId || !token || !body) return;
      getSocket('/radio', token).emit('channel:text', { channelId, text: body });
    },
    [channelId, token],
  );

  useEffect(
    () => () => {
      playerRef.current?.remove();
      preloadRef.current?.player.remove();
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    },
    [],
  );

  return { messages, playAudio, sendImage, sendText, playingKey };
}
