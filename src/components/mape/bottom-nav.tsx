import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Font, Mape } from '@/constants/mape-theme';
import { Avatar } from './avatar';
import { Icon, type IconName } from './icons';
import { PressableScale } from './pressable-scale';

export type NavKey = 'mapa' | 'radio' | 'chats' | 'alertas' | 'perfil';

type Item = {
  key: NavKey;
  label: string;
  icon?: IconName;
  avatar?: boolean;
  badge?: number;
  dot?: boolean;
};

const ITEMS: Item[] = [
  { key: 'mapa', label: 'Mapa', icon: 'pin' },
  { key: 'radio', label: 'Radio', icon: 'radio' },
  { key: 'chats', label: 'Chat', icon: 'chat', badge: 3 },
  { key: 'alertas', label: 'Alertas', icon: 'bell', dot: true },
  { key: 'perfil', label: 'Perfil', avatar: true },
];

/**
 * Barra de navegación inferior (píldora). Se usa como `tabBar` del navegador de
 * pestañas: `onNavigate` cambia de pestaña SIN re-montar las pantallas. En
 * pantallas de stack (p. ej. Ajustes) se usa sin `onNavigate` y navega con el
 * router.
 */
export function BottomNav({
  active,
  onNavigate,
}: {
  active: NavKey;
  onNavigate?: (key: NavKey) => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigate = (key: NavKey) => {
    if (onNavigate) onNavigate(key);
    else router.replace(`/${key}`);
  };

  // mp-nav: la barra sube y aparece al montar (una sola vez).
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(120, withTiming(1, { duration: 420 }));
  }, [enter]);
  const navStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 48 }],
  }));

  // mp-pill: la píldora activa crece/encoge de forma continua al cambiar de
  // pestaña, así el indicador blanco "se desliza" entre íconos en vez de saltar.
  const pill = LinearTransition.springify().damping(18).stiffness(170).mass(0.8);

  return (
    <Animated.View
      style={[styles.nav, navStyle, { bottom: Math.max(16, insets.bottom + 8) }]}>
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <PressableScale
            key={item.key}
            layout={pill}
            onPress={() => navigate(item.key)}
            style={[styles.item, isActive && styles.itemActive]}>
            {item.avatar ? (
              <Avatar
                variant="me"
                size={isActive ? 26 : 30}
                borderWidth={2}
                borderColor={isActive ? Mape.ink : Mape.white}
              />
            ) : (
              <Icon
                name={item.icon!}
                size={isActive ? 20 : 22}
                color={isActive ? Mape.ink : Mape.white}
                strokeWidth={isActive ? 2 : 1.8}
              />
            )}
            {isActive && (
              <Animated.Text entering={FadeIn.duration(160).delay(60)} style={styles.label}>
                {item.label}
              </Animated.Text>
            )}
            {!isActive && item.badge != null && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            {!isActive && item.dot && <View style={styles.dot} />}
          </PressableScale>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    height: 68,
    backgroundColor: Mape.ink,
    borderRadius: 34,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 2,
  },
  item: {
    width: 54,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  itemActive: {
    flex: 1,
    backgroundColor: Mape.white,
    gap: 8,
  },
  label: {
    color: Mape.ink,
    fontFamily: Font.semibold,
    fontSize: 14,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Mape.ink,
  },
  badgeText: { color: Mape.white, fontSize: 11, fontFamily: Font.bold },
  dot: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Mape.red,
    borderWidth: 2,
    borderColor: Mape.ink,
  },
});
