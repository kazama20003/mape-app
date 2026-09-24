import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { storage } from '@/lib/storage';

const SETTINGS_KEY = 'mape.settings';

export type UpdateFreq = 'realtime' | '30s' | '1min';

export interface Settings {
  /** Compartir mi ubicación con el equipo (operadores). */
  shareLocation: boolean;
  /** Mostrar mapa de tránsito en el inicio. */
  transitMap: boolean;
  /** Reproducir por altavoz las transmisiones de radio al entrar. */
  radioSound: boolean;
  /** Vibrar en alertas críticas aunque esté en silencio. */
  criticalAlerts: boolean;
  /** Modo oscuro. */
  darkMode: boolean;
  /** Frecuencia de actualización del mapa. */
  updateFreq: UpdateFreq;
}

export const DEFAULT_SETTINGS: Settings = {
  shareLocation: true,
  transitMap: true,
  radioSound: true,
  criticalAlerts: true,
  darkMode: false,
  updateFreq: 'realtime',
};

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Provee la configuración persistida en el almacenamiento local del teléfono. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  // Carga inicial desde el dispositivo.
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.get(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>;
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // configuración corrupta o inexistente: usamos defaults
      } finally {
        loadedRef.current = true;
        setLoaded(true);
      }
    })();
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loaded,
      update: (key, val) => {
        setSettings((prev) => {
          const next = { ...prev, [key]: val };
          // Persiste en el teléfono (no bloqueamos la UI).
          void storage.set(SETTINGS_KEY, JSON.stringify(next));
          return next;
        });
      },
    }),
    [settings, loaded],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
}
