import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { Mape } from '@/constants/mape-theme';

const isExpoGo = Constants.appOwnership === 'expo';
const ANDROID_CHANNEL = 'radioLive';
const CATEGORY = 'radioLive';

/**
 * Notificación PERSISTENTE mientras estás en un canal de radio: muestra el
 * estado (escuchando / alguien habla / transmitiendo) y un botón "Hablar" que
 * abre la app en la radio. Se quita al salir del canal o desmontar la pantalla.
 *
 * Versión SIMPLE: el botón solo trae la app al frente (no transmite en segundo
 * plano; eso requeriría un foreground service nativo).
 */
export function useRadioNotification(
  channelName: string | undefined,
  active: boolean,
  label: string,
) {
  const idRef = useRef<string | null>(null);
  const setupRef = useRef(false);

  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web') return;

    let cancelled = false;

    const clear = async () => {
      if (!idRef.current) return;
      try {
        await Notifications.dismissNotificationAsync(idRef.current);
      } catch {
        /* noop */
      }
      idRef.current = null;
    };

    const show = async () => {
      try {
        if (!setupRef.current) {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
              name: 'Radio en vivo',
              // LOW: la notificación no suena ni vibra al actualizar el estado.
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
          setupRef.current = true;
        }
        const id = await Notifications.scheduleNotificationAsync({
          ...(idRef.current ? { identifier: idRef.current } : {}),
          content: {
            title: `MAPE Radio · ${channelName}`,
            body: label,
            categoryIdentifier: CATEGORY,
            data: { kind: 'radio' },
            color: Mape.red, // color de acento de marca
            sticky: true, // no se puede descartar deslizando (ongoing)
            autoDismiss: false,
          },
          trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
        });
        if (cancelled) {
          try {
            await Notifications.dismissNotificationAsync(id);
          } catch {
            /* noop */
          }
          return;
        }
        idRef.current = id;
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
      if (!idRef.current) return;
      Notifications.dismissNotificationAsync(idRef.current).catch(() => {});
      idRef.current = null;
    },
    [],
  );
}
