import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { DashRoute, TypingDots } from '@/components/mape/anim';
import { Icon } from '@/components/mape/icons';
import { Font, Mape } from '@/constants/mape-theme';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/inicio'), 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <Pressable style={styles.root} onPress={() => router.replace('/inicio')}>
      {/* Rutas de fondo animadas */}
      <Svg width="100%" height="100%" viewBox="0 0 390 844" style={StyleSheet.absoluteFill} opacity={0.25}>
        <DashRoute
          d="M-20 620 C 60 620, 90 520, 150 520 S 230 640, 290 620 S 350 500, 420 520"
          stroke="#FFFFFF"
          strokeWidth={2}
          dashArray="6 8"
        />
        <DashRoute
          d="M-20 200 C 60 200, 100 300, 170 290 S 260 160, 330 190 S 400 260, 420 250"
          stroke="#FFFFFF"
          strokeWidth={2}
          dashArray="6 8"
        />
        <Circle cx={150} cy={520} r={6} fill="#0A0A0A" stroke="#FFFFFF" strokeWidth={2} />
        <Circle cx={330} cy={190} r={6} fill={Mape.red} />
      </Svg>

      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.logo}>
        <Icon name="pin" size={48} color={Mape.white} />
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.titleBlock}>
        <Text style={styles.brand}>Mape</Text>
        <Text style={styles.tagline}>Tu flota, en tiempo real.</Text>
      </Animated.View>

      <TypingDots color={Mape.white} style={styles.dots} />

      <View style={[styles.hint, { bottom: insets.bottom + 24 }]}>
        <Text style={styles.hintText}>Toca para continuar</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { alignItems: 'center', gap: 6 },
  brand: { fontSize: 40, fontFamily: Font.bold, letterSpacing: -1.5, color: Mape.white },
  tagline: { fontSize: 14, color: Mape.textOnDarkSoft, fontFamily: Font.regular },
  dots: { marginTop: 40 },
  hint: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Mape.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { color: Mape.white, fontSize: 14, fontFamily: Font.medium },
});
