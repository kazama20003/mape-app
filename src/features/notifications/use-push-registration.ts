import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';

function platform(): 'IOS' | 'ANDROID' | 'WEB' {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

// En Expo Go (SDK 53+) las notificaciones push remotas no están disponibles.
// Se requiere un development build. Detectamos el entorno para no cargar el
// módulo nativo donde no existe (evita que reviente el arranque de la app).
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Pide permiso de notificaciones, obtiene el token push nativo y lo registra
 * en el backend. Carga expo-notifications de forma perezosa y tolerante a
 * fallos para no romper la app en Expo Go o en web.
 */
export function usePushRegistration() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isExpoGo || Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const Device = await import('expo-device');

        if (!Device.isDevice) return; // los emuladores no reciben push

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        const { status: existing } = await Notifications.getPermissionsAsync();
        let granted = existing;
        if (existing !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          granted = req.status;
        }
        if (granted !== 'granted' || cancelled) return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Alertas Mape',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        const projectId = (
          Constants as unknown as {
            expoConfig?: { extra?: { eas?: { projectId?: string } } };
          }
        ).expoConfig?.extra?.eas?.projectId;

        const tokenResp = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;

        await api.post('/notifications/devices', {
          token: tokenResp.data,
          platform: platform(),
        });
      } catch {
        // sin módulo nativo / sin projectId / sin red: se omite el registro
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);
}
