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

/** Hora del mensaje: "14:30" si es hoy, "28/09 14:30" si es otro día. */
function fmtWhen(at?: string | null): string {
  if (!at) return '';
  const d = new Date(at);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

export default function RadioChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { messages, playAudio, sendImage, sendText, playingKey } = useChannelChat(id);
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

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 16}>
        <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 14, gap: 8 }}
        showsVerticalScrollIndicator={false}
        inverted
        ListEmptyComponent={
          <Text style={[styles.empty, styles.emptyInverted]}>
            Aún no hay mensajes en este canal.
          </Text>
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
                <Text style={[styles.bubbleTime, h.mine && styles.bubbleTextMine]}>
                  {fmtWhen(h.at)}
                </Text>
              </PressableScale>
            ) : h.text ? (
              <View style={[styles.textBubble, h.mine && styles.bubbleMine]}>
                <Text style={[styles.bubbleName, h.mine && styles.bubbleTextMine]}>
                  {h.mine ? 'Tú' : h.senderName}
                </Text>
                <Text style={[styles.textBody, h.mine && styles.bubbleTextMine]}>{h.text}</Text>
                <Text style={[styles.bubbleTime, h.mine && styles.bubbleTextMine]}>
                  {fmtWhen(h.at)}
                </Text>
              </View>
            ) : (
              <PressableScale
                onPress={() => h.audioKey && void playAudio(h.audioKey, h.durationSec)}
                style={[styles.voiceBubble, h.mine && styles.bubbleMine]}
                accessibilityLabel="Reproducir nota de voz">
                <View
                  style={[
                    styles.voicePlay,
                    h.mine && styles.voicePlayMine,
                    h.audioKey === playingKey && styles.voicePlayOn,
                  ]}>
                  <Icon
                    name={h.audioKey === playingKey ? 'speaker' : 'play'}
                    size={14}
                    color={
                      h.audioKey === playingKey
                        ? Mape.white
                        : h.mine
                          ? Mape.ink
                          : Mape.white
                    }
                  />
                </View>
                <View style={styles.bubbleCol}>
                  <Text style={[styles.bubbleName, h.mine && styles.bubbleTextMine]}>
                    {h.mine ? 'Tú' : h.senderName}
                  </Text>
                  <Text style={[styles.bubbleMeta, h.mine && styles.bubbleTextMine]}>
                    {h.audioKey === playingKey
                      ? 'Reproduciendo…'
                      : `Nota de voz · ${fmtDur(h.durationSec)}${
                          fmtWhen(h.at) ? ` · ${fmtWhen(h.at)}` : ''
                        }`}
                  </Text>
                </View>
              </PressableScale>
            )}
          </View>
        )}
      />

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

  kav: { flex: 1 },
  list: { flex: 1 },
  empty: {
    fontSize: 13,
    color: Mape.textFaint,
    fontFamily: Font.regular,
    textAlign: 'center',
    paddingVertical: 40,
  },
  // La FlatList invertida voltea su contenido; recompensamos el texto vacío.
  emptyInverted: { transform: [{ scaleY: -1 }] },

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
  voicePlayOn: { backgroundColor: Mape.red },
  chatImg: { width: 200, height: 200, borderRadius: 12, backgroundColor: Mape.border },
  bubbleName: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink, paddingHorizontal: 2 },
  bubbleMeta: { fontSize: 12, fontFamily: Font.regular, color: Mape.textMuted },
  bubbleTime: {
    fontSize: 10,
    fontFamily: Font.regular,
    color: Mape.textFaint,
    paddingHorizontal: 2,
    marginTop: 1,
  },
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
