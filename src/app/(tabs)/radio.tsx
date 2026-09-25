import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Animated from 'react-native-reanimated';

import { LiveDot, PingRing, Waveform } from '@/components/mape/anim';
import { Avatar } from '@/components/mape/avatar';
import { Screen } from '@/components/mape/screen';
import { Icon } from '@/components/mape/icons';
import { fade, rise } from '@/components/mape/motion';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Font, Mape } from '@/constants/mape-theme';
import { useChannels } from '@/features/data/hooks';
import { useRadio } from '@/features/radio/use-radio';

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
  const [showHistory, setShowHistory] = useState(true);

  const channelsQuery = useChannels();
  const channels = channelsQuery.data ?? [];
  const activeChannel = channels[channel];
  const channelNames = channels.length
    ? channels.map((c) => (c.description ? `${c.name} · ${c.description}` : c.name))
    : FALLBACK_CHANNELS;

  const { talking, speaking, history, muted, toggleMuted, startTalking, stopTalking } =
    useRadio(activeChannel?.id);

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
          <PressableScale style={styles.settingsBtn} accessibilityLabel="Ajustes de radio">
            <Icon name="sliders" size={20} color={Mape.white} strokeWidth={1.8} />
          </PressableScale>
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
                <Text style={styles.speakingName}>
                  {speaking.nickname || speaking.name || 'Operador'}
                </Text>
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
          <PingRing size={192} color="#F2B8B5" delay={0} />
          <PingRing size={160} color="#E58A86" delay={600} style={{ top: 16, left: 16 }} />
          <PressableScale
            onPressIn={startTalking}
            onPressOut={stopTalking}
            style={[styles.ptt, talking && styles.pttActive]}
            accessibilityLabel="Mantén presionado para hablar">
            <Icon name="mic" size={36} color={Mape.white} strokeWidth={1.8} />
            <Text style={styles.pttText}>HABLAR</Text>
          </PressableScale>
        </Animated.View>
        <Text style={styles.pttCaption}>Mantén presionado para transmitir a todo el canal</Text>

        {/* Acciones */}
        <Animated.View style={styles.actions} entering={rise(3)}>
          <PressableScale
            style={[styles.actionBtn, !muted && styles.actionBtnActive]}
            onPress={toggleMuted}
            accessibilityLabel="Altavoz">
            <Icon
              name="speaker"
              size={18}
              color={muted ? Mape.ink : Mape.white}
              strokeWidth={1.8}
            />
            <Text style={[styles.actionText, !muted && styles.actionTextActive]}>
              {muted ? 'Silencio' : 'Altavoz'}
            </Text>
          </PressableScale>
          <PressableScale
            style={styles.actionBtn}
            onPress={() => router.push('/nuevo-chat')}
            accessibilityLabel="Mensaje privado">
            <Icon name="userPlus" size={18} color={Mape.ink} strokeWidth={1.8} />
            <Text style={styles.actionText}>Privado</Text>
          </PressableScale>
          <PressableScale
            style={[styles.actionBtn, showHistory && styles.actionBtnActive]}
            onPress={() => setShowHistory((v) => !v)}
            accessibilityLabel="Historial">
            <Icon
              name="clock"
              size={18}
              color={showHistory ? Mape.white : Mape.ink}
              strokeWidth={1.8}
            />
            <Text style={[styles.actionText, showHistory && styles.actionTextActive]}>
              Historial
            </Text>
          </PressableScale>
        </Animated.View>

        {/* Historial */}
        {showHistory && (
        <Animated.View style={styles.history} entering={rise(4)}>
          {history.length === 0 && (
            <Text style={styles.historyEmpty}>Aún no hay transmisiones en este canal.</Text>
          )}
          {history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <View style={styles.historyIcon}>
                <Icon name="radio" size={18} color={Mape.ink} strokeWidth={1.8} />
              </View>
              <View style={styles.gap1}>
                <Text style={styles.historyName}>{h.senderName}</Text>
                <Text style={styles.historyMeta}>{fmtDur(h.durationSec)} · transmisión</Text>
              </View>
              <View style={styles.playBtn}>
                <Icon name="play" size={16} color={Mape.white} />
              </View>
            </View>
          ))}
        </Animated.View>
        )}
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

  pttWrap: { width: 192, height: 192, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 96, borderWidth: 1.5 },
  ringOuter: { top: 0, left: 0, right: 0, bottom: 0, borderColor: '#F2B8B5' },
  ringInner: { top: 16, left: 16, right: 16, bottom: 16, borderColor: '#E58A86' },
  ptt: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pttActive: { backgroundColor: Mape.redDark },
  pttText: { fontSize: 12, color: Mape.white, fontFamily: Font.bold, letterSpacing: 1.2 },
  pttCaption: { fontSize: 12, color: Mape.textSubtle, fontFamily: Font.regular },

  actions: { flexDirection: 'row', gap: 8, width: '100%' },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnActive: { backgroundColor: Mape.ink },
  actionText: { fontSize: 13, color: Mape.ink, fontFamily: Font.semibold },
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
});
