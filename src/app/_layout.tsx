import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { radioSession } from '@/features/radio/radio-session';
import { storage, StorageKeys } from '@/lib/storage';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { usePushRegistration } from '@/features/notifications/use-push-registration';
import { useStartupPermissions } from '@/features/radio/use-startup-permissions';
import { useBackgroundPermission } from '@/features/radio/use-background-permission';
import { useChatRealtime } from '@/features/data/hooks';
import { SettingsProvider } from '@/features/settings/settings-context';
import { OfflineBanner } from '@/components/mape/offline-banner';
import { queryClient } from '@/lib/query-client';
import { Mape } from '@/constants/mape-theme';

SplashScreen.preventAutoHideAsync();

// Conecta React Query con el estado real de red: pausa las consultas cuando no
// hay internet y las reintenta al reconectar (en vez de girar indefinidamente).
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return () => sub.remove();
});

// Rutas que requieren sesión iniciada.
const PROTECTED_ROOTS = [
  '(tabs)',
  'detalle',
  'chat',
  'nuevo-chat',
  'cuenta',
  'ajustes',
  'notificaciones',
  'admin-usuarios',
  'admin-canales',
  'radio-chat',
];

function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  // Recordar la última pestaña visitada para restaurarla si el SO mata la app
  // (MIUI/Xiaomi es agresivo) y arranca en frío.
  const lastRouteRef = useRef<string | null>(null);
  const [routeLoaded, setRouteLoaded] = useState(false);
  useEffect(() => {
    storage
      .get(StorageKeys.lastRoute)
      .then((r) => {
        lastRouteRef.current = r;
      })
      .catch(() => {})
      .finally(() => setRouteLoaded(true));
  }, []);
  useEffect(() => {
    // Solo pestañas (evita restaurar rutas con parámetros).
    if (status === 'authenticated' && segments[0] === '(tabs)' && pathname) {
      void storage.set(StorageKeys.lastRoute, pathname);
    }
  }, [pathname, segments, status]);

  usePushRegistration();
  useStartupPermissions(status === 'authenticated');
  useBackgroundPermission(status === 'authenticated');
  useChatRealtime();

  // Acción "Desconectar" de la notificación de radio: corta la sesión (cierra
  // los sockets), quita la notificación y sale al mapa (desmonta la radio).
  useEffect(() => {
    if (Constants.appOwnership === 'expo' || Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          const data = resp.notification.request.content.data as
            | { kind?: string }
            | undefined;
          if (data?.kind !== 'radio') return;
          if (resp.actionIdentifier === 'DESCONECTAR') {
            // Marca la sesión como desconectada: la pantalla de radio libera el
            // audio y quita la notificación. Se reconecta al volver a la pestaña.
            radioSession.leave();
            Notifications.dismissNotificationAsync('radio-live-status').catch(
              () => {},
            );
            router.replace('/mapa');
          }
        });
      } catch {
        /* noop */
      }
    })();
    return () => sub?.remove();
  }, [router]);

  useEffect(() => {
    if (status === 'loading' || !routeLoaded) return;
    const root = segments[0];
    const isProtected = root ? PROTECTED_ROOTS.includes(root) : false;
    // Pantallas de entrada (splash / onboarding / login): si ya hay sesión
    // guardada, restauramos la última pestaña (o el mapa por defecto).
    const isEntry = !root || root === 'index' || root === 'inicio' || root === 'login';
    if (status === 'unauthenticated' && isProtected) {
      router.replace('/login');
    } else if (status === 'authenticated' && isEntry) {
      const saved = lastRouteRef.current;
      router.replace(
        saved && saved.startsWith('/') && saved !== '/login' ? saved : '/mapa',
      );
    }
  }, [status, segments, router, routeLoaded]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Mape.bg },
        animationDuration: 300,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="inicio" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="login"
        options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}
      />
      <Stack.Screen name="recuperar" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="verificar" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="restablecer" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="detalle" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="cuenta" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="nuevo-chat" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ajustes" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="notificaciones" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin-usuarios" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin-canales" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="radio-chat" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SettingsProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <AuthGate />
              <OfflineBanner />
            </AuthProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
