import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { DashRoute, FloatView, LiveDot } from '@/components/mape/anim';
import { Avatar } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useUnit } from '@/features/data/hooks';
import type { RouteStop, UnitStatus } from '@/lib/types';

const STATUS_LABEL: Record<UnitStatus, string> = {
  EN_RUTA: 'En ruta',
  DETENIDO: 'Detenido',
  DISPONIBLE: 'Disponible',
  DESCONECTADO: 'Desconectado',
  MANTENIMIENTO: 'Mantenimiento',
};

const STOP_SUB: Record<RouteStop['kind'], string> = {
  ORIGEN: 'Origen',
  PARADA: 'Parada',
  PEAJE: 'Peaje',
  DESTINO: 'Destino',
};

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DetalleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { data: unit } = useUnit(unitId);

  const route = unit?.routes?.[0];
  const stops = route?.stops ?? [];
  const pendientes = stops.filter(
    (s) => s.status !== 'COMPLETADA' && s.status !== 'OMITIDA',
  ).length;
  const speed = unit?.lastSpeedKmh != null ? String(Math.round(unit.lastSpeedKmh)) : '--';
  const statusLabel = unit ? STATUS_LABEL[unit.status] : '—';

  const stats = [
    { label: 'Velocidad', value: speed, unit: 'km/h' },
    { label: 'Paradas', value: String(stops.length), unit: stops.length === 1 ? 'parada' : 'paradas' },
    { label: 'Pendientes', value: String(pendientes), unit: pendientes === 1 ? 'parada' : 'paradas' },
  ];

  const opName = unit?.operator?.name ?? 'Sin operador asignado';
  const unitLine = unit
    ? `Unidad ${unit.code}${unit.brand ? ` · ${unit.brand}` : ''}${unit.model ? ` ${unit.model}` : ''} · Placa ${unit.plate}`
    : 'Cargando unidad…';

  const cargoTitle = route?.cargoDescription
    ? `Carga: ${route.cargoDescription}` +
      (route.cargoPallets ? ` · ${route.cargoPallets} pallets` : '') +
      (route.cargoWeightTons ? ` · ${route.cargoWeightTons} t` : '')
    : 'Sin carga registrada';
  const cargoSub = route?.guiaRemision
    ? `Guía de remisión ${route.guiaRemision}`
    : 'Sin guía de remisión';

  return (
    <Screen style={styles.root} transition="push">
      {/* Cabecera oscura */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 20 }]} entering={fade(0)}>
        <View style={styles.headerTop}>
          <PressableScale
            style={styles.headBtn}
            onPress={() => router.navigate('/mapa')}
            accessibilityLabel="Volver al mapa">
            <Icon name="chevronLeft" size={20} color={Mape.white} />
          </PressableScale>
          <Text style={styles.headTitle}>Detalle del operador</Text>
          <PressableScale style={styles.headBtn} accessibilityLabel="Más opciones">
            <Icon name="sliders" size={20} color={Mape.white} strokeWidth={1.8} />
          </PressableScale>
        </View>

        <View style={styles.opRow}>
          <Avatar variant="meLight" size={68} radius={34} borderWidth={3} borderColor={Mape.white} />
          <View style={styles.opInfo}>
            <Text style={styles.opName}>{opName}</Text>
            <Text style={styles.opUnit}>{unitLine}</Text>
            <View style={styles.opBadge}>
              <LiveDot size={7} color={Mape.white} />
              <Text style={styles.opBadgeText}>
                {statusLabel}
                {speed !== '--' ? ` · ${speed} km/h` : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <PressableScale style={styles.actionRed} onPress={() => router.navigate('/radio')}>
            <Icon name="mic" size={18} color={Mape.white} />
            <Text style={styles.actionRedText}>Radio</Text>
          </PressableScale>
          <PressableScale style={styles.actionWhite} onPress={() => router.push('/chat')}>
            <Icon name="chat" size={18} color={Mape.ink} />
            <Text style={styles.actionWhiteText}>Chat</Text>
          </PressableScale>
          <PressableScale style={styles.headBtn} accessibilityLabel="Llamar">
            <Icon name="mic" size={18} color={Mape.white} strokeWidth={1.8} />
          </PressableScale>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24, gap: 12 }}>
        {/* Métricas */}
        <Animated.View style={styles.stats} entering={rise(1)}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>
                {s.value}
                <Text style={styles.statUnit}> {s.unit}</Text>
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Mini mapa */}
        <Animated.View style={styles.map} entering={rise(2)}>
          <Svg width="100%" height="100%" viewBox="0 0 342 150" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
            <Rect width={342} height={150} fill="#E7E7E7" />
            <G fill="#DADADA">
              <Rect x={16} y={16} width={80} height={44} rx={6} />
              <Rect x={112} y={16} width={60} height={44} rx={6} />
              <Rect x={190} y={16} width={136} height={44} rx={6} />
              <Rect x={16} y={82} width={80} height={52} rx={6} />
              <Rect x={112} y={82} width={60} height={52} rx={6} />
              <Rect x={190} y={82} width={136} height={52} rx={6} />
            </G>
            <G stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round">
              <Path d="M0 71h342" />
              <Path d="M104 0v150" />
              <Path d="M181 0v150" />
            </G>
            <DashRoute
              d="M30 128 C 70 128, 90 71, 130 71 S 200 40, 250 44 S 300 30, 320 24"
              stroke={Mape.red}
              strokeWidth={3.5}
              dashArray="8 7"
            />
            <Circle cx={30} cy={128} r={6} fill="#E7E7E7" stroke={Mape.ink} strokeWidth={3} />
            <Circle cx={320} cy={24} r={7} fill={Mape.red} stroke="#FFFFFF" strokeWidth={2.5} />
          </Svg>
          <FloatView style={styles.mapPin}>
            <Avatar variant="meLight" size={40} radius={20} borderWidth={3} borderColor={Mape.white} />
          </FloatView>
          <PressableScale style={styles.mapBtn} onPress={() => router.navigate('/mapa')}>
            <Icon name="pin" size={14} color={Mape.white} />
            <Text style={styles.mapBtnText}>Ver en mapa</Text>
          </PressableScale>
        </Animated.View>

        {/* Ruta de hoy */}
        <Animated.View style={styles.routeCard} entering={rise(3)}>
          <View style={styles.routeHead}>
            <Text style={styles.routeTitle}>{route ? `Ruta ${route.code}` : 'Ruta de hoy'}</Text>
            <Text style={styles.routeMeta}>
              {stops.length} {stops.length === 1 ? 'parada' : 'paradas'} · {pendientes} pendiente
              {pendientes === 1 ? '' : 's'}
            </Text>
          </View>
          {stops.length === 0 ? (
            <Text style={styles.stopSub}>Sin ruta activa asignada.</Text>
          ) : (
            stops.map((s) => {
              const done = s.status === 'COMPLETADA';
              return (
                <View key={s.id} style={styles.stop}>
                  {done ? (
                    <View style={styles.stopDone}>
                      <Icon name="doubleCheck" size={12} color={Mape.white} strokeWidth={2.5} />
                    </View>
                  ) : (
                    <LiveDot size={22} color={Mape.red} style={styles.stopPending} />
                  )}
                  <View style={styles.stopText}>
                    <Text style={styles.stopTitle}>{s.name}</Text>
                    <Text style={styles.stopSub}>{s.address ?? STOP_SUB[s.kind]}</Text>
                  </View>
                  <Text style={styles.stopTime}>{fmtTime(s.arrivedAt ?? s.plannedAt)}</Text>
                </View>
              );
            })
          )}
        </Animated.View>

        {/* Carga */}
        <Animated.View style={styles.cargo} entering={rise(4)}>
          <View style={styles.cargoIcon}>
            <Icon name="truck" size={20} color={Mape.white} strokeWidth={1.8} />
          </View>
          <View style={styles.cargoText}>
            <Text style={styles.cargoTitle}>{cargoTitle}</Text>
            <Text style={styles.cargoSub}>{cargoSub}</Text>
          </View>
          <Icon name="chevronRight" size={18} color={Mape.white} />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg },
  header: {
    backgroundColor: Mape.ink,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: 24,
    paddingBottom: 22,
    gap: 18,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.panelDark,
    borderWidth: 1,
    borderColor: Mape.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontSize: 14, fontFamily: Font.semibold, color: Mape.textOnDarkSoft },

  opRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  opInfo: { flex: 1, gap: 4, minWidth: 0 },
  opName: { fontSize: 22, fontFamily: Font.semibold, letterSpacing: -0.5, color: Mape.white },
  opUnit: { fontSize: 13, color: Mape.textOnDarkSoft, fontFamily: Font.regular },
  opBadge: {
    alignSelf: 'flex-start',
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: Mape.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opBadgeText: { fontSize: 12, fontFamily: Font.bold, color: Mape.white },

  actions: { flexDirection: 'row', gap: 8 },
  actionRed: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionRedText: { fontSize: 14, fontFamily: Font.semibold, color: Mape.white },
  actionWhite: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionWhiteText: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },

  stats: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: Mape.white, borderRadius: 20, padding: 12, paddingHorizontal: 14, gap: 2 },
  statLabel: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },
  statValue: { fontSize: 22, fontFamily: Font.semibold, letterSpacing: -0.6, color: Mape.ink },
  statUnit: { fontSize: 12, fontFamily: Font.medium, color: Mape.textMuted },

  map: { height: 130, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E7E7E7' },
  mapPin: { position: 'absolute', left: 112, top: 44 },
  mapBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapBtnText: { fontSize: 12, fontFamily: Font.semibold, color: Mape.white },

  routeCard: { backgroundColor: Mape.white, borderRadius: 22, padding: 14, paddingHorizontal: 16, gap: 12 },
  routeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  routeMeta: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopPending: { width: 22, height: 22 },
  stopText: { flex: 1, gap: 1, minWidth: 0 },
  stopTitle: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },
  stopSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },
  stopTime: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink },

  cargo: {
    backgroundColor: Mape.ink,
    borderRadius: 22,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cargoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.panelDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cargoText: { flex: 1, gap: 2 },
  cargoTitle: { fontSize: 14, fontFamily: Font.semibold, color: Mape.white },
  cargoSub: { fontSize: 12, color: Mape.textOnDark, fontFamily: Font.regular },
});
