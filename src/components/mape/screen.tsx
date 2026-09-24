import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type ScreenTransition = 'push' | 'fade' | 'modal';

/**
 * Contenedor raíz de pantalla. Las transiciones entre pantallas las maneja el
 * stack nativo (react-native-screens) en `_layout`, con gesto de deslizar para
 * volver. Este componente solo aporta el `flex: 1` del contenedor — no envuelve
 * en una capa animada para no interferir con los toques.
 */
export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  transition?: ScreenTransition;
}) {
  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}
