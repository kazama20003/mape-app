import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { useSettings } from '@/features/settings/settings-context';
import { api } from '@/lib/api';
import type { LocationPermissionState } from '@/features/tracking/use-location-permission';

interface Me {
  drivenUnit?: { id: string } | null;
}

export type ReporterStatus =
  | 'idle' // no es operador: no aplica
  | 'no-permission' // operador sin permiso de ubicación concedido
  | 'no-unit' // operador sin unidad asignada
  | 'sharing-off' // el operador desactivó "compartir ubicación"
  | 'reporting'; // enviando posiciones al backend

/**
 * Para operadores: usa el GPS nativo para reportar la posición de su unidad
 * al backend cada pocos segundos / metros. El supervisor la ve en el mapa.
 *
 * El permiso se pide fuera (useLocationPermission) para que también funcione el
 * punto azul del admin; aquí solo reportamos cuando el permiso ya está concedido.
 */
export function useLocationReporter(
  permission: LocationPermissionState,
): ReporterStatus {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isOperator = user?.role === 'OPERATOR';
  const shareLocation = settings.shareLocation;
  const [status, setStatus] = useState<ReporterStatus>('idle');

  const { data: me } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<Me>('/users/me'),
    enabled: isOperator,
  });
  const unitId = me?.drivenUnit?.id;

  useEffect(() => {
    if (!isOperator) {
      setStatus('idle');
      return;
    }
    if (permission !== 'granted') {
      setStatus('no-permission');
      return;
    }
    if (!shareLocation) {
      setStatus('sharing-off');
      return;
    }
    if (!unitId) {
      setStatus('no-unit');
      return;
    }

    let active = true;
    let sub: Location.LocationSubscription | null = null;
    setStatus('reporting');

    (async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20,
          timeInterval: 5000,
        },
        (loc) => {
          api
            .post('/tracking/positions', {
              unitId,
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
  }, [isOperator, unitId, shareLocation, permission]);

  return status;
}
