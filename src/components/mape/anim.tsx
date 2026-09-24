import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Path, type PathProps } from 'react-native-svg';

import { Mape } from '@/constants/mape-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ── mp-pulse: punto con halo pulsante ("en vivo") ── */
export function LiveDot({
  size = 8,
  color = Mape.red,
  style,
}: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 1.9 }],
    opacity: 0.55 * (1 - p.value),
  }));
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
          halo,
        ]}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

/* ── mp-ping: anillo que se expande y desvanece ── */
export function PingRing({
  size,
  color = '#F2B8B5',
  borderWidth = 1.5,
  delay = 0,
  style,
}: {
  size: number;
  color?: string;
  borderWidth?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [p, delay]);
  const st = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + p.value * 0.3 }],
    opacity: 0.9 * (1 - p.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
        },
        st,
        style,
      ]}
    />
  );
}

/* ── mp-wave: barras de audio oscilando ── */
export function Waveform({
  heights,
  color = Mape.red,
  barWidth = 3,
  gap = 3,
  style,
}: {
  heights: number[];
  color?: string;
  barWidth?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {heights.map((h, i) => (
        <WaveBar key={i} h={h} phase={i} color={color} w={barWidth} />
      ))}
    </View>
  );
}
function WaveBar({ h, phase, color, w }: { h: number; phase: number; color: string; w: number }) {
  const s = useSharedValue(0.35);
  useEffect(() => {
    s.value = withDelay(
      (phase % 4) * 150,
      withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [s, phase]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: 2, backgroundColor: color }, st]} />;
}

/* ── mp-dash: ruta punteada que fluye (SVG) ── */
export function DashRoute({
  d,
  stroke,
  strokeWidth = 2.5,
  dashArray = '6 7',
  ...rest
}: { d: string; stroke: string; strokeWidth?: number; dashArray?: string } & PathProps) {
  const off = useSharedValue(0);
  useEffect(() => {
    off.value = withRepeat(withTiming(-60, { duration: 2400, easing: Easing.linear }), -1, false);
  }, [off]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  return (
    <AnimatedPath
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArray}
      strokeLinecap="round"
      fill="none"
      animatedProps={animatedProps}
      {...rest}
    />
  );
}

/* ── mp-float: elemento que flota suavemente ── */
export function FloatView({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(withTiming(-4, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [y, delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

/* ── mp-dots: tres puntos "cargando/escribiendo" ── */
export function TypingDots({
  color = Mape.white,
  size = 8,
  gap = 8,
  style,
}: {
  color?: string;
  size?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} phase={i} color={color} size={size} />
      ))}
    </View>
  );
}
function TypingDot({ phase, color, size }: { phase: number; color: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      phase * 160,
      withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [p, phase]);
  const st = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * p.value,
    transform: [{ scale: 0.8 + 0.2 * p.value }],
  }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, st]} />;
}
