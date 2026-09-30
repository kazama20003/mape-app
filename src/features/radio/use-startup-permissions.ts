import { requestRecordingPermissionsAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

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
      // Bluetooth (Android 12+): sin BLUETOOTH_CONNECT, InCallManager no detecta
      // ni usa el audífono Bluetooth (el audio se queda en el auricular/altavoz).
      try {
        if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
          await PermissionsAndroid.request(
            'android.permission.BLUETOOTH_CONNECT' as Parameters<
              typeof PermissionsAndroid.request
            >[0],
          );
        }
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
