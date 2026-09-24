import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/mape/bottom-nav';
import { Icon, type IconName } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import {
  useSettings,
  type Settings,
  type UpdateFreq,
} from '@/features/settings/settings-context';

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];
type Setting = { icon: IconName; title: string; sub: string; key: BoolKey };

const MAPA: Setting[] = [
  { icon: 'pin', title: 'Ubicación en tiempo real', sub: 'Compartir mi posición con el equipo', key: 'shareLocation' },
  { icon: 'layers', title: 'Mapa de tránsito', sub: 'Mostrar rutas principales en el inicio', key: 'transitMap' },
];
const RADIO: Setting[] = [
  { icon: 'speaker', title: 'Sonido de radio', sub: 'Reproducir transmisiones al entrar al canal', key: 'radioSound' },
  { icon: 'bell', title: 'Alertas críticas', sub: 'Vibrar aunque el teléfono esté en silencio', key: 'criticalAlerts' },
  { icon: 'clock', title: 'Modo oscuro', sub: 'Tema oscuro de la app', key: 'darkMode' },
];

const FREQS: { key: UpdateFreq; label: string; short: string }[] = [
  { key: 'realtime', label: 'Tiempo real', short: 'cada 5 s' },
  { key: '30s', label: '30 s', short: 'cada 30 s' },
  { key: '1min', label: '1 min', short: 'cada 1 min' },
];

export default function AjustesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const freq = FREQS.find((f) => f.key === settings.updateFreq) ?? FREQS[0];

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/perfil')}
          accessibilityLabel="Volver al perfil">
          <Icon name="chevronLeft" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Ajustes</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Frecuencia */}
        <Animated.View style={styles.freqCard} entering={rise(1)}>
          <View style={styles.freqTop}>
            <Text style={styles.freqTitle}>Frecuencia de actualización</Text>
            <Text style={styles.freqValue}>{freq.short}</Text>
          </View>
          <View style={styles.freqOptions}>
            {FREQS.map((f) => {
              const active = f.key === settings.updateFreq;
              return (
                <PressableScale
                  key={f.key}
                  onPress={() => update('updateFreq', f.key)}
                  style={[styles.freqChip, active && styles.freqChipActive]}>
                  <Text style={[styles.freqChipText, active && styles.freqChipTextActive]}>
                    {f.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        <Text style={styles.section}>Mapa y ubicación</Text>
        <Animated.View style={styles.group} entering={rise(2)}>
          {MAPA.map((s) => (
            <ToggleRow
              key={s.key}
              s={s}
              value={settings[s.key]}
              onToggle={() => update(s.key, !settings[s.key])}
            />
          ))}
        </Animated.View>

        <Text style={styles.section}>Radio y notificaciones</Text>
        <Animated.View style={styles.group} entering={rise(3)}>
          {RADIO.map((s) => (
            <ToggleRow
              key={s.key}
              s={s}
              value={settings[s.key]}
              onToggle={() => update(s.key, !settings[s.key])}
            />
          ))}
        </Animated.View>
      </ScrollView>

      <BottomNav active="perfil" />
    </Screen>
  );
}

function ToggleRow({ s, value, onToggle }: { s: Setting; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={styles.rowIcon}>
        <Icon name={s.icon} size={20} color={Mape.ink} strokeWidth={1.8} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{s.title}</Text>
        <Text style={styles.rowSub}>{s.sub}</Text>
      </View>
      <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}>
        <View style={[styles.toggleKnob, value ? styles.knobRight : styles.knobLeft]} />
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

  freqCard: { marginTop: 18, backgroundColor: Mape.ink, borderRadius: 24, padding: 16, paddingHorizontal: 18, gap: 12 },
  freqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freqTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.white },
  freqValue: { fontSize: 13, fontFamily: Font.bold, color: Mape.red },
  track: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackFill: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Mape.red },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: Mape.white, borderWidth: 3, borderColor: Mape.red },
  trackRest: { flex: 3, height: 6, borderRadius: 3, backgroundColor: Mape.panelBorder },
  freqLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  freqLabel: { fontSize: 11, color: Mape.textOnDarkSoft, fontFamily: Font.regular },
  freqOptions: { flexDirection: 'row', gap: 8 },
  freqChip: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    backgroundColor: Mape.panelDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqChipActive: { backgroundColor: Mape.red },
  freqChipText: { fontSize: 13, color: Mape.white, fontFamily: Font.medium },
  freqChipTextActive: { fontFamily: Font.semibold },

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
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  rowSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },
  toggle: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: Mape.ink, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: Mape.border, alignItems: 'flex-start' },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: Mape.white },
  knobLeft: {},
  knobRight: {},
});
