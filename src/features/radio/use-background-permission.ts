import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import { storage, StorageKeys } from '@/lib/storage';

const isExpoGo = Constants.appOwnership === 'expo';
const PACKAGE = 'com.mape.app';

/**
 * Pide (una vez) permiso para ejecutar la app SIN restricciones de batería, así
 * el SO no la mata en segundo plano y la radio/ubicación siguen funcionando con
 * la pantalla apagada. Usa el diálogo nativo estándar de Android.
 */
export function useBackgroundPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || isExpoGo) return;
    let cancelled = false;
    void (async () => {
      const asked = await storage.get(StorageKeys.bgPermAsked);
      if (asked || cancelled) return;
      await storage.set(StorageKeys.bgPermAsked, '1');
      Alert.alert(
        'Permitir en segundo plano',
        'Para que la radio y la ubicación sigan funcionando con la pantalla apagada, permite que MAPE se ejecute sin restricciones de batería.',
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Permitir',
            onPress: () => {
              IntentLauncher.startActivityAsync(
                'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                { data: `package:${PACKAGE}` },
              ).catch(() => {
                // Fallback: abrir la lista de optimización de batería.
                IntentLauncher.startActivityAsync(
                  'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
                ).catch(() => {});
              });
            },
          },
        ],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
