import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Las notificaciones LOCALES (a diferencia de las push remotas) sí funcionan en
// Expo Go y en emuladores. Las usamos para mostrar el mensaje entrante cuando la
// app está en primer plano o el push remoto no llega (emulador / sin teléfono).

let handlerReady = false;

/** ID de la conversación abierta ahora mismo, para no auto-notificar. */
let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null) {
  activeConversationId = id;
}

/**
 * Muestra una notificación local inmediata. Carga expo-notifications de forma
 * perezosa y tolerante a fallos para no romper la app en web.
 */
export async function presentLocalNotification(input: {
  title: string;
  body: string;
  conversationId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  // No molestar con lo que el usuario ya está viendo.
  if (input.conversationId && input.conversationId === activeConversationId) {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (!handlerReady) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chatMessages', {
          name: 'Mensajes de chat',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }
      handlerReady = true;
    }

    // En Expo Go pedimos permiso aquí (en push remoto se omite el registro).
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') return;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: 'default',
        data: {
          kind: 'chat',
          conversationId: input.conversationId,
          ...input.data,
        },
      },
      trigger: null, // inmediata
    });
  } catch {
    // sin módulo nativo / sin permiso: se omite
  }
}
