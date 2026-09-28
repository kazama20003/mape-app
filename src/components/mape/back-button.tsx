import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Icon } from '@/components/mape/icons';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Mape } from '@/constants/mape-theme';

type Props = {
  /** Acción al presionar. Por defecto vuelve a la pantalla anterior. */
  onPress?: () => void;
  /** Usar sobre cabeceras oscuras (flecha blanca). */
  dark?: boolean;
  accessibilityLabel?: string;
};

/**
 * Botón de "volver": solo la flecha ←, sin fondo ni recuadro. El área de
 * toque es de 44×44 (transparente) para que sea cómoda de presionar.
 */
export function BackButton({ onPress, dark, accessibilityLabel = 'Volver' }: Props) {
  const router = useRouter();
  return (
    <PressableScale
      onPress={onPress ?? (() => router.back())}
      style={styles.btn}
      accessibilityLabel={accessibilityLabel}>
      <Icon name="arrowLeft" size={26} color={dark ? Mape.white : Mape.ink} strokeWidth={2.3} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
