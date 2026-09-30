import { NativeModules, Platform } from 'react-native';

/**
 * Puente al foreground service nativo (tipo "micrófono") que mantiene vivo el
 * proceso mientras se está en la radio, sin tocar el ruteo de audio (a diferencia
 * de un keepalive por media/A2DP, que rompía el Bluetooth). Ver
 * android/.../RadioKeepAliveService.kt. Tolerante a fallos: si el módulo no está
 * (dev/web/Expo Go), no hace nada.
 */
type RadioKeepAliveNative = {
  start: (channel?: string, status?: string) => void;
  update: (channel?: string, status?: string) => void;
  stop: () => void;
  boostCommunicationVolume: () => void;
  getCommunicationVolume: () => Promise<number>;
  setCommunicationVolume: (fraction: number) => void;
  isIgnoringBatteryOptimizations: () => Promise<boolean>;
};

const native: RadioKeepAliveNative | undefined =
  Platform.OS === 'android'
    ? (NativeModules.RadioKeepAlive as RadioKeepAliveNative | undefined)
    : undefined;

if (Platform.OS === 'android' && !native) {
  // Diagnóstico: si esto aparece, el módulo nativo no quedó registrado.
  console.warn('[KeepAlive] módulo nativo RadioKeepAlive NO disponible');
}

export function startKeepAliveService(channel?: string, status?: string) {
  try {
    native?.start(channel, status);
  } catch {
    /* noop */
  }
}

/** Actualiza el canal/estado que muestra la notificación persistente. */
export function updateKeepAliveNotification(channel: string, status: string) {
  try {
    native?.update(channel, status);
  } catch {
    /* noop */
  }
}

/** Sube al máximo el volumen del audio en vivo (stream de comunicación). */
export function boostCommunicationVolume() {
  try {
    native?.boostCommunicationVolume();
  } catch {
    /* noop */
  }
}

/** Volumen actual del audio en vivo como fracción 0..1 (para el slider). */
export async function getCommunicationVolume(): Promise<number> {
  try {
    const v = await native?.getCommunicationVolume();
    return typeof v === 'number' ? v : 1;
  } catch {
    return 1;
  }
}

/** Fija el volumen del audio en vivo (fracción 0..1) desde el slider. */
export function setCommunicationVolume(fraction: number) {
  try {
    native?.setCommunicationVolume(fraction);
  } catch {
    /* noop */
  }
}

export function stopKeepAliveService() {
  try {
    native?.stop();
  } catch {
    /* noop */
  }
}

/** ¿La app está exenta de optimización de batería? (true si no sabemos). */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  try {
    if (!native) return true;
    return await native.isIgnoringBatteryOptimizations();
  } catch {
    return true;
  }
}
