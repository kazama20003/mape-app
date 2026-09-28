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

  const playAudio = useCallback(async (audioKey?: string | null) => {
    const url = mediaUrl(audioKey);
    if (!url) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: true,
      });
      playerRef.current?.remove();
      playerRef.current = null;
      const player = createAudioPlayer(url);
      playerRef.current = player;
      player.play();
    } catch {
      // sin red o audio inválido
    }
  }, []);

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

  useEffect(() => () => playerRef.current?.remove(), []);

  return { messages, playAudio, sendImage, sendText };
}
