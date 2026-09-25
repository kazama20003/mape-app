import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import Animated from 'react-native-reanimated';

import { LiveDot } from '@/components/mape/anim';
import { Avatar, type AvatarVariant } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { useAlertMetrics, useUnitsSummary } from '@/features/data/hooks';
import { useLiveUnits } from '@/features/tracking/use-live-units';
import { useLocationPermission } from '@/features/tracking/use-location-permission';
import { useLocationReporter } from '@/features/tracking/use-location-reporter';
import { useLivePeople, usePresenceReporter } from '@/features/tracking/use-presence';
import { mediaUrl } from '@/lib/api';
import type { LivePerson, LiveUnit } from '@/lib/types';

// Centro por defecto: Lima, Perú (cuando aún no hay unidades con posición).
const DEFAULT_REGION = {
  latitude: -12.05,
  longitude: -77.05,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type LocatedUnit = LiveUnit & { lastLat: number; lastLng: number };

const AVATAR_VARIANTS: AvatarVariant[] = ['juan', 'luis', 'carlos', 'rosa', 'me', 'meLight'];

function variantFor(key: string | null | undefined): AvatarVariant {
  return key && (AVATAR_VARIANTS as string[]).includes(key)
    ? (key as AvatarVariant)
    : 'juan';
}

function hasPosition(u: LiveUnit): u is LocatedUnit {
  return u.lastLat != null && u.lastLng != null;
}

/** Nombre a mostrar: apelativo de radio si existe, si no el nombre. */
function displayName(op: LiveUnit['operator'] | undefined): string {
  return op?.nickname || op?.name || 'Sin operador';
}

/**
 * Marcador con el avatar del operador. Gestiona `tracksViewChanges` para que el
 * avatar (SVG) se renderice en Android y luego deje de redibujarse (rendimiento).
 */
function UnitMarker({ u }: { u: LocatedUnit }) {
  const [tracks, setTracks] = useState(true);
  const stopped = u.status === 'DETENIDO';

  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Marker
      coordinate={{ latitude: u.lastLat, longitude: u.lastLng }}
      title={`${displayName(u.operator)} · ${u.code}`}
      description={`${stopped ? 'Detenido' : 'En ruta'} · ${Math.round(
        u.lastSpeedKmh ?? 0,
      )} km/h`}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}>
      <View style={markerStyles.wrap}>
        <View
          style={[
            markerStyles.ring,
            { backgroundColor: stopped ? Mape.red : '#2E9E5B' },
          ]}>
          <Avatar
            variant={variantFor(u.operator?.avatarKey)}
            uri={mediaUrl(u.operator?.avatarKey)}
            size={38}
            borderWidth={2}
            borderColor={Mape.white}
          />
        </View>
        <View style={markerStyles.tag}>
          <Text style={markerStyles.tagText}>{u.operator?.nickname || u.code}</Text>
        </View>
      </View>
    </Marker>
  );
}

type LocatedPerson = LivePerson & { lastLat: number; lastLng: number };

function personHasPosition(p: LivePerson): p is LocatedPerson {
  return p.lastLat != null && p.lastLng != null;
}

/** Etiqueta de la persona: apelativo si existe; para el admin, "Admin". */
function personLabel(p: LivePerson): string {
  if (p.nickname) return p.nickname;
  if (p.role === 'ADMIN') return 'Admin';
  return p.name.split(' ')[0];
}

/** Marcador con el avatar y apelativo de una persona (cualquier rol). */
function PersonMarker({ p, isSelf }: { p: LocatedPerson; isSelf: boolean }) {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const ringColor = isSelf ? Mape.blue : p.role === 'ADMIN' ? Mape.ink : '#2E9E5B';

  return (
    <Marker
      coordinate={{ latitude: p.lastLat, longitude: p.lastLng }}
      title={`${personLabel(p)}${isSelf ? ' (tú)' : ''}`}
      description={p.role === 'ADMIN' ? 'Administrador' : p.name}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}>
      <View style={markerStyles.wrap}>
        <View style={[markerStyles.ring, { backgroundColor: ringColor }]}>
          <Avatar
            variant={variantFor(p.avatarKey)}
            uri={mediaUrl(p.avatarKey)}
            size={38}
            borderWidth={2}
            borderColor={Mape.white}
          />
        </View>
        <View style={markerStyles.tag}>
          <Text style={markerStyles.tagText}>{personLabel(p)}</Text>
        </View>
      </View>
    </Marker>
  );
}

export default function MapaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const mapRef = useRef<MapView>(null);

  const { user } = useAuth();
  const summary = useUnitsSummary();
  const metrics = useAlertMetrics();
  const live = useLiveUnits();
  const people = useLivePeople();
  const locationPermission = useLocationPermission(); // pide permiso a cualquier rol
  const reporterStatus = useLocationReporter(locationPermission); // operadores reportan su GPS (por unidad)
  usePresenceReporter(locationPermission); // todos reportan su propia ubicación

  // Centra el mapa en la ubicación propia (admin u operador) al conceder permiso,
  // salvo que ya haya unidades ubicadas (esas tienen prioridad de encuadre).
  const centeredSelf = useRef(false);
  useEffect(() => {
    if (locationPermission !== 'granted' || centeredSelf.current) return;
    let active = true;
    (async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active || centeredSelf.current) return;
        centeredSelf.current = true;
        mapRef.current?.animateToRegion(
          {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          600,
        );
      } catch {
        // sin fix de GPS todavía: mantenemos la región por defecto
      }
    })();
    return () => {
      active = false;
    };
  }, [locationPermission]);

  const s = summary.data;
  const filters = [
    `Todos · ${s?.total ?? 0}`,
    `En ruta · ${s?.enRuta ?? 0}`,
    `Detenidos · ${s?.detenidos ?? 0}`,
  ];
  const firstName = user?.name?.split(' ')[0] ?? 'operador';
  const alertsCount = metrics.data?.pendientes ?? 0;

  // Aviso cuando la ubicación no se está usando/reportando.
  const locationHint = useMemo(() => {
    if (locationPermission === 'denied') {
      return 'Sin permiso de ubicación: activa el GPS para Mape en los ajustes del teléfono.';
    }
    if (reporterStatus === 'no-unit') {
      return 'No tienes una unidad asignada: pide a un administrador que te asigne una.';
    }
    if (reporterStatus === 'sharing-off') {
      return 'Compartir ubicación está desactivado en Ajustes; tu unidad no se verá en el mapa.';
    }
    return null;
  }, [locationPermission, reporterStatus]);

  const located = useMemo(
    () => (live.data ?? []).filter(hasPosition),
    [live.data],
  );

  const locatedPeople = useMemo(
    () => (people.data ?? []).filter(personHasPosition),
    [people.data],
  );

  const visible = useMemo(() => {
    if (filter === 1) return located.filter((u) => u.status === 'EN_RUTA');
    if (filter === 2) return located.filter((u) => u.status === 'DETENIDO');
    return located;
  }, [located, filter]);

  // Resultados del buscador por nombre de operador o código de unidad.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return located
      .filter(
        (u) =>
          (u.operator?.name ?? '').toLowerCase().includes(q) ||
          (u.operator?.nickname ?? '').toLowerCase().includes(q) ||
          u.code.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, located]);

  const featured = live.data?.find((u) => u.operator) ?? live.data?.[0];

  const fitFleet = () => {
    if (located.length && mapRef.current) {
      mapRef.current.fitToCoordinates(
        located.map((u) => ({ latitude: u.lastLat, longitude: u.lastLng })),
        { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: true },
      );
    }
  };

  const focusUnit = (u: LocatedUnit) => {
    mapRef.current?.animateToRegion(
      {
        latitude: u.lastLat,
        longitude: u.lastLng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      600,
    );
    setQuery('');
    setSearchOpen(false);
  };

  // Encuadra la flota cuando cambia la cantidad de unidades ubicadas.
  useEffect(() => {
    fitFleet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.length]);

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      {/* Cabecera */}
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.iconBtnDark}
          onPress={() => router.navigate('/ajustes')}
          accessibilityLabel="Menú y ajustes">
          <Icon name="menu" size={20} color={Mape.white} />
        </PressableScale>
        <View style={styles.headerRight}>
          <PressableScale
            style={styles.iconBtnLight}
            onPress={() => setSearchOpen((v) => !v)}
            accessibilityLabel="Buscar operador">
            <Icon name="search" size={20} color={Mape.ink} />
          </PressableScale>
          <PressableScale
            onPress={() => router.navigate('/cuenta')}
            accessibilityLabel="Mi cuenta">
            <Avatar variant="me" size={46} borderWidth={2} borderColor={Mape.white} />
          </PressableScale>
        </View>
      </Animated.View>

      {/* Saludo + título */}
      <Animated.View style={styles.greetBlock} entering={rise(1)}>
        <View style={styles.rowBetween}>
          <Text style={styles.greet}>Hola, {firstName}</Text>
          <PressableScale style={styles.alertChip} onPress={() => router.navigate('/alertas')}>
            <View style={styles.alertDot} />
            <Text style={styles.alertChipText}>{alertsCount} alertas</Text>
          </PressableScale>
        </View>
        <Text style={styles.title}>Operadores en ruta</Text>
      </Animated.View>

      {/* Buscador de operador */}
      {searchOpen && (
        <View style={styles.searchBox}>
          <View style={styles.searchField}>
            <Icon name="search" size={18} color={Mape.textSubtle} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar operador o unidad…"
              placeholderTextColor={Mape.textFaint}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => matches[0] && focusUnit(matches[0])}
            />
            {query.length > 0 && (
              <PressableScale onPress={() => setQuery('')} accessibilityLabel="Limpiar">
                <Text style={styles.searchClear}>✕</Text>
              </PressableScale>
            )}
          </View>
          {matches.map((u) => (
            <PressableScale key={u.id} style={styles.searchRow} onPress={() => focusUnit(u)}>
              <Avatar
                variant={variantFor(u.operator?.avatarKey)}
                uri={mediaUrl(u.operator?.avatarKey)}
                size={30}
              />
              <View style={styles.gap1}>
                <Text style={styles.searchName}>{displayName(u.operator)}</Text>
                <Text style={styles.searchMeta}>
                  {u.code} · {u.status === 'EN_RUTA' ? 'En ruta' : 'Detenido'}
                </Text>
              </View>
              <Icon name="locate" size={18} color={Mape.ink} />
            </PressableScale>
          ))}
          {query.trim().length > 0 && matches.length === 0 && (
            <Text style={styles.searchEmpty}>Sin resultados con posición conocida.</Text>
          )}
        </View>
      )}

      {/* Filtros */}
      <Animated.View style={styles.filters} entering={rise(2)}>
        {filters.map((f, i) => {
          const active = i === filter;
          return (
            <PressableScale
              key={f}
              onPress={() => setFilter(i)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              {active && <View style={styles.filterDot} />}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
            </PressableScale>
          );
        })}
      </Animated.View>

      {/* Aviso de ubicación */}
      {locationHint && (
        <View style={styles.hint}>
          <Icon name="locate" size={16} color={Mape.redDark} />
          <Text style={styles.hintText}>{locationHint}</Text>
        </View>
      )}

      {/* Mapa */}
      <Animated.View style={styles.map} entering={rise(3)}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}>
          {visible.map((u) => (
            <UnitMarker key={u.id} u={u} />
          ))}
          {locatedPeople.map((p) => (
            <PersonMarker key={p.id} p={p} isSelf={p.id === user?.id} />
          ))}
        </MapView>

        {/* Controles */}
        <View style={styles.mapControls}>
          <PressableScale
            style={styles.mapCtrlBtn}
            accessibilityLabel="Encuadrar la flota"
            onPress={fitFleet}>
            <Icon name="locate" size={20} color={Mape.ink} strokeWidth={1.8} />
          </PressableScale>
        </View>

        {/* Etiqueta en vivo */}
        <View style={styles.liveBadge}>
          <LiveDot size={8} color={Mape.red} />
          <Text style={styles.liveText}>En vivo · {located.length} ubicadas</Text>
        </View>
      </Animated.View>

      {/* Tarjeta destacada */}
      <Animated.View style={styles.featured} entering={rise(4)}>
        <Avatar
          variant={variantFor(featured?.operator?.avatarKey)}
          uri={mediaUrl(featured?.operator?.avatarKey)}
          size={46}
          radius={23}
        />
        <PressableScale
          style={styles.featuredInfo}
          onPress={() =>
            router.push({ pathname: '/detalle', params: featured ? { unitId: featured.id } : {} })
          }>
          <Text style={styles.featuredName}>
            {displayName(featured?.operator)} · {featured?.code ?? '—'}
          </Text>
          <Text style={styles.featuredSub} numberOfLines={1}>
            {featured?.status === 'EN_RUTA' ? 'En ruta' : 'Detenido'} ·{' '}
            {Math.round(featured?.lastSpeedKmh ?? 0)} km/h
          </Text>
        </PressableScale>
        <View style={styles.featuredEta}>
          <Text style={styles.featuredEtaBig}>{live.data?.length ?? 0}</Text>
          <Text style={styles.featuredEtaSmall}>en vivo</Text>
        </View>
        <PressableScale
          style={styles.featuredRadio}
          onPress={() => router.navigate('/radio')}
          accessibilityLabel="Ir al radio">
          <Icon name="mic" size={18} color={Mape.white} />
        </PressableScale>
      </Animated.View>

    </Screen>
  );
}

const markerStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ring: {
    padding: 3,
    borderRadius: 26,
  },
  tag: {
    marginTop: 3,
    backgroundColor: Mape.ink,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: { color: Mape.white, fontSize: 10, fontFamily: Font.semibold },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtnDark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLight: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  greetBlock: { marginTop: 22, gap: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greet: { fontSize: 15, color: Mape.textSubtle, fontFamily: Font.regular },
  alertChip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Mape.redSoftBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Mape.red },
  alertChipText: { fontSize: 12, fontFamily: Font.bold, color: Mape.redDark },
  title: { fontSize: 30, fontFamily: Font.medium, letterSpacing: -0.8, color: Mape.ink },

  searchBox: {
    marginTop: 14,
    backgroundColor: Mape.white,
    borderRadius: 20,
    padding: 8,
    gap: 4,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Font.regular,
    color: Mape.ink,
    padding: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  searchClear: { fontSize: 16, color: Mape.textSubtle, paddingHorizontal: 4 },
  searchName: { fontSize: 14, color: Mape.ink, fontFamily: Font.semibold },
  searchMeta: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },
  searchEmpty: {
    fontSize: 13,
    color: Mape.textFaint,
    fontFamily: Font.regular,
    textAlign: 'center',
    paddingVertical: 10,
  },

  filters: { marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChipActive: { backgroundColor: Mape.ink },
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Mape.red },
  filterText: { fontSize: 13, fontFamily: Font.medium, color: Mape.ink },
  filterTextActive: { color: Mape.white, fontFamily: Font.semibold },

  hint: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Mape.redSoftBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: Font.medium, color: Mape.redDark },

  map: {
    marginTop: 14,
    flex: 1,
    minHeight: 280,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E6E6E6',
  },
  gap1: { flex: 1, gap: 1 },
  mapControls: { position: 'absolute', right: 12, top: 12, gap: 8 },
  mapCtrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveText: { color: Mape.white, fontSize: 12, fontFamily: Font.semibold },

  featured: {
    marginTop: 12,
    marginBottom: 96,
    backgroundColor: Mape.ink,
    borderRadius: 22,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featuredInfo: { flex: 1, gap: 2, minWidth: 0 },
  featuredName: { color: Mape.white, fontSize: 15, fontFamily: Font.semibold },
  featuredSub: { color: Mape.textOnDark, fontSize: 12, fontFamily: Font.regular },
  featuredEta: { alignItems: 'flex-end', gap: 2 },
  featuredEtaBig: { color: Mape.white, fontSize: 18, fontFamily: Font.semibold },
  featuredEtaSmall: { color: Mape.textOnDark, fontSize: 11, fontFamily: Font.regular },
  featuredRadio: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
