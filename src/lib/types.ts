export type Role = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
export type UnitStatus =
  | 'EN_RUTA'
  | 'DETENIDO'
  | 'DISPONIBLE'
  | 'DESCONECTADO'
  | 'MANTENIMIENTO';

export type Shift = 'MANANA' | 'TARDE' | 'NOCHE';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  shift?: Shift;
  positionTitle?: string | null;
  avatarKey?: string | null;
  nickname?: string | null;
  phone?: string | null;
  operatorCode?: string | null;
}

export interface UpdateProfilePayload {
  name?: string;
  nickname?: string;
  positionTitle?: string;
  phone?: string;
  avatarKey?: string;
  shift?: Shift;
}

export interface NotificationPreferences {
  userId: string;
  criticalAlerts: boolean;
  chatMessages: boolean;
  radioBroadcasts: boolean;
  unitStatus: boolean;
  dailyDigest: boolean;
  soundVibration: boolean;
  doNotDisturb: boolean;
  dndFrom: string | null;
  dndTo: string | null;
  updatedAt: string;
}

export type NotificationPrefKey =
  | 'criticalAlerts'
  | 'chatMessages'
  | 'radioBroadcasts'
  | 'unitStatus'
  | 'dailyDigest'
  | 'soundVibration'
  | 'doNotDisturb';

export type RouteStatus = 'PLANIFICADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA';
export type StopKind = 'ORIGEN' | 'PARADA' | 'PEAJE' | 'DESTINO';
export type StopStatus = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'OMITIDA';

export interface RouteStop {
  id: string;
  routeId: string;
  order: number;
  kind: StopKind;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  plannedAt: string | null;
  arrivedAt: string | null;
  status: StopStatus;
}

export interface UnitRoute {
  id: string;
  code: string;
  status: RouteStatus;
  cargoDescription: string | null;
  cargoPallets: number | null;
  cargoWeightTons: number | null;
  guiaRemision: string | null;
  stops: RouteStop[];
}

export interface UnitDetail {
  id: string;
  code: string;
  plate: string;
  brand: string | null;
  model: string | null;
  capacityTons: number | null;
  status: UnitStatus;
  isActive: boolean;
  operatorId: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKmh: number | null;
  lastHeading: number | null;
  lastPositionAt: string | null;
  operator: {
    id: string;
    name: string;
    avatarKey: string | null;
    phone: string | null;
    isOnline: boolean;
  } | null;
  routes: UnitRoute[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LiveUnit {
  id: string;
  code: string;
  status: UnitStatus;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKmh: number | null;
  lastHeading: number | null;
  lastPositionAt: string | null;
  operator: {
    id: string;
    name: string;
    nickname?: string | null;
    avatarKey: string | null;
  } | null;
}

export interface LivePerson {
  id: string;
  name: string;
  nickname: string | null;
  avatarKey: string | null;
  role: Role;
  lastLat: number | null;
  lastLng: number | null;
  lastSpeedKmh: number | null;
  lastHeading: number | null;
  lastPositionAt: string | null;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'CRITICA' | 'ADVERTENCIA' | 'INFO';
  status: string;
  title: string;
  description?: string | null;
  locationLabel?: string | null;
  createdAt: string;
  unit?: { id: string; code: string; plate: string } | null;
  operator?: { id: string; name: string; avatarKey: string | null } | null;
}

export interface AlertMetrics {
  criticas: number;
  pendientes: number;
  hoy: number;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  unread: number;
  lastMessage: Message | null;
  members: { user: ChatUser }[];
}

export interface ChatUser {
  id: string;
  name: string;
  nickname?: string | null;
  avatarKey: string | null;
  isOnline: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'VOICE' | 'IMAGE' | 'VIDEO' | 'LOCATION' | 'SYSTEM';
  body?: string | null;
  attachmentKey?: string | null;
  durationSec?: number | null;
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string | null;
  createdAt: string;
  sender?: ChatUser;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  memberCount: number;
  joined: boolean;
}
