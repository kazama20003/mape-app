import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveDot } from '@/components/mape/anim';
import { Avatar, type AvatarVariant } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { api, mediaUrl } from '@/lib/api';

interface UserRow {
  id: string;
  name: string;
  nickname: string | null;
  avatarKey: string | null;
  operatorCode: string | null;
  isOnline: boolean;
}

const AVATAR_VARIANTS: string[] = ['juan', 'luis', 'carlos', 'rosa', 'me', 'meLight'];
function variantFor(key: string | null | undefined): AvatarVariant {
  return key && AVATAR_VARIANTS.includes(key) ? (key as AvatarVariant) : 'juan';
}

export default function NuevoChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => api.get<UserRow[]>('/users'),
  });

  const createConvo = useMutation({
    mutationFn: (otherId: string) =>
      api.post<{ id: string }>('/conversations', {
        type: 'DIRECT',
        memberIds: [otherId],
      }),
    onSuccess: (convo) => {
      router.replace({ pathname: '/chat', params: { id: convo.id } });
    },
  });

  const filtered = useMemo(() => {
    const all = (usersQuery.data ?? []).filter((u) => u.id !== user?.id);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.nickname ?? '').toLowerCase().includes(q) ||
        (o.operatorCode ?? '').toLowerCase().includes(q),
    );
  }, [usersQuery.data, query, user?.id]);

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="push">
      <Animated.View style={styles.header} entering={fade(0)}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.replace('/chats')}
          accessibilityLabel="Volver a chats">
          <Icon name="chevronLeft" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
        <Text style={styles.title}>Nuevo chat</Text>
      </Animated.View>

      <Animated.View style={styles.search} entering={rise(1)}>
        <Icon name="search" size={18} color="#6A6A6A" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre, apelativo o código"
          placeholderTextColor="#8A8A8A"
          style={styles.searchInput}
        />
      </Animated.View>

      {usersQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Mape.ink} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 18, gap: 8 }}>
          <Text style={styles.sectionLabel}>Personas</Text>
          {filtered.map((o, i) => (
            <Animated.View key={o.id} entering={rise(Math.min(i + 2, 7))}>
              <PressableScale
                style={styles.opRow}
                disabled={createConvo.isPending}
                onPress={() => createConvo.mutate(o.id)}>
                <Avatar variant={variantFor(o.avatarKey)} uri={mediaUrl(o.avatarKey)} size={48} radius={24} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {o.name}
                    {o.nickname ? ` · ${o.nickname}` : ''}
                  </Text>
                  <View style={styles.statusRow}>
                    {o.isOnline && <LiveDot size={6} color={Mape.red} />}
                    <Text style={[styles.rowSub, o.isOnline && styles.online]}>
                      {o.isOnline ? 'En línea' : 'Desconectado'}
                      {o.operatorCode ? ` · ${o.operatorCode}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.chatBtn}>
                  <Icon name="chat" size={18} color={Mape.ink} strokeWidth={1.8} />
                </View>
              </PressableScale>
            </Animated.View>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>No se encontraron personas.</Text>
          )}
        </ScrollView>
      )}
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
  title: { fontSize: 26, fontFamily: Font.medium, letterSpacing: -0.7, color: Mape.ink },
  search: {
    marginTop: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 14, color: Mape.ink, fontFamily: Font.regular, padding: 0 },
  sectionLabel: { fontSize: 13, color: Mape.textFaint, paddingLeft: 4, fontFamily: Font.regular },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingHorizontal: 14,
    backgroundColor: Mape.white,
    borderRadius: 22,
  },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  rowSub: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  online: { color: Mape.textMuted },
  chatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingVertical: 20, textAlign: 'center', fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular },
});
