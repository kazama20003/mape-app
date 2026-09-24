import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAlertMetrics, useAlerts } from '@/features/data/hooks';
import { api } from '@/lib/api';
import type { AvatarVariant } from '@/components/mape/avatar';

const FILTERS = ['Todas', 'Velocidad', 'Geocerca'] as const;
const FILTER_TYPE = [undefined, 'EXCESO_VELOCIDAD', 'SALIDA_GEOCERCA'] as const;

function hace(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString();
}

const AVATARS: AvatarVariant[] = ['juan', 'luis', 'carlos', 'rosa'];
function avatarFor(key?: string | null, fallbackIndex = 0): AvatarVariant {
  if (key && (AVATARS as string[]).includes(key)) return key as AvatarVariant;
  return AVATARS[fallbackIndex % AVATARS.length];
}

export default function AlertasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState(0);
  const alertsQuery = useAlerts();
  const metrics = useAlertMetrics();

  const type = FILTER_TYPE[filter];
  const list = (alertsQuery.data ?? []).filter((a) => !type || a.type === type);

  const marcarLeidas = async () => {
    try {
      await api.patch('/alerts/read-all');
      alertsQuery.refetch();
      metrics.refetch();
    } catch {
      // ignora
    }
  };

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      {/* Cabecera */}
      <Animated.View style={styles.header} entering={fade(0)}>
        <Text style={styles.title}>Alertas</Text>
        <PressableScale style={styles.markBtn} onPress={marcarLeidas}>
          <Text style={styles.markText}>Marcar leídas</Text>
        </PressableScale>
      </Animated.View>

      {/* Métricas */}
      <Animated.View style={styles.stats} entering={rise(1)}>
        <View style={[styles.statCard, styles.statRed]}>
          <Text style={styles.statNum}>{metrics.data?.criticas ?? 0}</Text>
          <Text style={styles.statLabelLight}>Críticas</Text>
        </View>
        <View style={[styles.statCard, styles.statDark]}>
          <Text style={styles.statNum}>{metrics.data?.pendientes ?? 0}</Text>
          <Text style={styles.statLabelDark}>Pendientes</Text>
        </View>
        <View style={[styles.statCard, styles.statWhite]}>
          <Text style={styles.statNumDark}>{metrics.data?.hoy ?? 0}</Text>
          <Text style={styles.statLabelMuted}>Hoy</Text>
        </View>
      </Animated.View>

      {/* Filtros */}
      <Animated.View style={styles.filters} entering={rise(2)}>
        {FILTERS.map((f, i) => {
          const active = i === filter;
          return (
            <PressableScale
              key={f}
              onPress={() => setFilter(i)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
            </PressableScale>
          );
        })}
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <Text style={styles.sectionLabel}>
          {alertsQuery.isLoading ? 'Cargando…' : `${list.length} alertas`}
        </Text>

        {!alertsQuery.isLoading && list.length === 0 && (
          <Text style={styles.empty}>No hay alertas por ahora.</Text>
        )}

        {list.map((a, i) => {
          const critical = a.severity === 'CRITICA';
          return (
            <Animated.View
              key={a.id}
              style={[styles.alert, critical && styles.alertCritical]}
              entering={rise(Math.min(3 + i, 6))}>
              <Avatar
                variant={avatarFor(a.operator?.avatarKey, i)}
                size={46}
                radius={23}
                borderWidth={critical ? 2.5 : 0}
                borderColor={Mape.red}
              />
              <View style={styles.alertBody}>
                <View style={styles.alertTopRow}>
                  <Text style={critical ? styles.alertTag : styles.alertTagGray}>
                    {a.title.toUpperCase()}
                  </Text>
                  <Text style={styles.alertTime}>{hace(a.createdAt)}</Text>
                </View>
                <Text style={styles.alertTitle}>
                  {a.operator?.name ?? 'Unidad'} · {a.unit?.code ?? ''}
                  {a.description ? ` — ${a.description}` : ''}
                </Text>
                {a.locationLabel && <Text style={styles.alertSub}>{a.locationLabel}</Text>}
                {critical && (
                  <View style={styles.alertActions}>
                    <PressableScale
                      style={styles.alertBtnRed}
                      onPress={() => router.navigate('/radio')}>
                      <Icon name="mic" size={16} color={Mape.white} />
                      <Text style={styles.alertBtnRedText}>Radio</Text>
                    </PressableScale>
                    <PressableScale
                      style={styles.alertBtnGray}
                      onPress={() => router.navigate('/mapa')}>
                      <Text style={styles.alertBtnGrayText}>Ver en mapa</Text>
                    </PressableScale>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontFamily: Font.medium, letterSpacing: -0.8, color: Mape.ink },
  markBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Mape.white,
    justifyContent: 'center',
  },
  markText: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink },

  stats: { marginTop: 16, flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 20, padding: 14, gap: 4 },
  statRed: { backgroundColor: Mape.red },
  statDark: { backgroundColor: Mape.ink },
  statWhite: { backgroundColor: Mape.white },
  statNum: { fontSize: 28, fontFamily: Font.semibold, letterSpacing: -1, color: Mape.white },
  statNumDark: { fontSize: 28, fontFamily: Font.semibold, letterSpacing: -1, color: Mape.ink },
  statLabelLight: { fontSize: 12, color: '#FFFFFF', opacity: 0.9, fontFamily: Font.regular },
  statLabelDark: { fontSize: 12, color: Mape.textOnDark, fontFamily: Font.regular },
  statLabelMuted: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },

  filters: { marginTop: 16, flexDirection: 'row', gap: 8 },
  filterChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Mape.white,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: Mape.ink },
  filterText: { fontSize: 13, fontFamily: Font.medium, color: Mape.ink },
  filterTextActive: { color: Mape.white, fontFamily: Font.semibold },

  sectionLabel: { marginTop: 18, marginBottom: 8, fontSize: 13, color: Mape.textFaint, paddingLeft: 4, fontFamily: Font.regular },
  empty: { textAlign: 'center', color: Mape.textFaint, fontFamily: Font.regular, marginTop: 24 },

  alert: {
    backgroundColor: Mape.white,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  alertCritical: {
    borderWidth: 1.5,
    borderColor: Mape.red,
  },
  alertBody: { flex: 1, gap: 6, minWidth: 0 },
  alertTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  alertTag: { fontSize: 12, fontFamily: Font.bold, color: Mape.redDark, letterSpacing: 0.5 },
  alertTagGray: { fontSize: 12, fontFamily: Font.bold, color: '#4A4A4A', letterSpacing: 0.5 },
  alertTime: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },
  alertTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  alertSub: { fontSize: 13, color: Mape.textMuted, fontFamily: Font.regular },
  alertActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  alertBtnRed: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: Mape.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertBtnRedText: { fontSize: 13, fontFamily: Font.semibold, color: Mape.white },
  alertBtnGray: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: Mape.bg,
    justifyContent: 'center',
  },
  alertBtnGrayText: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink },
});
