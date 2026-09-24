import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert as RNAlert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/mape/avatar';
import { Icon, type IconName } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useMe, useUpdateProfile } from '@/features/data/hooks';
import type { Shift } from '@/lib/types';

type FieldKey = 'name' | 'positionTitle' | 'email' | 'phone';
type Field = {
  key: FieldKey;
  label: string;
  icon: IconName;
  keyboard?: 'email-address' | 'phone-pad';
  readOnly?: boolean;
};

const PERSONAL: Field[] = [
  { key: 'name', label: 'Nombre completo', icon: 'user' },
  { key: 'positionTitle', label: 'Cargo', icon: 'sliders' },
  { key: 'email', label: 'Correo', icon: 'image', keyboard: 'email-address', readOnly: true },
  { key: 'phone', label: 'Teléfono', icon: 'radio', keyboard: 'phone-pad' },
];

const TURNOS: { label: string; value: Shift }[] = [
  { label: 'Mañana', value: 'MANANA' },
  { label: 'Tarde', value: 'TARDE' },
  { label: 'Noche', value: 'NOCHE' },
];

export default function CuentaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: '',
    positionTitle: '',
    email: '',
    phone: '',
  });
  const [turno, setTurno] = useState(0);
  const set = (k: FieldKey, v: string) => setValues((s) => ({ ...s, [k]: v }));

  // Precarga los datos reales del backend una vez que llegan.
  useEffect(() => {
    if (!me) return;
    setValues({
      name: me.name ?? '',
      positionTitle: me.positionTitle ?? '',
      email: me.email ?? '',
      phone: me.phone ?? '',
    });
    const idx = TURNOS.findIndex((t) => t.value === me.shift);
    if (idx >= 0) setTurno(idx);
  }, [me]);

  const save = () => {
    updateProfile.mutate(
      {
        name: values.name.trim(),
        positionTitle: values.positionTitle.trim(),
        phone: values.phone.trim(),
        shift: TURNOS[turno].value,
      },
      {
        onSuccess: () => router.replace('/perfil'),
        onError: (e) =>
          RNAlert.alert('No se pudo guardar', (e as Error).message),
      },
    );
  };

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]}>
      {/* Cabecera */}
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/perfil')}
          accessibilityLabel="Volver al perfil">
          <Icon name="chevronLeft" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Mi cuenta</Text>
        <PressableScale style={styles.saveBtn} onPress={save} disabled={updateProfile.isPending}>
          <Text style={styles.saveText}>Guardar</Text>
        </PressableScale>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled">
        {/* Foto de perfil */}
        <Animated.View style={styles.photoBlock} entering={rise(1)}>
          <View>
            <Avatar variant="me" size={96} radius={48} borderWidth={3} borderColor={Mape.white} />
            <PressableScale style={styles.cameraBtn} accessibilityLabel="Cambiar foto">
              <Icon name="image" size={16} color={Mape.white} strokeWidth={2} />
            </PressableScale>
          </View>
          <PressableScale>
            <Text style={styles.changePhoto}>Cambiar foto</Text>
          </PressableScale>
        </Animated.View>

        {/* Datos personales */}
        <Text style={styles.section}>Datos personales</Text>
        <Animated.View style={styles.group} entering={rise(2)}>
          {PERSONAL.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.inputWrap}>
                <Icon name={f.icon} size={20} color="#6A6A6A" strokeWidth={1.8} />
                <TextInput
                  value={values[f.key]}
                  onChangeText={(t) => set(f.key, t)}
                  editable={!f.readOnly}
                  keyboardType={f.keyboard ?? 'default'}
                  autoCapitalize={f.key === 'email' ? 'none' : 'sentences'}
                  style={[styles.input, f.readOnly && styles.inputReadOnly]}
                  placeholderTextColor="#9A9A9A"
                />
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Operación */}
        <Text style={styles.section}>Operación</Text>
        <Animated.View style={styles.group} entering={rise(3)}>
          <Text style={styles.label}>Turno</Text>
          <View style={styles.chips}>
            {TURNOS.map((t, i) => {
              const active = i === turno;
              return (
                <PressableScale
                  key={t.value}
                  onPress={() => setTurno(i)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

        {/* Seguridad */}
        <Text style={styles.section}>Seguridad</Text>
        <Animated.View style={styles.group} entering={rise(4)}>
          <PressableScale style={styles.row} onPress={() => router.push('/recuperar')}>
            <View style={styles.rowIcon}>
              <Icon name="lock" size={20} color={Mape.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Cambiar contraseña</Text>
              <Text style={styles.rowSub}>Última actualización hace 2 meses</Text>
            </View>
            <Icon name="chevronRight" size={18} color="#9A9A9A" strokeWidth={2} />
          </PressableScale>
          <PressableScale style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon name="fingerprint" size={20} color={Mape.ink} strokeWidth={1.8} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Ingreso con huella</Text>
              <Text style={styles.rowSub}>Activado en este dispositivo</Text>
            </View>
            <Icon name="chevronRight" size={18} color="#9A9A9A" strokeWidth={2} />
          </PressableScale>
        </Animated.View>

        {/* Guardar */}
        <Animated.View entering={rise(5)}>
          <PressableScale style={styles.primary} onPress={save} disabled={updateProfile.isPending}>
            <Icon name="doubleCheck" size={18} color={Mape.white} strokeWidth={2.2} />
            <Text style={styles.primaryText}>
              {updateProfile.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 26, fontFamily: Font.medium, letterSpacing: -0.7, color: Mape.ink },
  saveBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Mape.ink, justifyContent: 'center' },
  saveText: { fontSize: 14, fontFamily: Font.semibold, color: Mape.white },

  photoBlock: { alignItems: 'center', gap: 12, marginTop: 20 },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Mape.red,
    borderWidth: 3,
    borderColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },

  section: { marginTop: 20, marginBottom: 8, fontSize: 13, color: Mape.textFaint, paddingLeft: 4, fontFamily: Font.regular },
  group: { gap: 12 },
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
  },
  input: { flex: 1, fontSize: 15, color: Mape.ink, fontFamily: Font.regular, padding: 0 },
  inputReadOnly: { color: Mape.textMuted },

  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Mape.ink },
  chipText: { fontSize: 14, fontFamily: Font.medium, color: Mape.ink },
  chipTextActive: { color: Mape.white, fontFamily: Font.semibold },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: Mape.white,
    borderRadius: 20,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  rowSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },

  primary: {
    marginTop: 24,
    height: 58,
    borderRadius: 29,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
});
