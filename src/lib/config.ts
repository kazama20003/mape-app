import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resuelve la URL del backend. Prioridad:
 *  1. EXPO_PUBLIC_API_URL  (producción / internet / túnel)
 *  2. IP del host de Metro (desarrollo en teléfono físico dentro de la LAN)
 *  3. Ajuste por plataforma cuando el host es localhost:
 *       - Emulador Android → 10.0.2.2 (alias del host desde el emulador)
 *       - iOS / web        → localhost
 *
 * El backend expone REST bajo `/api` y los WebSockets en la raíz (namespaces).
 */
function metroHostIp(): string | null {
  const c = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };
  const hostUri =
    c.expoConfig?.hostUri ??
    c.expoGoConfig?.debuggerHost ??
    c.manifest?.debuggerHost ??
    c.manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) return null;
  const host = String(hostUri).split(':')[0].trim();
  return host || null;
}

function resolveOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (explicit) return explicit;

  const ip = metroHostIp();
  const isLocal = !ip || ip === 'localhost' || ip === '127.0.0.1';

  if (isLocal) {
    // Sin IP de LAN detectable: usa el alias correcto por plataforma.
    if (Platform.OS === 'android') return 'http://10.0.2.2:3040';
    return 'http://localhost:3040';
  }
  return `http://${ip}:3040`;
}

export const API_ORIGIN = resolveOrigin();
export const API_BASE = `${API_ORIGIN}/api`;
export const WS_ORIGIN = API_ORIGIN;
