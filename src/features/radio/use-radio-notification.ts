import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Mape } from '@/constants/mape-theme';

const isExpoGo = Constants.appOwnership === 'expo';
const ANDROID_CHANNEL = 'radioLive';
const CATEGORY = 'radioLive';
// Identificador FIJO: cada actualización reemplaza LA MISMA notificación en vez
// de crear una nueva (antes salían varias al cambiar de estado rápido).
const NOTIF_ID = 'radio-live-status';

let setupReady = false;

/**
 * Notificación PERSISTENTE mientras estás en un canal de radio: muestra el
 * estado (escuchando / alguien habla / transmitiendo) y un botón "Hablar" que
 * abre la app en la radio. Se quita al salir del canal o desmontar la pantalla.
 */
export function useRadioNotification(
  channelName: string | undefined,
  active: boolean,
  label: string,
) {
  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web') return;
    let cancelled = false;

    const show = async () => {
      try {
        if (!setupReady) {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
              name: 'Radio en vivo',
              // LOW: no suena ni vibra al actualizar el estado.
              importance: Notifications.AndroidImportance.LOW,
            });
          }
          await Notifications.setNotificationCategoryAsync(CATEGORY, [
            {
              identifier: 'HABLAR',
              buttonTitle: 'Hablar',
              options: { opensAppToForeground: true },
            },
          ]);
          // Limpia notificaciones de radio "pegadas" de versiones anteriores
          // (las que se acumulaban con id dinámico y no se podían descartar).
          try {
            const shown = await Notifications.getPresentedNotificationsAsync();
            for (const n of shown) {
              const d = n.request.content.data as { kind?: string } | undefined;
              if (d?.kind === 'radio' && n.request.identifier !== NOTIF_ID) {
                await Notifications.dismissNotificationAsync(n.request.identifier);
              }
            }
          } catch {
            /* noop */
          }
          setupReady = true;
        }
        if (cancelled) return;
        await Notifications.scheduleNotificationAsync({
          identifier: NOTIF_ID, // fijo -> reemplaza, nunca duplica
          content: {
            title: `MAPE Radio · ${channelName}`,
            body: label,
            categoryIdentifier: CATEGORY,
            data: { kind: 'radio' },
            color: Mape.red,
            sticky: true, // ongoing (no se descarta deslizando)
            autoDismiss: false,
          },
          trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
        });
      } catch {
        /* noop */
      }
    };

    const clear = async () => {
      try {
        await Notifications.dismissNotificationAsync(NOTIF_ID);
      } catch {
        /* noop */
      }
      try {
        await Notifications.cancelScheduledNotificationAsync(NOTIF_ID);
      } catch {
        /* noop */
      }
    };

    if (active && channelName) void show();
    else void clear();

    return () => {
      cancelled = true;
    };
  }, [active, channelName, label]);

  // Al desmontar la pantalla, quitar la notificación.
  useEffect(
    () => () => {
      Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
    },
    [],
  );
}
