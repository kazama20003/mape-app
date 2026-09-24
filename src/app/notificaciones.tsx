import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/mape/bottom-nav';
import { Icon, type IconName } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/features/data/hooks';
import type { NotificationPrefKey } from '@/lib/types';

type Pref = { icon: IconName; title: string; sub: string; key: NotificationPrefKey; danger?: boolean };

const CANALES: Pref[] = [
  { icon: 'bell', title: 'Alertas críticas', sub: 'Frenadas bruscas, desvíos y SOS', key: 'criticalAlerts', danger: true },
  { icon: 'chat', title: 'Mensajes de chat', sub: 'Nuevos mensajes de operadores y grupos', key: 'chatMessages' },
  { icon: 'radio', title: 'Transmisiones de radio', sub: 'Aviso al recibir una llamada PTT', key: 'radioBroadcasts' },
  { icon: 'truck', title: 'Estado de unidades', sub: 'Entradas y salidas de ruta', key: 'unitStatus' },
];

const RESUMEN: Pref[] = [
  { icon: 'clock', title: 'Resumen diario', sub: 'Reporte de la flota cada mañana', key: 'dailyDigest' },
  { icon: 'speaker', title: 'Sonido y vibración', sub: 'Tono al llegar una notificación', key: 'soundVibration' },
];

export default function NotificacionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: prefs, isLoading } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const toggle = (k: NotificationPrefKey) => {
    if (!prefs) return;
    update.mutate({ [k]: !prefs[k] });
  };

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/perfil')}
          accessibilityLabel="Volver al perfil">
          <Icon name="chevronLeft" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Notificaciones</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* No molestar */}
        <Animated.View style={styles.dndCard} entering={rise(1)}>
          <View style={styles.dndIcon}>
            <Icon name="clock" size={22} color={Mape.white} strokeWidth={1.8} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.dndTitle}>No molestar</Text>
            <Text style={styles.dndSub}>Silencia todo excepto alertas críticas</Text>
          </View>
          <Pressable
            onPress={() => prefs && update.mutate({ doNotDisturb: !prefs.doNotDisturb })}
            style={[styles.toggle, prefs?.doNotDisturb ? styles.toggleOnRed : styles.toggleOffDark]}>
            <View style={styles.toggleKnob} />
          </Pressable>
        </Animated.View>

        {isLoading ? (
          <ActivityIndicator color={Mape.ink} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Text style={styles.section}>Canales</Text>
            <Animated.View style={styles.group} entering={rise(2)}>
              {CANALES.map((p) => (
                <ToggleRow key={p.key} p={p} value={!!prefs?.[p.key]} onToggle={() => toggle(p.key)} />
              ))}
            </Animated.View>

            <Text style={styles.section}>Resumen y sonido</Text>
            <Animated.View style={styles.group} entering={rise(3)}>
              {RESUMEN.map((p) => (
                <ToggleRow key={p.key} p={p} value={!!prefs?.[p.key]} onToggle={() => toggle(p.key)} />
              ))}
            </Animated.View>
          </>
        )}
      </ScrollView>

      <BottomNav active="perfil" />
    </Screen>
  );
}

function ToggleRow({ p, value, onToggle }: { p: Pref; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={[styles.rowIcon, p.danger && styles.rowIconDanger]}>
        <Icon name={p.icon} size={20} color={p.danger ? Mape.redDark : Mape.ink} strokeWidth={1.8} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{p.title}</Text>
        <Text style={styles.rowSub}>{p.sub}</Text>
      </View>
      <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}>
        <View style={styles.toggleKnob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontFamily: Font.medium, letterSpacing: -0.7, color: Mape.ink },

  dndCard: {
    marginTop: 18,
    backgroundColor: Mape.ink,
    borderRadius: 24,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dndIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Mape.panelDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dndTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.white },
  dndSub: { fontSize: 12, color: Mape.textOnDarkSoft, fontFamily: Font.regular },

  section: { marginTop: 16, fontSize: 13, color: Mape.textFaint, paddingLeft: 4, fontFamily: Font.regular },
  group: { marginTop: 8, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: Mape.white,
    borderRadius: 20,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: Mape.redSoftBg },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  rowSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },

  toggle: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: Mape.ink, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: Mape.border, alignItems: 'flex-start' },
  toggleOnRed: { backgroundColor: Mape.red, alignItems: 'flex-end' },
  toggleOffDark: { backgroundColor: Mape.panelBorder, alignItems: 'flex-start' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: Mape.white },
});
