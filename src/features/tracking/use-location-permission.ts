import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LocationPermissionState = 'pending' | 'granted' | 'denied';

/**
 * Solicita el permiso de ubicación en primer plano al montar. En Android los
 * permisos "peligrosos" (ACCESS_FINE_LOCATION) deben pedirse en tiempo de
 * ejecución aunque estén declarados en el manifest: sin esta solicitud el punto
 * azul de `showsUserLocation` nunca aparece y el operador no puede reportar.
 *
 * Es independiente del rol: el admin también necesita el permiso para ver su
 * propia ubicación en el mapa.
 */
export function useLocationPermission(): LocationPermissionState {
  const [state, setState] = useState<LocationPermissionState>('pending');

  useEffect(() => {
    let active = true;
    (async () => {
      // Si ya está concedido no volvemos a mostrar el diálogo.
      const current = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      if (current.status === 'granted') {
        setState('granted');
        return;
      }
      if (!current.canAskAgain) {
        setState('denied');
        return;
      }
      const req = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      setState(req.status === 'granted' ? 'granted' : 'denied');
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
