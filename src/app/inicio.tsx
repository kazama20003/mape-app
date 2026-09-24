import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { DashRoute, FloatView, LiveDot, PingRing } from '@/components/mape/anim';
import { Avatar } from '@/components/mape/avatar';
import { Icon } from '@/components/mape/icons';
import { PressableScale } from '@/components/mape/pressable-scale';
import { Screen } from '@/components/mape/screen';
import { Font, Mape } from '@/constants/mape-theme';

const STEPS = [
  {
    title: ['Tu flota,', 'en tiempo real.'],
    text: 'Ubica a cada operador y unidad en el mapa, con velocidad, ruta y llegada estimada al instante.',
  },
  {
    title: ['Habla con', 'todo el equipo.'],
    text: 'Un comunicador tipo radio: mantén presionado y todos en el canal te escuchan al momento.',
  },
  {
    title: ['Coordina', 'por chat.'],
    text: 'Mensajes, notas de voz, fotos de guías y ubicación compartida, por grupo o con cada operador.',
  },
];

export default function InicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const go = (n: number) => setSlide(Math.max(0, Math.min(2, n)));

  return (
    <Screen style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      {/* Cabecera */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Icon name="pin" size={22} color={Mape.white} />
          </View>
          <Text style={styles.brand}>Mape</Text>
        </View>
        <PressableScale style={styles.skip} onPress={() => router.push('/login')}>
          <Text style={styles.skipText}>Saltar</Text>
        </PressableScale>
      </View>

      {/* Contenido del paso (se re-anima al cambiar) */}
      <View style={styles.stage}>
        <Animated.View key={slide} entering={FadeIn.duration(350)} style={styles.slide}>
          <View style={styles.textBlock}>
            <Text style={styles.step}>PASO {slide + 1} DE 3</Text>
            <Text style={styles.h1}>
              {STEPS[slide].title[0]}
              {'\n'}
              <Text style={styles.h1Light}>{STEPS[slide].title[1]}</Text>
            </Text>
            <Text style={styles.lead}>{STEPS[slide].text}</Text>
          </View>
          <View style={styles.art}>
            {slide === 0 && <ArtMapa />}
            {slide === 1 && <ArtRadio />}
            {slide === 2 && <ArtChat />}
          </View>
        </Animated.View>
      </View>

      {/* Pie: progreso + navegación */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <PressableScale
              key={i}
              onPress={() => go(i)}
              style={[styles.dot, i === slide && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.navBtns}>
          {slide > 0 && (
            <PressableScale style={styles.prevBtn} onPress={() => go(slide - 1)}>
              <Icon name="chevronLeft" size={20} color={Mape.ink} />
            </PressableScale>
          )}
          {slide < 2 ? (
            <PressableScale style={styles.nextBtn} onPress={() => go(slide + 1)}>
              <Text style={styles.nextText}>Siguiente</Text>
              <View style={styles.nextIconWhite}>
                <Icon name="chevronRight" size={20} color={Mape.ink} />
              </View>
            </PressableScale>
          ) : (
            <PressableScale style={styles.nextBtn} onPress={() => router.push('/login')}>
              <Text style={styles.nextText}>Comenzar</Text>
              <View style={styles.nextIconRed}>
                <Icon name="chevronRight" size={20} color={Mape.white} />
              </View>
            </PressableScale>
          )}
        </View>
      </View>
    </Screen>
  );
}

/* ── Ilustraciones por paso ── */
function ArtMapa() {
  return (
    <View style={{ height: 250, marginHorizontal: -28 }}>
      <Svg width="100%" height={250} viewBox="0 0 390 250" fill="none">
        <DashRoute
          d="M-10 180 C 40 180, 60 110, 110 110 S 170 190, 220 180 S 270 80, 320 86 S 380 170, 400 140"
          stroke={Mape.ink}
          strokeWidth={2.5}
          dashArray="6 7"
        />
        <Circle cx={110} cy={110} r={7} fill={Mape.bg} stroke={Mape.ink} strokeWidth={2.5} />
        <Circle cx={220} cy={180} r={7} fill={Mape.bg} stroke={Mape.ink} strokeWidth={2.5} />
        <G transform="translate(320 86)">
          <Path d="M0 6 C -14 -10, -14 -30, 0 -30 C 14 -30, 14 -10, 0 6 Z" fill={Mape.red} />
          <Circle cx={0} cy={-18} r={5} fill="#FFFFFF" />
        </G>
        <G transform="translate(150 140)">
          <Rect x={0} y={0} width={46} height={26} rx={5} fill={Mape.ink} />
          <Path d="M46 8h12l8 8v10H46z" fill={Mape.ink} />
          <Rect x={50} y={11} width={8} height={6} rx={1} fill={Mape.bg} />
          <Circle cx={12} cy={28} r={5} fill={Mape.ink} stroke={Mape.bg} strokeWidth={2} />
          <Circle cx={56} cy={28} r={5} fill={Mape.ink} stroke={Mape.bg} strokeWidth={2} />
        </G>
      </Svg>
      <FloatView style={{ position: 'absolute', left: 86, top: 40 }}>
        <Avatar variant="juan" size={48} radius={24} borderWidth={3} borderColor={Mape.white} />
      </FloatView>
      <FloatView delay={700} style={{ position: 'absolute', left: 196, top: 200 }}>
        <Avatar variant="luis" size={48} radius={24} borderWidth={3} borderColor={Mape.white} />
      </FloatView>
    </View>
  );
}

function ArtRadio() {
  return (
    <View style={styles.radioArt}>
      <PingRing size={220} color="#F2B8B5" delay={0} />
      <PingRing size={180} color="#E58A86" delay={600} />
      <View style={styles.pttCircle}>
        <Icon name="mic" size={36} color={Mape.white} strokeWidth={1.8} />
        <Text style={styles.pttText}>HABLAR</Text>
      </View>
      <FloatView style={{ position: 'absolute', left: 28, top: 30 }}>
        <Avatar variant="carlos" size={44} radius={22} borderWidth={3} borderColor={Mape.white} />
      </FloatView>
      <FloatView delay={700} style={{ position: 'absolute', right: 30, top: 52 }}>
        <Avatar variant="rosa" size={44} radius={22} borderWidth={3} borderColor={Mape.white} />
      </FloatView>
      <FloatView delay={1400} style={{ position: 'absolute', left: 50, bottom: 22 }}>
        <Avatar variant="luis" size={44} radius={22} borderWidth={3} borderColor={Mape.white} />
      </FloatView>
      <View style={styles.channelBadge}>
        <LiveDot size={7} color={Mape.red} />
        <Text style={styles.channelBadgeText}>12 en el canal</Text>
      </View>
    </View>
  );
}

function ArtChat() {
  return (
    <View style={styles.chatArt}>
      <View style={styles.chatIn}>
        <Avatar variant="juan" size={32} radius={16} />
        <View style={styles.bubbleIn}>
          <Text style={styles.bubbleInText}>Salí del almacén con la carga completa.</Text>
        </View>
      </View>
      <View style={styles.bubbleOut}>
        <Text style={styles.bubbleOutText}>Perfecto. Luis, ¿cómo vas?</Text>
      </View>
      <View style={styles.chatIn}>
        <Avatar variant="luis" size={32} radius={16} />
        <View style={styles.locCard}>
          <View style={styles.locIcon}>
            <Icon name="pin" size={18} color={Mape.white} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.locTitle}>Ubicación en vivo</Text>
            <Text style={styles.locSub}>Km 18 · Panamericana Norte</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Mape.bg, paddingHorizontal: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Mape.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 22, fontFamily: Font.bold, letterSpacing: -0.5, color: Mape.ink },
  skip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Mape.white, justifyContent: 'center' },
  skipText: { fontSize: 14, fontFamily: Font.semibold, color: Mape.ink },

  stage: { flex: 1, marginTop: 28, overflow: 'hidden' },
  slide: { flex: 1 },
  textBlock: { gap: 14 },
  step: { fontSize: 12, fontFamily: Font.bold, letterSpacing: 1.2, color: Mape.redDark },
  h1: { fontSize: 42, lineHeight: 44, fontFamily: Font.medium, letterSpacing: -1.5, color: Mape.ink },
  h1Light: { fontFamily: Font.light },
  lead: { fontSize: 15, lineHeight: 22, color: '#4A4A4A', maxWidth: 310, fontFamily: Font.regular },
  art: { flex: 1, justifyContent: 'center', marginTop: 26 },

  radioArt: { height: 250, alignItems: 'center', justifyContent: 'center' },
  pttCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pttText: { fontSize: 11, fontFamily: Font.bold, letterSpacing: 1.2, color: Mape.white },
  channelBadge: {
    position: 'absolute',
    right: 26,
    bottom: 34,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: Mape.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelBadgeText: { fontSize: 12, fontFamily: Font.semibold, color: Mape.white },

  chatArt: { gap: 10, justifyContent: 'center' },
  chatIn: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', maxWidth: 280 },
  bubbleIn: { backgroundColor: Mape.white, borderRadius: 20, borderBottomLeftRadius: 6, paddingVertical: 12, paddingHorizontal: 14 },
  bubbleInText: { fontSize: 14, lineHeight: 20, color: Mape.ink, fontFamily: Font.regular },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: Mape.ink,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: 260,
  },
  bubbleOutText: { fontSize: 14, lineHeight: 20, color: Mape.white, fontFamily: Font.regular },
  locCard: { backgroundColor: Mape.white, borderRadius: 20, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  locIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Mape.red, alignItems: 'center', justifyContent: 'center' },
  locTitle: { fontSize: 13, fontFamily: Font.semibold, color: Mape.ink },
  locSub: { fontSize: 11, color: Mape.textMuted, fontFamily: Font.regular },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9C9C9' },
  dotActive: { width: 22, backgroundColor: Mape.ink },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prevBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 60,
    paddingLeft: 24,
    paddingRight: 8,
    borderRadius: 30,
    backgroundColor: Mape.ink,
  },
  nextText: { color: Mape.white, fontSize: 16, fontFamily: Font.semibold },
  nextIconWhite: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextIconRed: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Mape.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
