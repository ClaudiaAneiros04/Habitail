import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

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
        name="test"
        options={{
          title: 'Laboratorio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
