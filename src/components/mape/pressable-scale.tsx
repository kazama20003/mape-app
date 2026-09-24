import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedProps,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** Escala mínima al presionar (por defecto 0.95). */
  scaleTo?: number;
  /** Opacidad mínima al presionar (por defecto 0.9). */
  dimTo?: number;
  /** Animación de layout de Reanimated (p. ej. la píldora de la barra inferior). */
  layout?: AnimatedProps<PressableProps>['layout'];
};

/**
 * Pressable con animación nativa (hilo de UI vía Reanimated):
 * al presionar reduce escala y opacidad con una curva tipo resorte al soltar.
 * API idéntica a Pressable, por lo que no altera la estructura de las pantallas.
 */
export function PressableScale({
  scaleTo = 0.95,
  dimTo = 0.9,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const progress = useSharedValue(0); // 0 = reposo, 1 = presionado

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - scaleTo) }],
    opacity: 1 - progress.value * (1 - dimTo),
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style as object, animatedStyle]}
      onPressIn={(e) => {
        progress.value = withTiming(1, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        progress.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
        onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}
