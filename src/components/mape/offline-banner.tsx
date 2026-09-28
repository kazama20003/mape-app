import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Mape } from '@/constants/mape-theme';

/**
 * Aviso global de "sin conexión a internet". Se muestra como una píldora fija
 * arriba cuando el dispositivo pierde conectividad. No bloquea toques.
 */
export function OfflineBanner() {
  const net = useNetworkState();
  const insets = useSafeAreaInsets();

  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="none">
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.text}>Sin conexión a internet</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Mape.ink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Mape.red },
  text: { color: Mape.white, fontSize: 13, fontFamily: Font.semibold },
});
