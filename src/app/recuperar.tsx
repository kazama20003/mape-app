import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { api } from '@/lib/api';

export default function RecuperarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('brayan@mape.app');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (loading || !email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { destination: email.trim() });
      router.push({ pathname: '/verificar', params: { destino: email.trim() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/login')}
          accessibilityLabel="Volver al inicio de sesión">
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
          Recupera{'\n'}
          <Text style={styles.h1Light}>tu acceso.</Text>
        </Text>
        <Text style={styles.lead}>
          Te enviaremos un código de 6 dígitos a tu correo o al número registrado de tu unidad.
        </Text>
      </Animated.View>

      <Animated.View style={styles.form} entering={rise(3)}>
        <Text style={styles.label}>Correo o código de operador</Text>
        <View style={styles.inputWrap}>
          <Icon name="user" size={20} color="#6A6A6A" strokeWidth={1.8} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <PressableScale
          style={[styles.primary, loading && { opacity: 0.6 }]}
          onPress={handleSend}>
          {loading ? (
            <ActivityIndicator color={Mape.white} />
          ) : (
            <>
              <Text style={styles.primaryText}>Enviar código</Text>
              <Icon name="chevronRight" size={18} color={Mape.white} strokeWidth={2.2} />
            </>
          )}
        </PressableScale>
        {error && <Text style={styles.error}>{error}</Text>}
      </Animated.View>

      <Animated.View style={styles.infoCard} entering={rise(4)}>
        <View style={styles.infoIcon}>
          <Icon name="bell" size={20} color={Mape.redDark} strokeWidth={1.8} />
        </View>
        <View style={styles.infoText}>
          <Text style={styles.infoTitle}>¿No tienes acceso al correo?</Text>
          <Text style={styles.infoSub}>
            Pide a tu supervisor que restablezca tu clave desde el panel de administración de Mape.
          </Text>
        </View>
      </Animated.View>

      <PressableScale style={styles.footer} onPress={() => router.replace('/login')}>
        <Text style={styles.footerText}>
          ¿Recordaste tu contraseña? <Text style={styles.footerLink}>Volver a ingresar</Text>
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

  form: { marginTop: 28, gap: 8 },
  label: { fontSize: 13, fontFamily: Font.semibold, color: '#4A4A4A', paddingLeft: 6 },
  inputWrap: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Mape.ink,
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
  error: { color: Mape.red, fontSize: 13, fontFamily: Font.regular, textAlign: 'center', marginTop: 8 },

  infoCard: {
    marginTop: 22,
    backgroundColor: Mape.white,
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.redSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },
  infoSub: { fontSize: 13, lineHeight: 19, color: Mape.textMuted, fontFamily: Font.regular },

  footer: { marginTop: 'auto', alignItems: 'center' },
  footerText: { fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular },
  footerLink: { fontFamily: Font.semibold, color: Mape.red },
});
