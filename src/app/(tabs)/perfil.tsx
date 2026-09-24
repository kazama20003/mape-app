import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveDot } from '@/components/mape/anim';
import { Avatar } from '@/components/mape/avatar';
import { Icon, type IconName } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { useAlertMetrics, useUnitsSummary } from '@/features/data/hooks';
import { mediaUrl } from '@/lib/api';

const SHIFT_LABEL: Record<string, string> = {
  MANANA: 'Turno mañana',
  TARDE: 'Turno tarde',
  NOCHE: 'Turno noche',
};

type Row = {
  icon: IconName;
  title: string;
  sub: string;
  route: '/cuenta' | '/ajustes' | '/notificaciones' | '/chat' | '/inicio';
  danger?: boolean;
};

const ROWS: Row[] = [
  { icon: 'user', title: 'Mi cuenta', sub: 'Datos personales y contraseña', route: '/cuenta' },
  { icon: 'bell', title: 'Notificaciones', sub: 'Alertas críticas, chat y radio', route: '/notificaciones' },
  { icon: 'sliders', title: 'Ajustes de la app', sub: 'Mapa, radio, tema y permisos', route: '/ajustes' },
  { icon: 'clock', title: 'Ayuda y soporte', sub: 'Chat con soporte de Mape', route: '/chat' },
  { icon: 'arrowRight', title: 'Cerrar sesión', sub: 'Salir de esta cuenta', route: '/inicio', danger: true },
];

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const summary = useUnitsSummary();
  const metrics = useAlertMetrics();

  const handleRow = async (route: Row['route']) => {
    if (route === '/inicio') {
      await signOut();
      router.replace('/inicio');
      return;
    }
    router.push(route);
  };

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      <Animated.View style={styles.header} entering={fade(0)}>
        <Text style={styles.title}>Perfil</Text>
        <PressableScale
          style={styles.editBtn}
          onPress={() => router.push('/cuenta')}
          accessibilityLabel="Editar perfil">
          <Icon name="user" size={20} color={Mape.white} strokeWidth={1.8} />
        </PressableScale>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        {/* Tarjeta de perfil */}
        <Animated.View style={styles.profileCard} entering={rise(1)}>
          <Avatar
            variant="me"
            uri={mediaUrl(user?.avatarKey)}
            size={68}
            radius={34}
            borderWidth={3}
            borderColor={Mape.white}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
            <Text style={styles.profileRole}>
              {user?.positionTitle ?? (user?.role === 'SUPERVISOR' ? 'Supervisor' : 'Operador')}
            </Text>
            <View style={styles.shiftBadge}>
              <LiveDot size={6} color={Mape.white} />
              <Text style={styles.shiftText}>
                {SHIFT_LABEL[user?.shift ?? 'MANANA'] ?? 'Turno mañana'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Métricas */}
        <Animated.View style={styles.stats} entering={rise(2)}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{summary.data?.total ?? 0}</Text>
            <Text style={styles.statLabel}>Unidades</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{summary.data?.enRuta ?? 0}</Text>
            <Text style={styles.statLabel}>En ruta</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: Mape.redDark }]}>
              {metrics.data?.pendientes ?? 0}
            </Text>
            <Text style={styles.statLabel}>Alertas</Text>
          </View>
        </Animated.View>

        {/* Menú */}
        <Animated.View style={styles.menu} entering={rise(3)}>
          {(user?.role === 'ADMIN' || user?.role === 'SUPERVISOR') && (
            <PressableScale
              style={styles.row}
              onPress={() => router.push('/admin-usuarios')}>
              <View style={styles.rowIcon}>
                <Icon name="userPlus" size={20} color={Mape.ink} strokeWidth={1.8} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Administrar usuarios</Text>
                <Text style={styles.rowSub}>Accesos, roles, apelativos y fotos</Text>
              </View>
              <Icon name="chevronRight" size={18} color="#9A9A9A" strokeWidth={2} />
            </PressableScale>
          )}
          {ROWS.map((r) => (
            <PressableScale
              key={r.title}
              style={styles.row}
              onPress={() => handleRow(r.route)}>
              <View style={[styles.rowIcon, r.danger && styles.rowIconDanger]}>
                <Icon name={r.icon} size={20} color={r.danger ? Mape.redDark : Mape.ink} strokeWidth={1.8} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, r.danger && { color: Mape.redDark }]}>{r.title}</Text>
                <Text style={styles.rowSub}>{r.sub}</Text>
              </View>
              <Icon name="chevronRight" size={18} color="#9A9A9A" strokeWidth={2} />
            </PressableScale>
          ))}
        </Animated.View>

        <Text style={styles.version}>Mape v1.0 · Última sincronización hace 3 s</Text>
      </ScrollView>

    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontFamily: Font.medium, letterSpacing: -0.8, color: Mape.ink },
  editBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    marginTop: 18,
    backgroundColor: Mape.ink,
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileInfo: { flex: 1, gap: 4, minWidth: 0 },
  profileName: { fontSize: 20, fontFamily: Font.semibold, letterSpacing: -0.4, color: Mape.white },
  profileRole: { fontSize: 13, color: Mape.textOnDarkSoft, fontFamily: Font.regular },
  shiftBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Mape.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shiftText: { fontSize: 11, fontFamily: Font.bold, color: Mape.white },

  stats: { marginTop: 10, flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: Mape.white, borderRadius: 20, padding: 12, paddingHorizontal: 14, gap: 2 },
  statNum: { fontSize: 22, fontFamily: Font.semibold, letterSpacing: -0.6, color: Mape.ink },
  statLabel: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },

  menu: { marginTop: 14, gap: 8 },
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
  version: { marginTop: 12, textAlign: 'center', fontSize: 12, color: '#9A9A9A', fontFamily: Font.regular },
});
