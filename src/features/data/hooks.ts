import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type {
  Alert,
  AlertMetrics,
  AuthUser,
  Channel,
  ConversationSummary,
  LiveUnit,
  Message,
  NotificationPreferences,
  UnitDetail,
  UpdateProfilePayload,
} from '@/lib/types';

// ── Unidades / flota ───────────────────────────────────────────
export function useUnitsSummary() {
  return useQuery({
    queryKey: ['units', 'summary'],
    queryFn: () =>
      api.get<{ total: number; enRuta: number; detenidos: number }>(
        '/units/summary',
      ),
  });
}

export function useUnits(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['units', status ?? 'all'],
    queryFn: () => api.get<LiveUnit[]>(`/units${qs}`),
  });
}

export function useUnit(id?: string) {
  return useQuery({
    queryKey: ['units', 'detail', id],
    queryFn: () => api.get<UnitDetail>(`/units/${id}`),
    enabled: !!id,
  });
}

// ── Perfil / cuenta ────────────────────────────────────────────
export function useMe() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<AuthUser>('/users/me'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      api.patch<AuthUser>('/users/me', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

// ── Preferencias de notificación ───────────────────────────────
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () =>
      api.get<NotificationPreferences>('/notifications/preferences'),
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>(
        '/notifications/preferences',
        payload,
      ),
    // Actualización optimista para que el toggle responda al instante.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['notifications', 'preferences'] });
      const prev = qc.getQueryData<NotificationPreferences>([
        'notifications',
        'preferences',
      ]);
      if (prev) {
        qc.setQueryData<NotificationPreferences>(
          ['notifications', 'preferences'],
          { ...prev, ...payload },
        );
      }
      return { prev };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(['notifications', 'preferences'], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
    },
  });
}

// ── Alertas ────────────────────────────────────────────────────
export function useAlerts() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<Alert[]>('/alerts'),
  });

  useEffect(() => {
    if (!token) return;
    const socket = getSocket('/alerts', token);
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts', 'metrics'] });
    };
    socket.on('alert:new', refresh);
    socket.on('alert:updated', refresh);
    return () => {
      socket.off('alert:new', refresh);
      socket.off('alert:updated', refresh);
    };
  }, [token, qc]);

  return query;
}

export function useAlertMetrics() {
  return useQuery({
    queryKey: ['alerts', 'metrics'],
    queryFn: () => api.get<AlertMetrics>('/alerts/metrics'),
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/alerts/${id}/acknowledge`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alerts', 'metrics'] });
    },
  });
}

// ── Chat ───────────────────────────────────────────────────────
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<ConversationSummary[]>('/conversations'),
  });
}

export function useConversation(id?: string) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['conversations', id],
    queryFn: () =>
      api.get<{ conversation: any; messages: Message[] }>(`/conversations/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (!token || !id) return;
    const socket = getSocket('/chat', token);
    socket.emit('conversation:join', id);
    const onNew = (msg: Message) => {
      if (msg.conversationId !== id) return;
      qc.setQueryData<{ conversation: any; messages: Message[] }>(
        ['conversations', id],
        (prev) =>
          prev
            ? { ...prev, messages: [...prev.messages, msg] }
            : prev,
      );
    };
    socket.on('message:new', onNew);
    return () => {
      socket.emit('conversation:leave', id);
      socket.off('message:new', onNew);
    };
  }, [token, id, qc]);

  return query;
}

export interface SendMessagePayload {
  type?: 'TEXT' | 'VOICE' | 'IMAGE' | 'VIDEO' | 'LOCATION';
  body?: string;
  attachmentKey?: string;
  durationSec?: number;
  lat?: number;
  lng?: number;
  locationLabel?: string;
}

export function useSendMessage(conversationId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      api.post<Message>(`/conversations/${conversationId}/messages`, {
        type: payload.type ?? 'TEXT',
        ...payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ── Radio ──────────────────────────────────────────────────────
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get<Channel[]>('/radio/channels'),
  });
}
