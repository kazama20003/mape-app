import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/mape/back-button';
import { Icon } from '@/components/mape/icons';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useChannelChat } from '@/features/radio/use-channel-chat';
import { mediaUrl } from '@/lib/api';

function fmtDur(sec: number): string {
  const s = Math.round(sec);
  return `0:${String(s).padStart(2, '0')}`;
}

export default function RadioChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { messages, playAudio, sendImage, sendText } = useChannelChat(id);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    sendText(body);
    setDraft('');
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) await sendImage(res.assets[0].uri);
  };

  // Orden cronológico (más antiguo arriba, más nuevo abajo) como un chat.
  const chrono = [...messages].reverse();

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 16 }]} transition="push">
      <View style={styles.header}>
        <BackButton />
        <View style={styles.gap1}>
          <Text style={styles.title} numberOfLines={1}>
            {name || 'Canal'}
          </Text>
          <Text style={styles.subtitle}>Notas de voz e imágenes</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={chrono}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 14, gap: 8 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay mensajes en este canal.</Text>
        }
        renderItem={({ item: h }) => (
          <View style={[styles.bubbleRow, h.mine && styles.bubbleRowMine]}>
            {h.imageKey ? (
              <PressableScale
                onPress={() => {
                  const u = mediaUrl(h.imageKey);
                  if (u) void Linking.openURL(u);
                }}
                style={[styles.imgBubble, h.mine && styles.bubbleMine]}
                accessibilityLabel="Ver imagen">
                <Image
                  source={{ uri: mediaUrl(h.imageKey) ?? undefined }}
                  style={styles.chatImg}
                  contentFit="cover"
                />
                <Text style={[styles.bubbleName, h.mine && styles.bubbleTextMine]}>
                  {h.mine ? 'Tú' : h.senderName}
                </Text>
              </PressableScale>
            ) : h.text ? (
              <View style={[styles.textBubble, h.mine && styles.bubbleMine]}>
                <Text style={[styles.bubbleName, h.mine && styles.bubbleTextMine]}>
                  {h.mine ? 'Tú' : h.senderName}
                </Text>
                <Text style={[styles.textBody, h.mine && styles.bubbleTextMine]}>{h.text}</Text>
              </View>
            ) : (
              <PressableScale
                onPress={() => h.audioKey && void playAudio(h.audioKey)}
                style={[styles.voiceBubble, h.mine && styles.bubbleMine]}
                accessibilityLabel="Reproducir nota de voz">
                <View style={[styles.voicePlay, h.mine && styles.voicePlayMine]}>
                  <Icon name="play" size={14} color={h.mine ? Mape.ink : Mape.white} />
                </View>
                <View style={styles.bubbleCol}>
                  <Text style={[styles.bubbleName, h.mine && styles.bubbleTextMine]}>
                    {h.mine ? 'Tú' : h.senderName}
                  </Text>
                  <Text style={[styles.bubbleMeta, h.mine && styles.bubbleTextMine]}>
                    Nota de voz · {fmtDur(h.durationSec)}
                  </Text>
                </View>
              </PressableScale>
            )}
          </View>
        )}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10 }]}>
          <PressableScale
            style={styles.attachBtn}
            onPress={() => void pickImage()}
            accessibilityLabel="Enviar imagen">
            <Icon name="image" size={22} color={Mape.ink} strokeWidth={1.8} />
          </PressableScale>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={Mape.textFaint}
            multiline
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <PressableScale
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnOff]}
            onPress={submit}
            accessibilityLabel="Enviar mensaje">
            <Icon name="send" size={20} color={Mape.white} strokeWidth={2} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gap1: { flex: 1, gap: 1 },
  title: { fontSize: 18, fontFamily: Font.semibold, color: Mape.ink },
  subtitle: { fontSize: 12, fontFamily: Font.regular, color: Mape.textSubtle },

  list: { flex: 1 },
  empty: {
    fontSize: 13,
    color: Mape.textFaint,
    fontFamily: Font.regular,
    textAlign: 'center',
    paddingVertical: 40,
  },

  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  voiceBubble: {
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Mape.white,
    borderRadius: 18,
    padding: 10,
    paddingRight: 14,
  },
  imgBubble: {
    maxWidth: '70%',
    backgroundColor: Mape.white,
    borderRadius: 18,
    padding: 6,
    gap: 4,
  },
  bubbleCol: { flexShrink: 1, gap: 1 },
  bubbleMine: { backgroundColor: Mape.ink },
  voicePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayMine: { backgroundColor: Mape.white },
  chatImg: { width: 200, height: 200, borderRadius: 12, backgroundColor: Mape.border },
  bubbleName: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink, paddingHorizontal: 2 },
  bubbleMeta: { fontSize: 12, fontFamily: Font.regular, color: Mape.textMuted },
  bubbleTextMine: { color: Mape.white },
  textBubble: {
    maxWidth: '80%',
    backgroundColor: Mape.white,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 2,
  },
  textBody: { fontSize: 15, fontFamily: Font.regular, color: Mape.ink },

  bar: {
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: Mape.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: Font.regular,
    color: Mape.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
});
