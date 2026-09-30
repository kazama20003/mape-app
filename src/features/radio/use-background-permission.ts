import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';

import { storage, StorageKeys } from '@/lib/storage';

const isExpoGo = Constants.appOwnership === 'expo';
const PACKAGE = 'com.mape.app';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ¿El equipo es Xiaomi/Redmi/Poco (MIUI/HyperOS)? Ahí el Autostart es lo que
 *  de verdad evita que maten la app al cerrarla desde "recientes". */
function isMiui(): boolean {
  const m = `${Device.manufacturer ?? ''} ${Device.brand ?? ''}`.toLowerCase();
  return /xiaomi|redmi|poco/.test(m);
}

/** Muestra un Alert y resuelve cuando el usuario elige una opción. */
function ask(title: string, message: string, okText: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, onPress: () => resolve(true) },
    ]);
  });
}

/** Abre los ajustes de batería sin restricciones para la app. */
function openBatterySettings() {
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
function openMiuiAutostart() {
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

/**
 * Pide (una vez, al iniciar sesión) los permisos para que la app sobreviva en
 * segundo plano: batería sin restricciones y, en equipos MIUI, Inicio
 * automático. Se piden en SECUENCIA y con un pequeño respiro para no chocar con
 * los diálogos nativos (micrófono/notificaciones) que salen al abrir la app, y
 * así aparezcan desde el primer inicio (no solo al reabrir).
 */
export function useBackgroundPermission(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android' || isExpoGo) return;
    let cancelled = false;
    void (async () => {
      // Deja que terminen los diálogos nativos de permisos del arranque.
      await delay(1200);
      if (cancelled) return;

      // 1) Batería sin restricciones.
      const batteryAsked = await storage.get(StorageKeys.bgPermAsked);
      if (!batteryAsked && !cancelled) {
        await storage.set(StorageKeys.bgPermAsked, '1');
        const ok = await ask(
          'Permitir en segundo plano',
          'Para que la radio y la ubicación sigan funcionando con la pantalla apagada, permite que MAPE se ejecute sin restricciones de batería.',
          'Permitir',
        );
        if (cancelled) return;
        if (ok) openBatterySettings();
        // Espacio entre un ajuste y el siguiente.
        await delay(600);
        if (cancelled) return;
      }

      // 2) Inicio automático (solo MIUI), es lo que evita el cierre al sacar la
      //    app de "recientes".
      const autostartAsked = await storage.get(StorageKeys.autostartAsked);
      if (isMiui() && !autostartAsked && !cancelled) {
        await storage.set(StorageKeys.autostartAsked, '1');
        const ok = await ask(
          'Activar Inicio automático',
          'En este teléfono (MIUI) la radio puede dejar de sonar si el sistema cierra la app. Activa "Inicio automático" para MAPE y así no se cierre al apagar la pantalla.',
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
