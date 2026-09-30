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
  const { token } = useAuth();
  const [myGuide, setMyGuide] = useState<Guide | null>(null); // asignada a mí
  const [assigned, setAssigned] = useState<Guide | null>(null); // la que yo asigné

  useEffect(() => {
    if (!token) return;
    const socket = getSocket('/tracking', token);
    const onAssigned = (g: Guide) => setMyGuide(g);
    const onCleared = () => setMyGuide(null);
    socket.on('guide:assigned', onAssigned);
    socket.on('guide:cleared', onCleared);
    return () => {
      socket.off('guide:assigned', onAssigned);
      socket.off('guide:cleared', onCleared);
    };
  }, [token]);

  const assign = useCallback(
    async (targetUserId: string, dest: { lat: number; lng: number; name?: string }) => {
      if (!token) return { error: 'sin sesión' } as const;
      const socket = getSocket('/tracking', token);
      const r = await ack<{ ok?: boolean; guide?: Guide; error?: string }>(
        socket,
        'guide:assign',
        { targetUserId, dest },
      );
      if (r?.guide) setAssigned(r.guide);
      return r;
    },
    [token],
  );

  const clear = useCallback(
    async (targetUserId: string) => {
      if (!token) return;
      const socket = getSocket('/tracking', token);
      await ack(socket, 'guide:clear', { targetUserId });
      setAssigned((a) => (a?.targetUserId === targetUserId ? null : a));
    },
    [token],
  );

  return {
    myGuide,
    assigned,
    assign,
    clear,
    dismissAssigned: () => setAssigned(null),
    dismissMyGuide: () => setMyGuide(null),
  };
}
