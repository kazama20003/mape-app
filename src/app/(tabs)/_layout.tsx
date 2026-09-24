import { Tabs } from 'expo-router';

import { BottomNav, type NavKey } from '@/components/mape/bottom-nav';

/**
 * Navegador de pestañas: las 5 pantallas se mantienen montadas, así que cambiar
 * de pestaña es instantáneo y no vuelve a "cargar" ni re-anima el contenido ya
 * visto. La barra inferior es nuestra píldora personalizada.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, animation: 'fade' }}
      tabBar={({ state, navigation }) => {
        const active = state.routes[state.index].name as NavKey;
        return <BottomNav active={active} onNavigate={(key) => navigation.navigate(key)} />;
      }}>
      <Tabs.Screen name="mapa" />
      <Tabs.Screen name="radio" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="alertas" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}
