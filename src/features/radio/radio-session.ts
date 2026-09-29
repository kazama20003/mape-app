import { useSyncExternalStore } from 'react';

/**
 * Estado global mínimo de la sesión de radio, para poder "desconectar" desde la
 * notificación (fuera del árbol de React de la pantalla). Cuando `disconnected`
 * es true, la pantalla de radio deja de montar la sesión de audio y quita la
 * notificación. Se reactiva al volver a enfocar la pestaña de radio.
 */
let disconnected = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const radioSession = {
  leave() {
    if (!disconnected) {
      disconnected = true;
      emit();
    }
  },
  rejoin() {
    if (disconnected) {
      disconnected = false;
      emit();
    }
  },
  isDisconnected: () => disconnected,
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Hook reactivo: ¿el usuario pulsó "Desconectar" en la notificación? */
export function useRadioDisconnected() {
  return useSyncExternalStore(
    subscribe,
    radioSession.isDisconnected,
    radioSession.isDisconnected,
  );
}
