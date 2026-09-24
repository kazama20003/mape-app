import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type AvatarVariant = 'juan' | 'luis' | 'carlos' | 'rosa' | 'me' | 'meLight';

type Props = {
  variant: AvatarVariant;
  /** Foto real (URL). Si se pasa, se muestra en vez de la ilustración. */
  uri?: string | null;
  size?: number;
  /** Radio del contenedor. Por defecto la mitad del tamaño (círculo). */
  radius?: number;
  /** Borde opcional (ancho, color). */
  borderWidth?: number;
  borderColor?: string;
};

/**
 * Avatar del usuario. Si `uri` apunta a una foto real la muestra; si no, cae a
 * los retratos ilustrados del diseño original (viewBox 0 0 48 48).
 */
export function Avatar({ variant, uri, size = 48, radius, borderWidth, borderColor }: Props) {
  const r = radius ?? size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        overflow: 'hidden',
        borderWidth,
        borderColor,
        backgroundColor: '#E3E3E3',
      }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 48 48">
          {renderVariant(variant)}
        </Svg>
      )}
    </View>
  );
}

function renderVariant(variant: AvatarVariant) {
  switch (variant) {
    case 'juan':
      return (
        <>
          <Rect width={48} height={48} fill="#E3E3E3" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#0A0A0A" />
          <Circle cx={24} cy={20} r={9.5} fill="#C69A7A" />
          <Path d="M14 19c0-7 4.5-11.5 10-11.5S34 12 34 19c-2.5-3-5.5-4.5-10-4.5S16.5 16 14 19z" fill="#1A1A1A" />
        </>
      );
    case 'luis':
      return (
        <>
          <Rect width={48} height={48} fill="#D9D9D9" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#E5322D" />
          <Circle cx={24} cy={20} r={9.5} fill="#8D5B3F" />
          <Path d="M14 19c0-7 4.5-11.5 10-11.5S34 12 34 19c-2.5-3-5.5-4.5-10-4.5S16.5 16 14 19z" fill="#0A0A0A" />
          <Path d="M16 23c1 5 4 7.5 8 7.5s7-2.5 8-7.5c-2 3-4.5 4-8 4s-6-1-8-4z" fill="#0A0A0A" opacity={0.85} />
        </>
      );
    case 'carlos':
      return (
        <>
          <Rect width={48} height={48} fill="#E3E3E3" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#3A3A3A" />
          <Circle cx={24} cy={21} r={9.5} fill="#E8B89A" />
          <Path d="M14 18c0-6 4.5-10 10-10s10 4 10 10z" fill="#0A0A0A" />
          <Rect x={12} y={17} width={26} height={3} rx={1.5} fill="#E5322D" />
        </>
      );
    case 'rosa':
      return (
        <>
          <Rect width={48} height={48} fill="#D9D9D9" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#0A0A0A" />
          <Circle cx={24} cy={9} r={4.5} fill="#1A1A1A" />
          <Circle cx={24} cy={21} r={9.5} fill="#A8724F" />
          <Path d="M13.5 22c0-8 4.5-13 10.5-13s10.5 5 10.5 13c-1.5-4-4-6.5-10.5-6.5S15 18 13.5 22z" fill="#1A1A1A" />
        </>
      );
    case 'me': // Brayan sobre fondo oscuro, hombros blancos
      return (
        <>
          <Rect width={48} height={48} fill="#2A2A2A" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#FFFFFF" />
          <Circle cx={24} cy={20} r={9.5} fill="#C69A7A" />
          <Path d="M14 19c0-7 4.5-11.5 10-11.5S34 12 34 19c-2.5-3-5.5-4.5-10-4.5S16.5 16 14 19z" fill="#0A0A0A" />
        </>
      );
    case 'meLight': // Brayan sobre fondo claro (tarjeta destacada del mapa)
      return (
        <>
          <Rect width={48} height={48} fill="#E3E3E3" />
          <Path d="M6 48c1-9 8-14 18-14s17 5 18 14z" fill="#0A0A0A" />
          <Circle cx={24} cy={20} r={9.5} fill="#C69A7A" />
          <Path d="M14 19c0-7 4.5-11.5 10-11.5S34 12 34 19c-2.5-3-5.5-4.5-10-4.5S16.5 16 14 19z" fill="#1A1A1A" />
        </>
      );
  }
}
