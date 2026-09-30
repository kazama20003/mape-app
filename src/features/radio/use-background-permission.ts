import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import { storage, StorageKeys } from '@/lib/storage';
import { isIgnoringBatteryOptimizations } from '@/features/radio/keep-alive';

const isExpoGo = Constants.appOwnership === 'expo';
const PACKAGE = 'com.mape.app';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ¿El equipo es Xiaomi/Redmi/Poco (MIUI/HyperOS)? Ahí el Autostart es lo que
 *  de verdad evita que maten la app al cerrarla desde "recientes". */
export function isMiui(): boolean {
  const m = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  return /xiaomi|redmi|poco/.test(m);
}

/** Abre los ajustes para eximir la app de la optimización de batería. */
export function openBatterySettings() {
  IntentLauncher.startActivityAsync(
    'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    { data: `package:${PACKAGE}` },
  ).catch(() => {
    IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    ).catch(() => {});
  });
}

/** Abre el gestor de Inicio automático (Autostart) de MIUI. */
export function openMiuiAutostart() {
  IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
    packageName: 'com.miui.securitycenter',
    className: 'com.miui.permcenter.autostart.AutoStartManagementActivity',
  }).catch(() => {
    IntentLauncher.startActivityAsync(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: `package:${PACKAGE}` },
    ).catch(() => {});
  });
}

function ask(title: string, message: string, okText: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Pide los permisos para que la radio sobreviva en segundo plano. La batería se
 * pide según el ESTADO REAL (isIgnoringBatteryOptimizations): mientras no esté
 * concedido, se ofrece en cada inicio (no depende de marcas guardadas). El
 * Autostart de MIUI —que no tiene API para consultarse— se ofrece una vez.
 */
export function useBackgroundPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || isExpoGo) return;
    let cancelled = false;
    void (async () => {
      // Respiro para no chocar con los diálogos nativos del arranque
      // (micrófono/notificaciones).
      await delay(1500);
      if (cancelled) return;

      // 1) Batería: solo si de verdad falta.
      const ignoring = await isIgnoringBatteryOptimizations();
      if (!ignoring && !cancelled) {
        const ok = await ask(
          'Evitar que se cierre la radio',
          'Para que la radio siga sonando con la pantalla apagada, permite que MAPE se ejecute sin restricciones de batería.',
          'Permitir',
        );
        if (cancelled) return;
        if (ok) openBatterySettings();
        await delay(600);
        if (cancelled) return;
      }

      // 2) Autostart (MIUI), una sola vez.
      const autostartAsked = await storage.get(StorageKeys.autostartAsked);
      if (isMiui() && !autostartAsked && !cancelled) {
        await storage.set(StorageKeys.autostartAsked, '1');
        const ok = await ask(
          'Activar Inicio automático',
          'En este teléfono (MIUI) la radio puede cerrarse sola. Activa "Inicio automático" para MAPE y así no se cierre al apagar la pantalla o sacarla de Recientes.',
          'Abrir ajustes',
        );
        if (cancelled) return;
        if (ok) openMiuiAutostart();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
