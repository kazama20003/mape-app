import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Font, Mape } from '@/constants/mape-theme';

const isExpoGo = Constants.appOwnership === 'expo';
const sdk = Platform.OS === 'android' ? Number(Platform.Version) : 0;

type Rn = Parameters<typeof PermissionsAndroid.check>[0];
type Perm = { key: Rn; label: string; desc: string };

/**
 * Permisos runtime OBLIGATORIOS para que la app funcione. Se piden al abrir la
 * app (antes del login) y, si falta alguno, se bloquea el acceso hasta que estén
 * todos concedidos. La lista se ajusta a la versión de Android:
 *  - BLUETOOTH_CONNECT solo es permiso runtime en Android 12+ (API 31).
 *  - POST_NOTIFICATIONS solo es permiso runtime en Android 13+ (API 33).
 *
 * Nota: la exención de optimización de batería y el "Autostart" de MIUI NO son
 * permisos runtime (no se pueden pedir con un diálogo estándar), así que NO se
 * bloquean aquí; siguen gestionándose con su aviso propio (useBackgroundPermission).
 */
function requiredPerms(): Perm[] {
  const list: Perm[] = [
    {
      key: 'android.permission.RECORD_AUDIO' as Rn,
      label: 'Micrófono',
      desc: 'Para hablar por la radio (mantener HABLAR).',
    },
    {
      key: 'android.permission.ACCESS_FINE_LOCATION' as Rn,
      label: 'Ubicación',
      desc: 'Para el rastreo en el mapa.',
    },
    {
      key: 'android.permission.CAMERA' as Rn,
      label: 'Cámara',
      desc: 'Para enviar fotos en el chat del canal.',
    },
  ];
  if (sdk >= 31) {
    list.push({
      key: 'android.permission.BLUETOOTH_CONNECT' as Rn,
      label: 'Bluetooth',
      desc: 'Para usar audífonos Bluetooth con la radio.',
    });
  }
  if (sdk >= 33) {
    list.push({
      key: 'android.permission.POST_NOTIFICATIONS' as Rn,
      label: 'Notificaciones',
      desc: 'Para avisos de radio, alertas y mensajes.',
    });
  }
  return list;
}

/**
 * Envuelve la app: no deja pasar hasta que TODOS los permisos obligatorios estén
 * concedidos. Re-verifica al volver del frente (p.ej. tras abrir Ajustes).
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  // Solo bloqueamos en un build nativo de Android. En web o Expo Go (desarrollo)
  // dejamos pasar para no romper el flujo de dev.
  const gateNeeded = Platform.OS === 'android' && !isExpoGo;
  const perms = useRef(requiredPerms()).current;
  const [ready, setReady] = useState(!gateNeeded);
  const [busy, setBusy] = useState(true);
  const [missing, setMissing] = useState<Perm[]>([]);
  // Algún permiso quedó en "No volver a preguntar": ya no se puede pedir por
  // diálogo, hay que ir a Ajustes.
  const [blocked, setBlocked] = useState(false);

  const check = useCallback(async () => {
    if (!gateNeeded) {
      setReady(true);
      setBusy(false);
      return;
    }
    try {
      const miss: Perm[] = [];
      for (const p of perms) {
        const ok = await PermissionsAndroid.check(p.key);
        if (!ok) miss.push(p);
      }
      setMissing(miss);
      if (miss.length === 0) setReady(true);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }, [gateNeeded, perms]);

  const request = useCallback(async () => {
    setBusy(true);
    try {
      const res = await PermissionsAndroid.requestMultiple(perms.map((p) => p.key));
      const miss: Perm[] = [];
      let anyBlocked = false;
      for (const p of perms) {
        const r = res[p.key];
        if (r !== 'granted') {
          miss.push(p);
          if (r === 'never_ask_again') anyBlocked = true;
        }
      }
      setMissing(miss);
      setBlocked(anyBlocked);
      if (miss.length === 0) setReady(true);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }, [perms]);

  // Verifica al montar y cada vez que la app vuelve al frente (al regresar de
  // Ajustes, para desbloquear en cuanto el usuario conceda lo que faltaba).
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (ready) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Permisos necesarios</Text>
        <Text style={styles.subtitle}>
          Para que la radio y el rastreo funcionen, la app necesita estos permisos.
          Concédelos para continuar.
        </Text>

        <View style={styles.list}>
          {perms.map((p) => {
            const pending = missing.some((m) => m.key === p.key) || busy;
            return (
              <View key={String(p.key)} style={styles.row}>
                <View
                  style={[styles.dot, !pending ? styles.dotOk : styles.dotPending]}
                />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{p.label}</Text>
                  <Text style={styles.rowDesc}>{p.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {blocked ? (
          <>
            <Text style={styles.hint}>
              Bloqueaste algún permiso. Ábrelo manualmente en Ajustes › Permisos y
              vuelve a la app.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.85}
              onPress={() => Linking.openSettings()}>
              <Text style={styles.btnText}>Abrir Ajustes</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.btn, busy && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={busy}
            onPress={request}>
            {busy ? (
              <ActivityIndicator color={Mape.white} />
            ) : (
              <Text style={styles.btnText}>Conceder permisos</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Mape.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  title: {
    fontFamily: Font.bold,
    fontSize: 26,
    color: Mape.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: Font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Mape.textMuted,
    marginBottom: 28,
  },
  list: { marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, marginRight: 14 },
  dotOk: { backgroundColor: '#22A45D' },
  dotPending: { backgroundColor: Mape.red },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: Font.semibold, fontSize: 16, color: Mape.ink },
  rowDesc: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Mape.textMuted,
    marginTop: 2,
  },
  hint: {
    fontFamily: Font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Mape.redDark,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: Mape.ink,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontFamily: Font.semibold, fontSize: 16, color: Mape.white },
});
