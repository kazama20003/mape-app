import { io, Socket } from 'socket.io-client';
import { WS_ORIGIN } from './config';

const sockets: Record<string, Socket> = {};

/** Devuelve (o crea) un socket para el namespace, autenticado con el JWT. */
export function getSocket(namespace: string, token: string): Socket {
  const existing = sockets[namespace];
  if (existing) {
    existing.auth = { token };
    if (!existing.connected) existing.connect();
    return existing;
  }
  const socket = io(`${WS_ORIGIN}${namespace}`, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
  });
  sockets[namespace] = socket;
  return socket;
}

export function closeAllSockets() {
  Object.values(sockets).forEach((s) => s.disconnect());
}
