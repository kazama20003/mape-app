import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { useSettings } from '@/features/settings/settings-context';
import { api } from '@/lib/api';

interface Me {
  drivenUnit?: { id: string } | null;
}

/**
 * Para operadores: usa el GPS nativo para reportar la posición de su unidad
 * al backend cada pocos segundos / metros. El supervisor la ve en el mapa.
 */
export function useLocationReporter() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const isOperator = user?.role === 'OPERATOR';
  const shareLocation = settings.shareLocation;

  const { data: me } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<Me>('/users/me'),
    enabled: isOperator,
  });
  const unitId = me?.drivenUnit?.id;

  useEffect(() => {
    if (!isOperator || !unitId || !shareLocation) return;
    let active = true;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !active) return;

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
    })();

    return () => {
      active = false;
      sub?.remove();
    };
  }, [isOperator, unitId, shareLocation]);
}
