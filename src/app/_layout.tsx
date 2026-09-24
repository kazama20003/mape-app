import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { usePushRegistration } from '@/features/notifications/use-push-registration';
import { SettingsProvider } from '@/features/settings/settings-context';
import { queryClient } from '@/lib/query-client';
import { Mape } from '@/constants/mape-theme';

SplashScreen.preventAutoHideAsync();

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
];

function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushRegistration();

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const isProtected = root ? PROTECTED_ROOTS.includes(root) : false;
    if (status === 'unauthenticated' && isProtected) {
      router.replace('/login');
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
            </AuthProvider>
          </SettingsProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
