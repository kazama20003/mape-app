import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { useSettings } from '@/features/settings/settings-context';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { LivePerson } from '@/lib/types';
import type { LocationPermissionState } from '@/features/tracking/use-location-permission';

/**
 * Reporta la ubicación del propio usuario (cualquier rol) al backend. El resto
 * del equipo lo verá en el mapa con su perfil/apelativo. Es independiente del
 * rastreo por unidad (operadores): aquí se trata de la presencia de la persona.
 */
export function usePresenceReporter(permission: LocationPermissionState): void {
  const { user } = useAuth();
  const { settings } = useSettings();
  const shareLocation = settings.shareLocation;

  useEffect(() => {
    if (!user || permission !== 'granted' || !shareLocation) return;
    let active = true;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20,
          timeInterval: 5000,
        },
        (loc) => {
          api
            .post('/tracking/me/position', {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speedKmh: Math.max(0, (loc.coords.speed ?? 0) * 3.6),
              heading: loc.coords.heading ?? undefined,
              accuracy: loc.coords.accuracy ?? undefined,
            })
            .catch(() => {
              // reintento en la próxima lectura
            });
        },
      );
      if (!active) sub?.remove();
    })();

    return () => {
      active = false;
      sub?.remove();
    };
  }, [user, permission, shareLocation]);
}

/** Presencia en vivo de todas las personas + suscripción por WebSocket. */
export function useLivePeople() {
  const { token } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tracking', 'people'],
    queryFn: () => api.get<LivePerson[]>('/tracking/people'),
  });

  useEffect(() => {
    if (!token) return;
    const socket = getSocket('/tracking', token);
    const onUpdate = (p: LivePerson) => {
      qc.setQueryData<LivePerson[]>(['tracking', 'people'], (prev) => {
        const list = prev ? [...prev] : [];
        const idx = list.findIndex((u) => u.id === p.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...p };
        else list.push(p);
        return list;
      });
    };
    socket.on('presence:update', onUpdate);
    return () => {
      socket.off('presence:update', onUpdate);
    };
  }, [token, qc]);

  return query;
}
