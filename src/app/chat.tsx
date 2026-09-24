import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { Avatar, type AvatarVariant } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { fade } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { useConversation, useSendMessage } from '@/features/data/hooks';
import { api, mediaUrl } from '@/lib/api';
import type { ChatUser, Message } from '@/lib/types';

const AVATAR_VARIANTS: string[] = ['juan', 'luis', 'carlos', 'rosa', 'me', 'meLight'];
function variantFor(key: string | null | undefined): AvatarVariant {
  return key && AVATAR_VARIANTS.includes(key) ? (key as AvatarVariant) : 'juan';
}
function senderName(u?: ChatUser | null) {
  return u?.nickname || u?.name || 'Operador';
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Burbuja de nota de voz con reproducción. */
function VoiceBubble({ uri, dark }: { uri: string | null; dark?: boolean }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => playerRef.current?.remove(), []);

  const toggle = async () => {
    if (!uri) return;
    try {
      if (!playerRef.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        playerRef.current = createAudioPlayer(uri);
      }
      const p = playerRef.current;
      if (playing) {
        p.pause();
        setPlaying(false);
      } else {
        p.seekTo(0);
        p.play();
        setPlaying(true);
        setTimeout(() => setPlaying(false), 8000);
      }
    } catch {
      setPlaying(false);
    }
  };

  return (
    <PressableScale
      onPress={toggle}
      style={[styles.voicePlay, dark && { backgroundColor: Mape.white }]}
      accessibilityLabel="Reproducir nota de voz">
      <Icon name="play" size={16} color={dark ? Mape.ink : Mape.white} />
    </PressableScale>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();

  const convo = useConversation(id);
  const send = useSendMessage(id);
  const scrollRef = useRef<ScrollView>(null);

  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recStartRef = useRef(0);

  const data = convo.data;
  const messages = useMemo(() => data?.messages ?? [], [data]);
  const meId = user?.id;

  const title = useMemo(() => {
    const c = data?.conversation;
    if (!c) return 'Conversación';
    if (c.title) return c.title as string;
    const others = (c.members ?? []).filter((m: any) => m.user?.id !== meId);
    return others.map((m: any) => senderName(m.user)).join(', ') || 'Conversación';
  }, [data, meId]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Al salir de la conversación, libera el micrófono por si quedó grabando.
  useEffect(
    () => () => {
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    },
    [],
  );

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    send.mutate({ type: 'TEXT', body });
  };

  const startRec = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStartRef.current = Date.now();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stopRecAndSend = async () => {
    if (!recording) return;
    setRecording(false);
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return;
      const durationSec = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
      const up = await api.upload(uri, { name: 'nota.m4a', type: 'audio/m4a' });
      await send.mutateAsync({ type: 'VOICE', attachmentKey: up.key, durationSec });
    } catch {
      // no rompemos la UI
    } finally {
      setBusy(false);
    }
  };

  const attach = async (kind: 'images' | 'videos') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [kind],
      quality: 0.6,
      videoMaxDuration: 30,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      const isVideo = kind === 'videos';
      const up = await api.upload(asset.uri, {
        name: asset.fileName ?? (isVideo ? 'video.mp4' : 'foto.jpg'),
        type: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      });
      await send.mutateAsync({
        type: isVideo ? 'VIDEO' : 'IMAGE',
        attachmentKey: up.key,
      });
    } catch {
      // ignora
    } finally {
      setBusy(false);
    }
  };

  const renderBubble = (m: Message) => {
    const mine = m.senderId === meId;
    const url = mediaUrl(m.attachmentKey);
    switch (m.type) {
      case 'VOICE':
        return (
          <View style={[styles.mediaBubble, mine ? styles.bubbleOut : styles.bubbleIn]}>
            <VoiceBubble uri={url} dark={mine} />
            <Text style={[styles.voiceTime, mine && { color: Mape.textOnDark }]}>
              {m.durationSec ? `0:${String(m.durationSec).padStart(2, '0')}` : 'Nota de voz'}
            </Text>
          </View>
        );
      case 'IMAGE':
        return url ? (
          <Image source={{ uri: url }} style={styles.imageMsg} contentFit="cover" transition={150} />
        ) : null;
      case 'VIDEO':
        return (
          <PressableScale
            style={styles.videoCard}
            onPress={() => url && Linking.openURL(url)}
            accessibilityLabel="Reproducir video">
            <View style={styles.videoPlay}>
              <Icon name="play" size={20} color={Mape.white} />
            </View>
            <Text style={styles.videoText}>Video · toca para ver</Text>
          </PressableScale>
        );
      default:
        return (
          <View style={mine ? styles.bubbleOut : styles.bubbleIn}>
            <Text style={mine ? styles.bubbleOutText : styles.bubbleInText}>{m.body}</Text>
          </View>
        );
    }
  };

  return (
    <Screen style={styles.root} transition="push">
      <Animated.View style={[styles.header, { paddingTop: insets.top + 12 }]} entering={fade(0)}>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => router.navigate('/chats')}
          accessibilityLabel="Volver a chats">
          <Icon name="chevronLeft" size={20} color={Mape.ink} />
        </PressableScale>
        <View style={styles.groupIcon}>
          <Icon name="chat" size={20} color={Mape.white} strokeWidth={1.8} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSub}>
            {data?.conversation?.members?.length ?? 0} miembros
          </Text>
        </View>
        <PressableScale
          style={styles.iconBtn}
          onPress={() => router.navigate('/radio')}
          accessibilityLabel="Abrir radio">
          <Icon name="radio" size={20} color={Mape.ink} strokeWidth={1.8} />
        </PressableScale>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {convo.isLoading && <ActivityIndicator color={Mape.ink} style={{ marginTop: 20 }} />}
          {messages.map((m) => {
            const mine = m.senderId === meId;
            if (mine) {
              return (
                <View key={m.id} style={styles.outgoing}>
                  {renderBubble(m)}
                  <Text style={styles.timeOut}>{fmtTime(m.createdAt)}</Text>
                </View>
              );
            }
            return (
              <View key={m.id} style={styles.incoming}>
                <Avatar
                  variant={variantFor(m.sender?.avatarKey)}
                  uri={mediaUrl(m.sender?.avatarKey)}
                  size={32}
                  radius={16}
                />
                <View style={styles.incomingCol}>
                  <Text style={styles.sender}>{senderName(m.sender)}</Text>
                  {renderBubble(m)}
                  <Text style={styles.timeIn}>{fmtTime(m.createdAt)}</Text>
                </View>
              </View>
            );
          })}
          {!convo.isLoading && messages.length === 0 && (
            <Text style={styles.empty}>Aún no hay mensajes. ¡Saluda!</Text>
          )}
        </ScrollView>

        {/* Barra de entrada */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
          {recording ? (
            <>
              <View style={styles.recIndicator}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>Grabando… toca enviar ▶</Text>
              </View>
              <PressableScale
                style={[styles.inputBtn, styles.sendBtn]}
                onPress={stopRecAndSend}
                accessibilityLabel="Enviar nota de voz">
                <Icon name="send" size={18} color={Mape.white} />
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale
                style={styles.inputBtn}
                onPress={() => attach('images')}
                accessibilityLabel="Enviar imagen">
                <Icon name="image" size={20} color={Mape.ink} />
              </PressableScale>
              <PressableScale
                style={styles.inputBtn}
                onPress={() => attach('videos')}
                accessibilityLabel="Enviar video">
                <Icon name="play" size={20} color={Mape.ink} />
              </PressableScale>
              <View style={styles.inputWrap}>
                <TextInput
                  placeholder="Escribe un mensaje"
                  placeholderTextColor="#8A8A8A"
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={sendText}
                  returnKeyType="send"
                />
              </View>
              {busy ? (
                <View style={styles.inputBtn}>
                  <ActivityIndicator size="small" color={Mape.ink} />
                </View>
              ) : text.trim().length > 0 ? (
                <PressableScale
                  style={[styles.inputBtn, styles.sendBtn]}
                  onPress={sendText}
                  accessibilityLabel="Enviar">
                  <Icon name="send" size={18} color={Mape.white} />
                </PressableScale>
              ) : (
                <PressableScale
                  style={styles.inputBtn}
                  onPress={startRec}
                  accessibilityLabel="Grabar nota de voz">
                  <Icon name="mic" size={20} color={Mape.ink} strokeWidth={1.8} />
                </PressableScale>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Mape.borderLight,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, gap: 2, minWidth: 0 },
  headerTitle: { fontSize: 16, fontFamily: Font.semibold, color: Mape.ink },
  headerSub: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },

  messages: { flex: 1 },
  messagesContent: { padding: 24, paddingBottom: 8, gap: 14 },
  empty: {
    textAlign: 'center',
    color: Mape.textFaint,
    fontFamily: Font.regular,
    fontSize: 14,
    marginTop: 30,
  },

  incoming: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', maxWidth: 300 },
  incomingCol: { flex: 1, gap: 4 },
  sender: { fontSize: 12, color: Mape.textMuted, paddingLeft: 4, fontFamily: Font.regular },
  bubbleIn: {
    backgroundColor: Mape.white,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleInText: { fontSize: 14, lineHeight: 20, color: Mape.ink, fontFamily: Font.regular },
  timeIn: { fontSize: 11, color: Mape.timestamp, paddingLeft: 4, fontFamily: Font.regular },

  outgoing: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 4, maxWidth: 290 },
  bubbleOut: {
    backgroundColor: Mape.ink,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleOutText: { fontSize: 14, lineHeight: 20, color: Mape.white, fontFamily: Font.regular },
  timeOut: { fontSize: 11, color: Mape.timestamp, paddingRight: 4, fontFamily: Font.regular },

  mediaBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 140,
  },
  voicePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTime: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },

  imageMsg: { width: 200, height: 200, borderRadius: 18, backgroundColor: '#E3E3E3' },
  videoCard: {
    width: 220,
    height: 120,
    borderRadius: 18,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { color: Mape.white, fontSize: 12, fontFamily: Font.regular },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: Mape.bg,
  },
  inputBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: { backgroundColor: Mape.red },
  inputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: Mape.white,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: { fontSize: 14, color: Mape.ink, fontFamily: Font.regular, padding: 0 },

  recIndicator: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Mape.red },
  recText: { fontSize: 14, color: Mape.ink, fontFamily: Font.regular },
});
