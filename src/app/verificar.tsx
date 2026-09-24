import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as RNTextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { api } from '@/lib/api';

const LENGTH = 6;

export default function VerificarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { destino } = useLocalSearchParams<{ destino?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(RNTextInput | null)[]>([]);

  // Cuenta atrás para reenviar el código.
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const code = digits.join('');
  const complete = code.length === LENGTH;

  const setAt = (index: number, value: string) => {
    // Solo dígitos; si pegan varios, los repartimos en las casillas siguientes.
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? '' : x)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      for (let i = 0; i < clean.length && index + i < LENGTH; i++) next[index + i] = clean[i];
      return next;
    });
    const nextIndex = Math.min(index + clean.length, LENGTH - 1);
    inputs.current[nextIndex]?.focus();
  };

  const onKey = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits((d) => d.map((x, i) => (i === index - 1 ? '' : x)));
    }
  };

  const confirmar = async () => {
    if (!complete || loading) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', {
        destination: destino || '',
        code,
      });
      router.replace({ pathname: '/restablecer', params: { destino: destino ?? '', code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorrecto o expirado');
    } finally {
      setLoading(false);
    }
  };

  const reenviar = async () => {
    try {
      await api.post('/auth/forgot-password', { destination: destino || '' });
      setSeconds(42);
    } catch {
      setSeconds(42);
    }
  };

  return (
    <Screen
      style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/recuperar')}
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
          Verifica{'\n'}
          <Text style={styles.h1Light}>el código.</Text>
        </Text>
        <Text style={styles.lead}>
          Ingresa el código de 6 dígitos que enviamos a{' '}
          <Text style={styles.leadStrong}>{destino || 'brayan@mape.app'}</Text>.
        </Text>
      </Animated.View>

      <Animated.View style={styles.codeRow} entering={rise(3)}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChangeText={(v) => setAt(i, v)}
            onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={LENGTH}
            selectTextOnFocus
            autoFocus={i === 0}
            style={[styles.codeBox, d ? styles.codeBoxFilled : null]}
          />
        ))}
      </Animated.View>

      <Animated.View style={styles.form} entering={rise(4)}>
        <PressableScale
          style={[styles.primary, (!complete || loading) && styles.primaryDisabled]}
          onPress={confirmar}>
          {loading ? (
            <ActivityIndicator color={Mape.white} />
          ) : (
            <>
              <Text style={styles.primaryText}>Confirmar código</Text>
              <Icon name="chevronRight" size={18} color={Mape.white} strokeWidth={2.2} />
            </>
          )}
        </PressableScale>

        {error && <Text style={styles.error}>{error}</Text>}

        {seconds > 0 ? (
          <Text style={styles.resendMuted}>
            Reenviar código en <Text style={styles.resendStrong}>0:{String(seconds).padStart(2, '0')}</Text>
          </Text>
        ) : (
          <PressableScale onPress={reenviar} style={styles.resendBtn}>
            <Text style={styles.resendLink}>Reenviar código</Text>
          </PressableScale>
        )}
      </Animated.View>

      <PressableScale style={styles.footer} onPress={() => router.replace('/recuperar')}>
        <Text style={styles.footerText}>
          ¿Correo equivocado? <Text style={styles.footerLink}>Cambiar</Text>
        </Text>
      </PressableScale>
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
  leadStrong: { fontFamily: Font.semibold, color: Mape.ink },

  codeRow: { marginTop: 28, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  codeBox: {
    flex: 1,
    height: 62,
    borderRadius: 18,
    backgroundColor: Mape.white,
    borderWidth: 1.5,
    borderColor: Mape.border,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: Font.semibold,
    color: Mape.ink,
    padding: 0,
  },
  codeBoxFilled: { borderColor: Mape.ink },

  form: { marginTop: 28, gap: 16 },
  primary: {
    height: 58,
    borderRadius: 29,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
  error: { color: Mape.red, fontSize: 13, fontFamily: Font.regular, textAlign: 'center' },
  resendMuted: { textAlign: 'center', fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular },
  resendStrong: { fontFamily: Font.semibold, color: Mape.ink },
  resendBtn: { alignItems: 'center' },
  resendLink: { fontSize: 14, fontFamily: Font.semibold, color: Mape.red },

  footer: { marginTop: 'auto', alignItems: 'center' },
  footerText: { fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular },
  footerLink: { fontFamily: Font.semibold, color: Mape.red },
});
