import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { usePushRegistration } from '@/features/notifications/use-push-registration';
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

  usePushRegistration();
  useChatRealtime();

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const isProtected = root ? PROTECTED_ROOTS.includes(root) : false;
    // Pantallas de entrada (splash / onboarding / login): si ya hay sesión
    // guardada, saltamos directo al mapa para no pedir login de nuevo.
    const isEntry = !root || root === 'index' || root === 'inicio' || root === 'login';
    if (status === 'unauthenticated' && isProtected) {
      router.replace('/login');
    } else if (status === 'authenticated' && isEntry) {
      router.replace('/mapa');
    }
  }, [status, segments, router]);

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
