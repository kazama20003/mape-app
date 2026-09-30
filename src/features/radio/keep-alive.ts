import { NativeModules, Platform } from 'react-native';

/**
 * Puente al foreground service nativo (tipo "micrófono") que mantiene vivo el
 * proceso mientras se está en la radio, sin tocar el ruteo de audio (a diferencia
 * de un keepalive por media/A2DP, que rompía el Bluetooth). Ver
 * android/.../RadioKeepAliveService.kt. Tolerante a fallos: si el módulo no está
 * (dev/web/Expo Go), no hace nada.
 */
type RadioKeepAliveNative = {
  start: () => void;
  stop: () => void;
};

const native: RadioKeepAliveNative | undefined =
  Platform.OS === 'android'
    ? (NativeModules.RadioKeepAlive as RadioKeepAliveNative | undefined)
    : undefined;

export function startKeepAliveService() {
  try {
    native?.start();
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
