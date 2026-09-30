import { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

import { Mape } from '@/constants/mape-theme';

const THUMB = 22;

/**
 * Slider de volumen ligero (sin dependencias nativas): usa PanResponder de RN.
 * `value` es una fracción 0..1; `onChange` se llama al tocar/arrastrar.
 */
export function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const setFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    let v = x / w;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    onChange(v);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const pct = Math.max(0, Math.min(1, value));
  const thumbLeft = pct * width - THUMB / 2;

  return (
    <View
      style={styles.wrap}
      onLayout={onLayout}
      {...pan.panHandlers}
      accessibilityLabel="Volumen de la radio">
      <View style={styles.track} />
      <View style={[styles.fill, { width: pct * width }]} />
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    height: THUMB + 12,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Mape.border,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: Mape.ink,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Mape.ink,
    borderWidth: 3,
    borderColor: Mape.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
