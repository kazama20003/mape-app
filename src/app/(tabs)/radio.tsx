import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { LiveDot, PingRing, Waveform } from '@/components/mape/anim';
import { Avatar } from '@/components/mape/avatar';
import { Screen } from '@/components/mape/screen';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Font, Mape } from '@/constants/mape-theme';
import { useAuth } from '@/features/auth/auth-context';
import { useChannels } from '@/features/data/hooks';
import { useChannelChat } from '@/features/radio/use-channel-chat';
import { useRadioSfu } from '@/features/radio/use-radio-sfu';
import { playEndBeep } from '@/features/radio/beeps';
import { useRadioNotification } from '@/features/radio/use-radio-notification';
import { radioSession, useRadioDisconnected } from '@/features/radio/radio-session';

const SPEAKER_BARS = [8, 18, 26, 12, 22, 10, 16];
const FALLBACK_CHANNELS = ['Canal 1', 'Canal 2 · Norte', 'Taller'];

function fmtDur(sec: number): string {
  const s = Math.round(sec);
  return `0:${String(s).padStart(2, '0')}`;
}

export default function RadioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [channel, setChannel] = useState(0);

  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const channelsQuery = useChannels();
  const channels = channelsQuery.data ?? [];
  const activeChannel = channels[channel];
  const channelNames = channels.length
    ? channels.map((c) => (c.description ? `${c.name} · ${c.description}` : c.name))
    : FALLBACK_CHANNELS;

  // Ruteo de salida (lo manda el botón, estricto):
  //  - Altavoz (speakerOn=true)  -> fuerza el altavoz del teléfono.
  //  - Normal   (speakerOn=false) -> ruteo normal: audífono si hay, si no auricular.
  const [speakerOn, setSpeakerOn] = useState(true);

  // ¿Se pulsó "Desconectar" en la notificación? Al enfocar la pestaña de radio
  // se reconecta automáticamente.
  const disconnected = useRadioDisconnected();
  useFocusEffect(
    useCallback(() => {
      radioSession.rejoin();
    }, []),
  );

  // Audio EN VIVO por SFU (mediasoup): hablar/escuchar en tiempo real. Si está
  // desconectado (botón de la notificación), no se monta la sesión (channelId
  // undefined -> se libera el audio).
  const { talking, speaking, startTalking, stopTalking } = useRadioSfu(
    disconnected ? undefined : activeChannel?.id,
    false, // la radio no se silencia
  );

  // Historial del canal (para reescuchar el último audio guardado).
  const { messages, playAudio } = useChannelChat(activeChannel?.id);
  const hasLastAudio = messages.some((m) => m.audioKey);
  const playLast = () => {
    const last = messages.find((m) => m.audioKey);
    if (last) void playAudio(last.audioKey, last.durationSec);
  };

  const openChat = () => {
    if (!activeChannel) return;
    router.push({
      pathname: '/radio-chat',
      params: { id: activeChannel.id, name: channelNames[channel] },
    });
  };

  // Notificación persistente del canal: estado + botón "Hablar" (abre la app).
  const radioStatus = talking
    ? 'Transmitiendo…'
    : speaking
      ? 'Alguien está hablando'
      : 'Escuchando';
  useRadioNotification(
    activeChannel && !disconnected ? channelNames[channel] : undefined,
    !!activeChannel && !disconnected,
    radioStatus,
  );

  // Aplica el ruteo según el botón: Altavoz fuerza el parlante; Normal no fuerza
  // (suena en audífono si hay, si no en el auricular).
  useEffect(() => {
    if (!activeChannel || disconnected) return;
    const apply = () => {
      try {
        InCallManager.setForceSpeakerphoneOn(speakerOn);
      } catch {
        /* noop */
      }
    };
    apply();
    const t = setTimeout(apply, 500); // re-aplica por si InCallManager tardó en iniciar
    return () => clearTimeout(t);
  }, [speakerOn, activeChannel, disconnected]);

  // Hablar MANTENIENDO presionado o con un TOQUE (queda fijado hasta el próximo
  // toque). Usamos refs para no depender del estado async dentro del gesto.
  const pressStartRef = useRef(0);
  const latchedRef = useRef(false);

  const onPttIn = () => {
    if (latchedRef.current && talking) {
      // Estaba fijado por un toque Y transmitiendo: este toque lo corta.
      latchedRef.current = false;
      void stopTalking();
      return;
    }
    latchedRef.current = false; // limpia un latch viejo o de un intento fallido
    // Half-duplex: si otro tiene la palabra, no interrumpimos. Hay que esperar a
    // que termine (el pitido de fin avisa cuándo queda libre el canal).
    if (speaking) {
      playEndBeep();
      return;
    }
    pressStartRef.current = Date.now();
    void startTalking();
  };
  const onPttOut = () => {
    if (latchedRef.current) return;
    const heldMs = Date.now() - pressStartRef.current;
    if (heldMs < 350) {
      latchedRef.current = true; // fue un toque: queda transmitiendo
    } else {
      void stopTalking(); // fue mantenido: corta al soltar
    }
  };

  return (
    <Screen style={styles.root} transition="fade">
      {/* Cabecera oscura */}
      <Animated.View style={[styles.header, { paddingTop: insets.top + 20 }]} entering={fade(0)}>
        <View style={styles.headerTop}>
          <View style={styles.gap2}>
            <Text style={styles.headerLabel}>Canal activo</Text>
            <Text style={styles.headerTitle}>
              {activeChannel ? channelNames[channel] : 'Operaciones · Canal 1'}
            </Text>
          </View>
          {canManage && (
            <PressableScale
              style={styles.settingsBtn}
              onPress={() => router.navigate('/admin-canales')}
              accessibilityLabel="Gestionar canales">
              <Icon name="plus" size={22} color={Mape.white} strokeWidth={2.2} />
            </PressableScale>
          )}
        </View>

        <View style={styles.channels}>
          {channelNames.map((c, i) => {
            const active = i === channel;
            return (
              <PressableScale
                key={c}
                onPress={() => setChannel(i)}
                style={[styles.channelChip, active && styles.channelChipActive]}>
                <Text style={[styles.channelText, active && styles.channelTextActive]}>{c}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.connected}>
          <View style={styles.connectedLeft}>
            <View style={styles.avatarStack}>
              <Avatar variant="juan" size={32} borderWidth={2} borderColor={Mape.panelDark} />
              <View style={styles.overlap}>
                <Avatar variant="luis" size={32} borderWidth={2} borderColor={Mape.panelDark} />
              </View>
              <View style={styles.overlap}>
                <Avatar variant="carlos" size={32} borderWidth={2} borderColor={Mape.panelDark} />
              </View>
              <View style={styles.overlap}>
                <Avatar variant="rosa" size={32} borderWidth={2} borderColor={Mape.panelDark} />
              </View>
              <View style={[styles.overlap, styles.plusAvatar]}>
                <Text style={styles.plusText}>+8</Text>
              </View>
            </View>
            <Text style={styles.connectedText}>
              {activeChannel?.memberCount ?? 0} conectados
            </Text>
          </View>
          <View style={styles.liveRow}>
            <LiveDot size={8} color={Mape.red} />
            <Text style={styles.liveText}>En vivo</Text>
          </View>
        </View>
      </Animated.View>

      {/* Cuerpo */}
      <View style={styles.body}>
        {/* Hablando ahora */}
        <Animated.View style={styles.speakingPill} entering={rise(1)}>
          {talking ? (
            <>
              <View style={styles.txDot} />
              <View style={styles.gap1}>
                <Text style={styles.speakingLabel}>TRANSMITIENDO</Text>
                <Text style={styles.speakingName}>Tú · en el canal</Text>
              </View>
              <Waveform heights={SPEAKER_BARS} color={Mape.red} style={{ marginLeft: 6 }} />
            </>
          ) : speaking ? (
            <>
              <View style={styles.txDot} />
              <View style={styles.gap1}>
                <Text style={styles.speakingLabel}>HABLANDO AHORA</Text>
                <Text style={styles.speakingName}>En vivo · alguien del canal</Text>
              </View>
              <Waveform heights={SPEAKER_BARS} color={Mape.red} style={{ marginLeft: 6 }} />
            </>
          ) : (
            <View style={styles.gap1}>
              <Text style={styles.speakingLabel}>CANAL</Text>
              <Text style={styles.speakingName}>En silencio</Text>
            </View>
          )}
        </Animated.View>

        {/* Botón PTT */}
        <Animated.View style={styles.pttWrap} entering={rise(2)}>
          <PingRing size={292} color="#F2B8B5" delay={0} />
          <PingRing size={266} color="#E58A86" delay={600} style={{ top: 13, left: 13 }} />
          <PressableScale
            onPressIn={onPttIn}
            onPressOut={onPttOut}
            style={[styles.ptt, talking && styles.pttActive]}
            accessibilityLabel="Mantén presionado o toca para hablar">
            <View style={styles.pttInner}>
              <Icon name="mic" size={66} color={Mape.white} strokeWidth={2} />
              <Text style={styles.pttText}>{talking ? 'CORTAR' : 'HABLAR'}</Text>
            </View>
          </PressableScale>
        </Animated.View>
        <Text style={styles.pttCaption}>
          Mantén presionado o toca una vez para transmitir
        </Text>

        {/* Acciones */}
        <Animated.View style={styles.actions} entering={rise(3)}>
          <PressableScale
            style={[styles.actionBtn, speakerOn && styles.actionBtnActive]}
            onPress={() => setSpeakerOn((v) => !v)}
            accessibilityLabel="Alternar altavoz o normal">
            <Icon
              name="speaker"
              size={18}
              color={speakerOn ? Mape.white : Mape.ink}
              strokeWidth={1.8}
            />
            <Text style={[styles.actionText, speakerOn && styles.actionTextActive]}>
              {speakerOn ? 'Altavoz' : 'Normal'}
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.actionBtn, !hasLastAudio && styles.actionBtnOff]}
            onPress={() => hasLastAudio && void playLast()}
            accessibilityLabel="Escuchar el último audio">
            <Icon name="play" size={18} color={Mape.ink} strokeWidth={2} />
            <Text style={styles.actionText}>Último</Text>
          </PressableScale>
          <PressableScale
            style={styles.actionBtn}
            onPress={openChat}
            accessibilityLabel="Ver chat del canal">
            <Icon name="chat" size={18} color={Mape.ink} strokeWidth={1.8} />
            <Text style={styles.actionText}>Chat</Text>
          </PressableScale>
        </Animated.View>

      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg },
  gap1: { flex: 1, gap: 1 },
  gap2: { gap: 2 },

  header: {
    backgroundColor: Mape.ink,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: 24,
    paddingBottom: 18,
    gap: 14,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel: { fontSize: 13, color: Mape.textOnDarkSoft, fontFamily: Font.regular },
  headerTitle: { fontSize: 24, color: Mape.white, fontFamily: Font.semibold, letterSpacing: -0.5 },
  settingsBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: Mape.panelBorder,
    backgroundColor: Mape.panelDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channels: { flexDirection: 'row', gap: 8 },
  channelChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Mape.panelBorder,
    backgroundColor: Mape.panelDark,
    justifyContent: 'center',
  },
  channelChipActive: { backgroundColor: Mape.red, borderColor: Mape.red },
  channelText: { fontSize: 13, color: Mape.white, fontFamily: Font.medium },
  channelTextActive: { fontFamily: Font.semibold },

  connected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Mape.panelDark,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  connectedLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack: { flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  plusAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3A3A3A',
    borderWidth: 2,
    borderColor: Mape.panelDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: Mape.white, fontSize: 11, fontFamily: Font.bold },
  connectedText: { fontSize: 13, color: '#E2E2E2', fontFamily: Font.regular },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Mape.red },
  liveText: { fontSize: 12, color: Mape.white, fontFamily: Font.semibold },

  body: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, gap: 10 },
  speakingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Mape.white,
    borderRadius: 22,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    alignSelf: 'center',
  },
  speakingLabel: { fontSize: 11, color: Mape.redDark, fontFamily: Font.bold, letterSpacing: 0.6 },
  speakingName: { fontSize: 14, color: Mape.ink, fontFamily: Font.semibold },
  txDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Mape.red, marginLeft: 4 },
  wave: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26, marginLeft: 6 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: Mape.red },

  pttWrap: { width: 292, height: 292, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 96, borderWidth: 1.5 },
  ringOuter: { top: 0, left: 0, right: 0, bottom: 0, borderColor: '#F2B8B5' },
  ringInner: { top: 16, left: 16, right: 16, bottom: 16, borderColor: '#E58A86' },
  ptt: {
    width: 248,
    height: 248,
    borderRadius: 124,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: Mape.red,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pttInner: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  pttActive: { backgroundColor: Mape.redDark },
  pttText: { fontSize: 18, color: Mape.white, fontFamily: Font.bold, letterSpacing: 1.6 },
  pttCaption: { fontSize: 12, color: Mape.textSubtle, fontFamily: Font.regular, textAlign: 'center' },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: Mape.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  replayText: { fontSize: 13, color: Mape.ink, fontFamily: Font.semibold },

  actions: { flexDirection: 'row', gap: 6, width: '100%' },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  actionBtnActive: { backgroundColor: Mape.ink },
  actionBtnOff: { opacity: 0.4 },
  actionText: { fontSize: 12, color: Mape.ink, fontFamily: Font.semibold },
  actionTextActive: { color: Mape.white },

  history: { width: '100%', gap: 6 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Mape.white,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  historyName: { fontSize: 14, color: Mape.ink, fontFamily: Font.semibold },
  historyMeta: { fontSize: 12, color: Mape.textMuted, fontFamily: Font.regular },
  historyEmpty: { fontSize: 13, color: Mape.textFaint, fontFamily: Font.regular, textAlign: 'center', paddingVertical: 8 },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnOff: { opacity: 0.3 },

  chat: { width: '100%', gap: 8 },
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
  chatImg: { width: 180, height: 180, borderRadius: 12, backgroundColor: Mape.border },
  bubbleName: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink, paddingHorizontal: 2 },
  bubbleMeta: { fontSize: 12, fontFamily: Font.regular, color: Mape.textMuted },
  bubbleTextMine: { color: Mape.white },
});
