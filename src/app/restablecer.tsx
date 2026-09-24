import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { api } from '@/lib/api';

export default function RestablecerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { destino, code } = useLocalSearchParams<{ destino?: string; code?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (loading) return;
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        destination: destino || '',
        code: code || '',
        newPassword: password,
      });
      Alert.alert('Listo', 'Tu contraseña se actualizó. Inicia sesión.', [
        { text: 'Ingresar', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Volver">
          <Icon name="chevronLeft" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
        <View style={styles.brand}>
          <View style={styles.brandLogo}>
            <Icon name="pin" size={18} color={Mape.white} />
          </View>
          <Text style={styles.brandText}>Mape</Text>
        </View>
      </Animated.View>

      <Animated.View style={styles.lockBox} entering={rise(1)}>
        <Icon name="lock" size={32} color={Mape.white} strokeWidth={1.8} />
      </Animated.View>

      <Animated.View style={styles.headingBlock} entering={rise(2)}>
        <Text style={styles.h1}>
          Nueva{'\n'}
          <Text style={styles.h1Light}>contraseña.</Text>
        </Text>
        <Text style={styles.lead}>Elige una contraseña segura para tu cuenta.</Text>
      </Animated.View>

      <Animated.View style={styles.form} entering={rise(3)}>
        <View style={styles.inputWrap}>
          <Icon name="lock" size={20} color="#6A6A6A" strokeWidth={1.8} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            placeholder="Nueva contraseña"
            placeholderTextColor="#9A9A9A"
            style={styles.input}
          />
          <PressableScale onPress={() => setShowPass((v) => !v)}>
            <Icon name="eye" size={20} color={Mape.ink} strokeWidth={1.8} />
          </PressableScale>
        </View>
        <View style={styles.inputWrap}>
          <Icon name="lock" size={20} color="#6A6A6A" strokeWidth={1.8} />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPass}
            placeholder="Repite la contraseña"
            placeholderTextColor="#9A9A9A"
            style={styles.input}
          />
        </View>

        <PressableScale
          style={[styles.primary, loading && { opacity: 0.6 }]}
          onPress={handleReset}>
          {loading ? (
            <ActivityIndicator color={Mape.white} />
          ) : (
            <>
              <Text style={styles.primaryText}>Guardar contraseña</Text>
              <Icon name="chevronRight" size={18} color={Mape.white} strokeWidth={2.2} />
            </>
          )}
        </PressableScale>
        {error && <Text style={styles.error}>{error}</Text>}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 18, fontFamily: Font.bold, letterSpacing: -0.4, color: Mape.ink },
  lockBox: {
    marginTop: 40,
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingBlock: { marginTop: 22, gap: 10 },
  h1: { fontSize: 34, lineHeight: 37, fontFamily: Font.medium, letterSpacing: -1, color: Mape.ink },
  h1Light: { fontFamily: Font.light },
  lead: { fontSize: 14, lineHeight: 21, color: Mape.textSubtle, fontFamily: Font.regular },
  form: { marginTop: 28, gap: 12 },
  inputWrap: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Mape.border,
  },
  input: { flex: 1, fontSize: 15, color: Mape.ink, fontFamily: Font.regular, padding: 0 },
  primary: {
    marginTop: 8,
    height: 58,
    borderRadius: 29,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
  error: { color: Mape.red, fontSize: 13, fontFamily: Font.regular, textAlign: 'center' },
});
