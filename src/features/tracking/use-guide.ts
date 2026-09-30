import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import { getSocket } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Guide {
  route: {
    polyline: string;
    distanceText: string;
    durationText: string;
    durationInTrafficText?: string;
    hasTraffic?: boolean;
  };
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number; name?: string };
  assignedBy?: string;
  targetUserId: string;
}

const ack = <T = any>(socket: Socket, ev: string, data?: unknown): Promise<T> =>
  new Promise((resolve) => socket.emit(ev, data, resolve));

/** Decodifica una polyline codificada de Google a coordenadas {lat,lng}. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Guías/rutas en el mapa. Un supervisor asigna una ruta a un usuario en línea
 * (`assign`) y la ve dibujada (`assigned`); el usuario objetivo la recibe en
 * vivo (`myGuide`) para seguirla y abrir "Cómo llegar".
 */
export function useGuide() {
  const { token, user } = useAuth();
  const [myGuide, setMyGuide] = useState<Guide | null>(null); // MI ruta activa
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket('/tracking', token);
    const onAssigned = (g: Guide) => {
      setMyGuide(g);
      setLoading(false);
    };
    const onCleared = () => setMyGuide(null);
    socket.on('guide:assigned', onAssigned);
    socket.on('guide:cleared', onCleared);
    return () => {
      socket.off('guide:assigned', onAssigned);
      socket.off('guide:cleared', onCleared);
    };
  }, [token]);

  // Traza la ruta desde MI ubicación actual hasta `dest` (para ir hacia ahí).
  const guideTo = useCallback(
    async (dest: { lat: number; lng: number; name?: string }) => {
      if (!token || !user) return { error: 'sin sesión' } as const;
      setLoading(true);
      const socket = getSocket('/tracking', token);
      const r = await ack<{ ok?: boolean; guide?: Guide; error?: string }>(
        socket,
        'guide:assign',
        { targetUserId: user.id, dest },
      );
      setLoading(false);
      if (r?.guide) setMyGuide(r.guide);
      return r;
    },
    [token, user],
  );

  const clearGuide = useCallback(() => {
    setMyGuide(null);
    if (token && user) {
      const socket = getSocket('/tracking', token);
      void ack(socket, 'guide:clear', { targetUserId: user.id });
    }
  }, [token, user]);

  return { myGuide, loading, guideTo, clearGuide };
}
