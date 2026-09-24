import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { Avatar, type AvatarVariant } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { useConversations } from '@/features/data/hooks';
import { mediaUrl } from '@/lib/api';
import type { ConversationSummary, Message } from '@/lib/types';

const AVATAR_VARIANTS: string[] = ['juan', 'luis', 'carlos', 'rosa', 'me', 'meLight'];
function variantFor(key: string | null | undefined): AvatarVariant {
  return key && AVATAR_VARIANTS.includes(key) ? (key as AvatarVariant) : 'juan';
}

function previewOf(m: Message | null): string {
  if (!m) return 'Sin mensajes aún';
  switch (m.type) {
    case 'VOICE':
      return '🎤 Nota de voz';
    case 'IMAGE':
      return '📷 Imagen';
    case 'VIDEO':
      return '🎬 Video';
    case 'LOCATION':
      return '📍 Ubicación';
    default:
      return m.body ?? '';
  }
}

function timeOf(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yst = new Date(now);
  yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return 'Ayer';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const convosQuery = useConversations();
  const meId = user?.id;

  const displayOf = (c: ConversationSummary) => {
    if (c.title) return { title: c.title, avatarKey: null as string | null, group: c.type === 'GROUP' };
    const other = c.members.find((m) => m.user.id !== meId)?.user;
    return {
      title: other?.nickname || other?.name || 'Conversación',
      avatarKey: other?.avatarKey ?? null,
      group: false,
    };
  };

  const list = useMemo(() => {
    const all = convosQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => displayOf(c).title.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convosQuery.data, search, meId]);

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 20 }]} transition="fade">
      <Animated.View style={styles.header} entering={fade(0)}>
        <Text style={styles.title}>Chats</Text>
        <PressableScale
          style={styles.newBtn}
          onPress={() => router.push('/nuevo-chat')}
          accessibilityLabel="Nuevo chat">
          <Icon name="plus" size={20} color={Mape.white} />
        </PressableScale>
      </Animated.View>

      <Animated.View style={styles.search} entering={rise(1)}>
        <Icon name="search" size={18} color="#6A6A6A" />
        <TextInput
          placeholder="Buscar chat"
          placeholderTextColor="#8A8A8A"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </Animated.View>

      {convosQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Mape.ink} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110, paddingTop: 18, gap: 8 }}>
          {list.map((c, i) => {
            const d = displayOf(c);
            return (
              <Animated.View key={c.id} entering={rise(Math.min(i + 2, 7))}>
                <PressableScale
                  style={styles.chatRow}
                  onPress={() => router.push({ pathname: '/chat', params: { id: c.id } })}>
                  {d.group ? (
                    <View style={styles.groupIcon}>
                      <Icon name="truck" size={22} color={Mape.white} strokeWidth={1.8} />
                    </View>
                  ) : (
                    <Avatar variant={variantFor(d.avatarKey)} uri={mediaUrl(d.avatarKey)} size={48} radius={24} />
                  )}
                  <View style={styles.chatInfo}>
                    <Text style={styles.chatName} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.chatMsg} numberOfLines={1}>
                      {previewOf(c.lastMessage)}
                    </Text>
                  </View>
                  <View style={styles.chatMeta}>
                    <Text style={styles.time}>{timeOf(c.lastMessage?.createdAt)}</Text>
                    {c.unread > 0 && (
                      <View style={styles.unread}>
                        <Text style={styles.unreadText}>{c.unread}</Text>
                      </View>
                    )}
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
          {list.length === 0 && (
            <Text style={styles.empty}>
              No tienes chats todavía. Toca + para iniciar uno.
            </Text>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontFamily: Font.medium, letterSpacing: -0.8, color: Mape.ink },
  newBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Mape.white,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: { flex: 1, gap: 3, minWidth: 0 },
  chatName: { fontSize: 15, fontFamily: Font.semibold, color: Mape.ink },
  chatMsg: { fontSize: 13, color: Mape.textMuted, fontFamily: Font.regular },
  chatMeta: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 12, color: Mape.textFaint, fontFamily: Font.regular },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 12, color: Mape.white, fontFamily: Font.bold },
  empty: {
    textAlign: 'center',
    color: Mape.textFaint,
    fontFamily: Font.regular,
    fontSize: 14,
    marginTop: 40,
  },
});
