import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { LiveUnit } from '@/lib/types';

interface PositionUpdate {
  unitId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading?: number;
  status: LiveUnit['status'];
  recordedAt: string;
}

/** Últimas posiciones de la flota + suscripción en vivo por WebSocket. */
export function useLiveUnits() {
  const { token } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tracking', 'live'],
    queryFn: () => api.get<LiveUnit[]>('/tracking/live'),
  });

  useEffect(() => {
    if (!token) return;
    const socket = getSocket('/tracking', token);
    const onUpdate = (p: PositionUpdate) => {
      qc.setQueryData<LiveUnit[]>(['tracking', 'live'], (prev) => {
        const list = prev ? [...prev] : [];
        const idx = list.findIndex((u) => u.id === p.unitId);
        const patch = {
          lastLat: p.lat,
          lastLng: p.lng,
          lastSpeedKmh: p.speedKmh,
          lastHeading: p.heading ?? null,
          status: p.status,
          lastPositionAt: p.recordedAt,
        };
        if (idx >= 0) list[idx] = { ...list[idx], ...patch };
        return list;
      });
    };
    socket.on('position:update', onUpdate);
    return () => {
      socket.off('position:update', onUpdate);
    };
  }, [token, qc]);

  return query;
}
