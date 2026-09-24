import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg';

export type IconName =
  | 'pin'
  | 'chevronRight'
  | 'chevronLeft'
  | 'arrowRight'
  | 'user'
  | 'lock'
  | 'eye'
  | 'qr'
  | 'fingerprint'
  | 'menu'
  | 'search'
  | 'layers'
  | 'locate'
  | 'radio'
  | 'mic'
  | 'chat'
  | 'bell'
  | 'plus'
  | 'sliders'
  | 'speaker'
  | 'userPlus'
  | 'clock'
  | 'play'
  | 'image'
  | 'truck'
  | 'doubleCheck'
  | 'send';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
} & SvgProps;

/** Íconos de trazo (viewBox 0 0 24 24) replicados del diseño original. */
export function Icon({ name, size = 24, color = '#0A0A0A', strokeWidth = 2, ...rest }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  const filled = { fill: color };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      {renderPaths(name, stroke, filled)}
    </Svg>
  );
}

function renderPaths(
  name: IconName,
  s: { stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round'; fill: 'none' },
  f: { fill: string },
) {
  switch (name) {
    case 'pin':
      return (
        <>
          <Path {...s} d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
          <Circle {...s} cx={12} cy={10} r={2.5} />
        </>
      );
    case 'chevronRight':
      return <Path {...s} d="M9 6l6 6-6 6" />;
    case 'chevronLeft':
      return <Path {...s} d="M15 6l-6 6 6 6" />;
    case 'arrowRight':
      return <Path {...s} d="M5 12h14M13 6l6 6-6 6" />;
    case 'user':
      return (
        <>
          <Circle {...s} cx={12} cy={8} r={4} />
          <Path {...s} d="M4 21c1-5 4.5-7 8-7s7 2 8 7" />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect {...s} x={5} y={11} width={14} height={10} rx={3} />
          <Path {...s} d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      );
    case 'eye':
      return (
        <>
          <Path {...s} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <Circle {...s} cx={12} cy={12} r={3} />
        </>
      );
    case 'qr':
      return (
        <>
          <Rect {...s} x={3} y={3} width={7} height={7} rx={1.5} />
          <Rect {...s} x={14} y={3} width={7} height={7} rx={1.5} />
          <Rect {...s} x={3} y={14} width={7} height={7} rx={1.5} />
          <Path {...s} d="M14 14h3v3M21 14v7h-7" />
        </>
      );
    case 'fingerprint':
      return (
        <>
          <Path {...s} d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          <Circle {...s} cx={12} cy={12} r={2.5} />
        </>
      );
    case 'menu':
      return <Path {...s} d="M4 8h16M4 16h10" />;
    case 'search':
      return (
        <>
          <Circle {...s} cx={11} cy={11} r={6.5} />
          <Path {...s} d="M20 20l-4-4" />
        </>
      );
    case 'layers':
      return (
        <>
          <Path {...s} d="M12 3l9 5-9 5-9-5 9-5z" />
          <Path {...s} d="M3 13l9 5 9-5" />
        </>
      );
    case 'locate':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={3} />
          <Circle {...s} cx={12} cy={12} r={8} />
          <Path {...s} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </>
      );
    case 'radio':
      return (
        <>
          <Rect {...s} x={3} y={8} width={18} height={13} rx={3} />
          <Path {...s} d="M7 8l9-5" />
          <Circle {...s} cx={16} cy={14.5} r={2.5} />
          <Path {...s} d="M7 13h4M7 16.5h4" />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect {...s} x={9} y={3} width={6} height={11} rx={3} />
          <Path {...s} d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </>
      );
    case 'chat':
      return <Path {...s} d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />;
    case 'bell':
      return (
        <>
          <Path {...s} d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
          <Path {...s} d="M10 21h4" />
        </>
      );
    case 'plus':
      return <Path {...s} d="M12 5v14M5 12h14" />;
    case 'sliders':
      return (
        <>
          <Path {...s} d="M5 4v16M12 4v16M19 4v16" />
          <Circle {...s} cx={5} cy={10} r={2.2} />
          <Circle {...s} cx={12} cy={15} r={2.2} />
          <Circle {...s} cx={19} cy={8} r={2.2} />
        </>
      );
    case 'speaker':
      return (
        <>
          <Path {...s} d="M4 10v4h4l5 4V6L8 10H4z" />
          <Path {...s} d="M16 9a4 4 0 0 1 0 6" />
        </>
      );
    case 'userPlus':
      return (
        <>
          <Circle {...s} cx={9} cy={8} r={3.5} />
          <Path {...s} d="M2.5 20c.8-4 3.4-6 6.5-6s5.7 2 6.5 6" />
          <Path {...s} d="M17 8h5M19.5 5.5v5" />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle {...s} cx={12} cy={12} r={8} />
          <Path {...s} d="M12 8v4l3 2" />
        </>
      );
    case 'play':
      return <Path {...f} d="M8 5v14l11-7z" />;
    case 'image':
      return (
        <>
          <Rect {...s} x={3} y={5} width={18} height={14} rx={2} />
          <Circle {...s} cx={9} cy={10} r={2} />
          <Path {...s} d="M21 16l-5-5-8 8" />
        </>
      );
    case 'truck':
      return (
        <>
          <Path {...s} d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
          <Circle {...s} cx={7} cy={18} r={2} />
          <Circle {...s} cx={17} cy={18} r={2} />
        </>
      );
    case 'doubleCheck':
      return <Path {...s} d="M3 12l4 4L15 8M9 16l2 2 8-8" />;
    case 'send':
      return <Path {...s} d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />;
  }
}
