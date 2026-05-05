import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

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
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Mis Hábitos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Estadísticas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mascota',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paw-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Tienda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
