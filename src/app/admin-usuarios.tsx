import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert as RNAlert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, type AvatarVariant } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { api, mediaUrl } from '@/lib/api';
import type { Role } from '@/lib/types';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  role: Role;
  avatarKey: string | null;
  operatorCode: string | null;
  isActive: boolean;
}

const ROLES: { key: Role; label: string }[] = [
  { key: 'OPERATOR', label: 'Operador' },
  { key: 'SUPERVISOR', label: 'Supervisor' },
  { key: 'ADMIN', label: 'Admin' },
];

const AVATAR_VARIANTS: string[] = ['juan', 'luis', 'carlos', 'rosa', 'me', 'meLight'];
function variantFor(key: string | null | undefined): AvatarVariant {
  return key && AVATAR_VARIANTS.includes(key) ? (key as AvatarVariant) : 'juan';
}

interface FormState {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  avatarKey: string | null;
}

const EMPTY_FORM: FormState = {
  name: '',
  nickname: '',
  email: '',
  password: '',
  role: 'OPERATOR',
  isActive: true,
  avatarKey: null,
};

export default function AdminUsuariosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUser[]>('/users'),
  });

  const users = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.nickname ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing === 'new') {
        return api.post('/users', {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          nickname: form.nickname.trim() || undefined,
          role: form.role,
          avatarKey: form.avatarKey ?? undefined,
        });
      }
      const id = (editing as AdminUser).id;
      return api.patch(`/users/${id}`, {
        name: form.name.trim(),
        nickname: form.nickname.trim() || null,
        role: form.role,
        isActive: form.isActive,
        avatarKey: form.avatarKey ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditing(null);
    },
    onError: (e: unknown) => {
      RNAlert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    },
  });

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (u: AdminUser) => {
    setForm({
      name: u.name,
      nickname: u.nickname ?? '',
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
      avatarKey: u.avatarKey,
    });
    setEditing(u);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      RNAlert.alert('Permiso requerido', 'Necesito acceso a tus fotos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const up = await api.upload(asset.uri, {
        name: asset.fileName ?? 'foto.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setForm((f) => ({ ...f, avatarKey: up.key }));
    } catch (e) {
      RNAlert.alert('No se pudo subir la foto', e instanceof Error ? e.message : 'Error');
    } finally {
      setUploading(false);
    }
  };

  const canSave =
    form.name.trim().length > 0 &&
    (editing !== 'new' ||
      (form.email.trim().length > 3 && form.password.length >= 6));

  // ── Vista de edición / creación ─────────────────────────────
  if (editing) {
    const isNew = editing === 'new';
    return (
      <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
        <View style={styles.header}>
          <PressableScale style={styles.backBtn} onPress={() => setEditing(null)}>
            <Icon name="chevronLeft" size={22} color={Mape.ink} />
          </PressableScale>
          <Text style={styles.title}>{isNew ? 'Nuevo usuario' : 'Editar usuario'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: 14, paddingTop: 8 }}>
          {/* Foto */}
          <View style={styles.photoBlock}>
            <PressableScale onPress={pickPhoto} accessibilityLabel="Cambiar foto">
              <Avatar
                variant={variantFor(form.avatarKey)}
                uri={mediaUrl(form.avatarKey)}
                size={96}
                radius={48}
                borderWidth={3}
                borderColor={Mape.white}
              />
              <View style={styles.photoEdit}>
                {uploading ? (
                  <ActivityIndicator size="small" color={Mape.white} />
                ) : (
                  <Icon name="image" size={16} color={Mape.white} />
                )}
              </View>
            </PressableScale>
            <Text style={styles.photoHint}>Toca la foto para cambiarla</Text>
          </View>

          <Field label="Nombre completo">
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="Juan Pérez"
              placeholderTextColor={Mape.textFaint}
            />
          </Field>

          <Field label="Apelativo (indicativo de radio)">
            <TextInput
              style={styles.input}
              value={form.nickname}
              onChangeText={(t) => setForm((f) => ({ ...f, nickname: t }))}
              placeholder="Halcón 1"
              placeholderTextColor={Mape.textFaint}
            />
          </Field>

          {isNew && (
            <>
              <Field label="Correo">
                <TextInput
                  style={styles.input}
                  value={form.email}
                  onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
                  placeholder="operador@mape.app"
                  placeholderTextColor={Mape.textFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </Field>
              <Field label="Contraseña (mín. 6)">
                <TextInput
                  style={styles.input}
                  value={form.password}
                  onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
                  placeholder="••••••"
                  placeholderTextColor={Mape.textFaint}
                  secureTextEntry
                />
              </Field>
            </>
          )}

          <Field label="Rol / acceso">
            <View style={styles.roleRow}>
              {ROLES.map((r) => {
                const active = form.role === r.key;
                return (
                  <PressableScale
                    key={r.key}
                    onPress={() => setForm((f) => ({ ...f, role: r.key }))}
                    style={[styles.roleChip, active && styles.roleChipActive]}>
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {r.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </Field>

          {!isNew && (
            <View style={styles.switchRow}>
              <View style={styles.gap1}>
                <Text style={styles.switchTitle}>Acceso activo</Text>
                <Text style={styles.switchSub}>Si lo apagas, no podrá iniciar sesión</Text>
              </View>
              <Switch
                value={form.isActive}
                onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                trackColor={{ true: Mape.red, false: '#CFCFCF' }}
                thumbColor={Mape.white}
              />
            </View>
          )}

          <PressableScale
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => canSave && saveMutation.mutate()}>
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={Mape.white} />
            ) : (
              <Text style={styles.saveText}>{isNew ? 'Crear usuario' : 'Guardar cambios'}</Text>
            )}
          </PressableScale>
        </ScrollView>
      </Screen>
    );
  }

  // ── Vista de lista ──────────────────────────────────────────
  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="chevronLeft" size={22} color={Mape.ink} />
        </PressableScale>
        <Text style={styles.title}>Usuarios</Text>
        <PressableScale style={styles.addBtn} onPress={openNew} accessibilityLabel="Nuevo usuario">
          <Icon name="plus" size={22} color={Mape.white} />
        </PressableScale>
      </Animated.View>

      <View style={styles.searchField}>
        <Icon name="search" size={18} color={Mape.textSubtle} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre, apelativo o correo…"
          placeholderTextColor={Mape.textFaint}
        />
      </View>

      {usersQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Mape.ink} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 8, paddingTop: 12 }}>
          {filtered.map((u, i) => (
            <Animated.View key={u.id} entering={rise(Math.min(i, 6))}>
              <PressableScale style={styles.userRow} onPress={() => openEdit(u)}>
                <Avatar
                  variant={variantFor(u.avatarKey)}
                  uri={mediaUrl(u.avatarKey)}
                  size={46}
                />
                <View style={styles.gap1}>
                  <Text style={styles.userName}>
                    {u.name}
                    {u.nickname ? ` · ${u.nickname}` : ''}
                  </Text>
                  <Text style={styles.userMeta}>
                    {ROLES.find((r) => r.key === u.role)?.label ?? u.role} · {u.email}
                  </Text>
                </View>
                <View
                  style={[styles.statusDot, { backgroundColor: u.isActive ? '#2E9E5B' : '#B9B9B9' }]}
                />
              </PressableScale>
            </Animated.View>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>No hay usuarios que coincidan.</Text>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontFamily: Font.semibold, letterSpacing: -0.5, color: Mape.ink },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap1: { flex: 1, gap: 2, minWidth: 0 },

  searchField: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Mape.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: Font.regular, color: Mape.ink, padding: 0 },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Mape.white,
    borderRadius: 18,
    padding: 10,
    paddingHorizontal: 12,
  },
  userName: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  userMeta: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  empty: {
    textAlign: 'center',
    color: Mape.textFaint,
    fontFamily: Font.regular,
    fontSize: 14,
    paddingVertical: 30,
  },

  photoBlock: { alignItems: 'center', gap: 8, marginTop: 6 },
  photoEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Mape.bg,
  },
  photoHint: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, color: Mape.textSubtle, fontFamily: Font.medium, paddingLeft: 4 },
  input: {
    backgroundColor: Mape.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    fontFamily: Font.regular,
    color: Mape.ink,
  },
  roleRow: { flexDirection: 'row', gap: 8 },
  roleChip: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipActive: { backgroundColor: Mape.ink },
  roleText: { fontSize: 13, fontFamily: Font.medium, color: Mape.ink },
  roleTextActive: { color: Mape.white, fontFamily: Font.semibold },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Mape.white,
    borderRadius: 16,
    padding: 14,
  },
  switchTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  switchSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },

  saveBtn: {
    marginTop: 6,
    height: 54,
    borderRadius: 27,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
});
