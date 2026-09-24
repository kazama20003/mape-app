import { FadeIn, FadeInDown } from 'react-native-reanimated';

/**
 * Animaciones de entrada reutilizables (Reanimated, hilo nativo de UI).
 * `order` produce el efecto escalonado (cascada) al entrar a una pantalla.
 */

const STEP = 65; // ms entre elementos

/** Sube y aparece con curva tipo resorte. Ideal para tarjetas/secciones. */
export function rise(order = 0) {
  return FadeInDown.springify().damping(16).mass(0.7).stiffness(140).delay(order * STEP);
}

/** Fundido simple. Ideal para cabeceras y fondos. */
export function fade(order = 0) {
  return FadeIn.duration(300).delay(order * STEP);
}
