import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import { storage, StorageKeys } from '@/lib/storage';

const isExpoGo = Constants.appOwnership === 'expo';
const PACKAGE = 'com.mape.app';

/** ¿El equipo es Xiaomi/Redmi/Poco (MIUI/HyperOS)? Ahí el Autostart es lo que
 *  de verdad evita que maten la app al cerrarla desde "recientes". */
function isMiui(): boolean {
  const m = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  return /xiaomi|redmi|poco/.test(m);
}

/** Abre el gestor de Inicio automático (Autostart) de MIUI. Tolerante a fallos:
 *  si el componente no existe (otro fabricante), no hace nada. */
function openMiuiAutostart() {
  IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
    packageName: 'com.miui.securitycenter',
    className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
  }).catch(() => {
    // Fallback: pantalla de detalles de la app (permisos de inicio ahí).
    IntentLauncher.startActivityAsync(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: `package:${PACKAGE}` },
    ).catch(() => {});
  });
}

/** Pide (una vez) el Autostart en MIUI, tras el diálogo de batería. */
async function maybeAskAutostart() {
  if (!isMiui()) return;
  const asked = await storage.get(StorageKeys.autostartAsked);
  if (asked) return;
  await storage.set(StorageKeys.autostartAsked, '1');
  Alert.alert(
    'Activar Inicio automático',
    'En este teléfono (MIUI) la radio puede dejar de sonar si el sistema cierra la app. Activa "Inicio automático" para MAPE y así no se cierre al apagar la pantalla.',
    [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir ajustes', onPress: openMiuiAutostart },
    ],
  );
}

/**
 * Pide (una vez) permiso para ejecutar la app SIN restricciones de batería, así
 * el SO no la mata en segundo plano y la radio/ubicación siguen funcionando con
 * la pantalla apagada. En equipos MIUI ofrece además el Inicio automático, que
 * es lo que evita el cierre al deslizar la app fuera de "recientes".
 */
export function useBackgroundPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || isExpoGo) return;
    let cancelled = false;
    void (async () => {
      const asked = await storage.get(StorageKeys.bgPermAsked);
      if (asked || cancelled) {
        // Aunque ya se pidió batería, puede faltar el Autostart de MIUI.
        if (!cancelled) await maybeAskAutostart();
        return;
      }
      await storage.set(StorageKeys.bgPermAsked, '1');
      Alert.alert(
        'Permitir en segundo plano',
        'Para que la radio y la ubicación sigan funcionando con la pantalla apagada, permite que MAPE se ejecute sin restricciones de batería.',
        [
          {
            text: 'Ahora no',
            style: 'cancel',
            onPress: () => void maybeAskAutostart(),
          },
          {
            text: 'Permitir',
            onPress: () => {
              IntentLauncher.startActivityAsync(
                'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
                { data: `package:${PACKAGE}` },
              )
                .catch(() => {
                  // Fallback: abrir la lista de optimización de batería.
                  return IntentLauncher.startActivityAsync(
                    'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
                  );
                })
                .catch(() => {})
                .finally(() => void maybeAskAutostart());
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
