import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';

/**
 * Componente principal de enrutamiento basado en pestañas (Bottom Navigation).
 * 
 * Gestiona el marco de navegación inferior de toda la aplicación utilizando la API 
 * de Expo Router. Aplica los tokens de color (`Colors`) a todas las áreas comunes
 * (barra inferior, cabecera, indicadores activos/inactivos) para garantizar 
 * consistencia y accesibilidad.
 * 
 * Se ha estructurado en 5 pestañas organizadas por contexto de uso:
 * 1. Hoy: Acción prioritaria (Check-in).
 * 2. Hábitos: Biblioteca y gestión CRUD.
 * 3. Historial: Inspección de registros pasados (Read-only).
 * 4. Estadísticas: Métricas gamificadas y KPIs del usuario.
 * 5. Mascota: Gestión del avatar gamificado (Life & Health).
 * 
 * @returns {JSX.Element} El contenedor principal con el diseño de navegación Tab.
 */
export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.inactive,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.inactive,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.hoy'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: t('tabs.habitos'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.historial'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.mascota'),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="paw-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('tabs.tienda'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
