/**
 * Sistema de diseño de la app móvil "Mape".
 * Replica exacta del diseño original (fondo claro, acento negro/rojo, fuente Outfit).
 */

export const Mape = {
  bg: '#F4F4F4',
  ink: '#0A0A0A', // negro principal (botones, textos, nav)
  white: '#FFFFFF',
  red: '#E5322D', // acento rojo
  redDark: '#B8241F', // etiquetas/labels de alerta
  redSoftBg: '#FDE3E2', // fondo suave de chip de alerta
  card: '#FFFFFF',
  panelDark: '#1A1A1A', // superficies dentro de cabeceras oscuras
  panelBorder: '#3A3A3A',
  text: '#0A0A0A',
  textMuted: '#6A6A6A',
  textFaint: '#7A7A7A',
  textSubtle: '#5A5A5A',
  textOnDark: '#C9C9C9', // texto secundario sobre negro
  textOnDarkSoft: '#B5B5B5',
  border: '#DADADA',
  borderLight: '#E4E4E4',
  chipIdle: '#FFFFFF',
  timestamp: '#9A9A9A',
} as const;

/** Familias de la fuente Outfit (el peso va incluido en la familia). */
export const Font = {
  light: 'Outfit_300Light',
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

/** Ancho del lienzo del diseño original (iPhone 12/13/14). */
export const Screen = {
  width: 390,
  height: 844,
} as const;
