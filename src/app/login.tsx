import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState('brayan@mape.app');
  const [password, setPassword] = useState('mape1234');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [focusPass, setFocusPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/mapa');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      Alert.alert('Huella no disponible', 'Configura la huella o Face ID en tu teléfono.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ingresar a Mape',
      cancelLabel: 'Cancelar',
    });
    if (!result.success) return;
    if (status === 'authenticated') {
      router.replace('/mapa');
    } else {
      Alert.alert(
        'Primero inicia sesión',
        'Usa tu contraseña la primera vez; después podrás entrar con huella.',
      );
    }
  };

  return (
    <Screen transition="modal">
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      {/* Cabecera oscura */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 20 }]} entering={fade(0)}>
        <Svg width={390} height={120} viewBox="0 0 390 120" fill="none" style={styles.headerWave}>
          <Path
            d="M-10 90 C 60 90, 80 30, 140 30 S 210 100, 260 92 S 320 20, 400 40"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeDasharray="6 7"
            strokeLinecap="round"
          />
          <Circle cx={140} cy={30} r={6} fill={Mape.ink} stroke="#FFFFFF" strokeWidth={2} />
          <Circle cx={260} cy={92} r={6} fill={Mape.red} />
        </Svg>

        <View style={styles.headerTop}>
          <PressableScale
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Volver">
            <Icon name="chevronLeft" size={20} color={Mape.white} />
          </PressableScale>
          <View style={styles.headerBrand}>
            <View style={styles.headerLogo}>
              <Icon name="pin" size={18} color={Mape.white} strokeWidth={2} />
            </View>
            <Text style={styles.headerBrandText}>Mape</Text>
          </View>
        </View>

        <View style={styles.headerTitleBlock}>
          <Text style={styles.h1}>
            Bienvenido{'\n'}
            <Text style={styles.h1Light}>de nuevo.</Text>
          </Text>
          <Text style={styles.headerLead}>
            Ingresa con tu cuenta de Mape para ver tu flota en tiempo real.
          </Text>
        </View>
      </Animated.View>

      {/* Formulario */}
      <Animated.View style={styles.form} entering={rise(1)}>
        <View style={styles.field}>
          <Text style={styles.label}>Correo o código de operador</Text>
          <View style={styles.inputWrap}>
            <Icon name="user" size={20} color="#6A6A6A" strokeWidth={1.8} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#9A9A9A"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputWrap, focusPass && styles.inputWrapFocus]}>
            <Icon name="lock" size={20} color="#6A6A6A" strokeWidth={1.8} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              onFocus={() => setFocusPass(true)}
              onBlur={() => setFocusPass(false)}
              style={styles.input}
              placeholderTextColor="#9A9A9A"
            />
            <PressableScale onPress={() => setShowPass((v) => !v)} accessibilityLabel="Mostrar contraseña">
              <Icon name="eye" size={20} color={Mape.ink} strokeWidth={1.8} />
            </PressableScale>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <PressableScale style={styles.remember} onPress={() => setRemember((v) => !v)}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember && <Icon name="doubleCheck" size={12} color={Mape.white} strokeWidth={3} />}
            </View>
            <Text style={styles.rememberText}>Recordarme</Text>
          </PressableScale>
          <PressableScale onPress={() => router.push('/recuperar')}>
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </PressableScale>
        </View>

        <PressableScale
          style={[styles.primary, loading && styles.primaryDisabled]}
          onPress={handleLogin}>
          {loading ? (
            <ActivityIndicator color={Mape.white} />
          ) : (
            <>
              <Text style={styles.primaryText}>Ingresar</Text>
              <Icon name="arrowRight" size={18} color={Mape.white} strokeWidth={2.2} />
            </>
          )}
        </PressableScale>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>o continúa con</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.altRow}>
          <PressableScale style={styles.altBtn}>
            <Icon name="qr" size={20} color={Mape.ink} strokeWidth={1.8} />
            <Text style={styles.altText}>Código QR</Text>
          </PressableScale>
          <PressableScale style={styles.altBtn} onPress={handleBiometric}>
            <Icon name="fingerprint" size={20} color={Mape.ink} strokeWidth={1.8} />
            <Text style={styles.altText}>Huella</Text>
          </PressableScale>
        </View>
      </Animated.View>

      {/* Pie */}
      <Animated.View style={styles.footer} entering={rise(2)}>
        <View style={styles.onlinePill}>
          <View style={styles.avatarStack}>
            <Avatar variant="juan" size={32} borderWidth={2} borderColor={Mape.white} />
            <View style={styles.overlap}>
              <Avatar variant="luis" size={32} borderWidth={2} borderColor={Mape.white} />
            </View>
            <View style={styles.overlap}>
              <Avatar variant="rosa" size={32} borderWidth={2} borderColor={Mape.white} />
            </View>
          </View>
          <Text style={styles.onlineText}>
            <Text style={styles.onlineStrong}>12 operadores</Text> conectados ahora
          </Text>
        </View>
        <Text style={styles.newText}>
          ¿Nuevo en el equipo? <Text style={styles.link}>Solicita acceso</Text>
        </Text>
      </Animated.View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg },

  header: {
    backgroundColor: Mape.ink,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingHorizontal: 28,
    paddingBottom: 32,
    gap: 24,
    overflow: 'hidden',
  },
  headerWave: { position: 'absolute', left: 0, bottom: 0, opacity: 0.35 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.panelDark,
    borderWidth: 1,
    borderColor: Mape.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandText: { color: Mape.white, fontSize: 18, fontFamily: Font.bold, letterSpacing: -0.4 },
  headerTitleBlock: { gap: 8 },
  h1: { color: Mape.white, fontSize: 36, lineHeight: 40, fontFamily: Font.medium, letterSpacing: -1 },
  h1Light: { fontFamily: Font.light },
  headerLead: { color: Mape.textOnDarkSoft, fontSize: 14, lineHeight: 21, fontFamily: Font.regular },

  form: { paddingHorizontal: 28, paddingTop: 24, gap: 12 },
  field: { gap: 8 },
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
    borderColor: Mape.white,
  },
  inputWrapFocus: { borderColor: Mape.ink },
  input: { flex: 1, fontSize: 15, color: Mape.ink, fontFamily: Font.regular, padding: 0 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#B5B5B5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Mape.ink, borderColor: Mape.ink },
  rememberText: { fontSize: 13, color: '#4A4A4A', fontFamily: Font.regular },
  link: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink },

  primary: {
    marginTop: 10,
    height: 58,
    borderRadius: 29,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
  primaryDisabled: { opacity: 0.6 },
  error: {
    color: Mape.red,
    fontSize: 13,
    fontFamily: Font.regular,
    textAlign: 'center',
    marginTop: 4,
  },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  divider: { flex: 1, height: 1, backgroundColor: Mape.border },
  dividerText: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },

  altRow: { flexDirection: 'row', gap: 10 },
  altBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: Mape.border,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  altText: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },

  footer: { paddingHorizontal: 28, paddingTop: 24, alignItems: 'center', gap: 14 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Mape.white,
    borderRadius: 20,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
  },
  avatarStack: { flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  onlineText: { fontSize: 13, color: '#4A4A4A', fontFamily: Font.regular },
  onlineStrong: { color: Mape.ink, fontFamily: Font.semibold },
  newText: { fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular },
});
