import { requestRecordingPermissionsAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Pide los permisos clave al iniciar sesión (una vez), para que el push-to-talk
 * no falle luego por falta de permiso de micrófono. Tolerante a fallos.
 */
export function useStartupPermissions(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      try {
        await requestRecordingPermissionsAsync();
      } catch {
        /* noop */
      }
      if (cancelled || isExpoGo) return;
      try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') await Notifications.requestPermissionsAsync();
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
