import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDb } from '../storage/database';
import { useUserStore } from '../store/useUserStore';
import { usePetStore } from '../store/usePetStore';
import { useHabitStore } from '../store/useHabitStore';
import { useDailyPenaltyJob } from '../hooks/useDailyPenaltyJob';
import { useOnboarding } from '../hooks/useOnboarding';
import { registerNotificationCategories, setupNotificationListeners, rescheduleAll } from '../notifications/notificationService';
import { handleAppForeground } from '../notifications/inactivityService';
import '../i18n';

export default function RootLayout() {
  useDailyPenaltyJob();

  /**
   * Bloquea el renderizado de las pantallas hasta que la base de datos esté
   * completamente inicializada (tablas creadas). Esto elimina la condición de
   * carrera en la que `getLogsForDay` llega a SQLite antes de que exista
   * la tabla `habit_logs`.
   */
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Configurar categorías y listeners de notificaciones interactivas
    let cleanupListeners: (() => void) | undefined;
    
    const setupNotifications = async () => {
      try {
        await registerNotificationCategories();
        cleanupListeners = setupNotificationListeners();
      } catch (error) {
        console.error('Error al configurar notificaciones en _layout.tsx:', error);
      }
    };
    setupNotifications();

    return () => {
      if (cleanupListeners) {
        cleanupListeners();
      }
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Inicializar Base de Datos (Tablas)
        await initDb();

        // 2. Carga secuencial de datos críticos para evitar colisiones de Foreign Keys
        // Primero el usuario, ya que la mascota y los hábitos referencian su ID
        await useUserStore.getState().loadUser();

        // Después la mascota
        await usePetStore.getState().loadPet();

        // Finalmente los hábitos
        await useHabitStore.getState().loadHabits();

        // 3. Reprogramar recordatorios activos y manejar mascot inactivity
        const habits = useHabitStore.getState().habits;
        await rescheduleAll(habits);
        await handleAppForeground();

        setDbReady(true);
      } catch (error: any) {
        console.error('Error durante la inicialización de la app:', error);
        Alert.alert(
          'Error de Inicialización',
          'Hubo un problema al cargar los datos: ' + (error?.message || 'Error desconocido')
        );
        setDbReady(true);
      }
    };

    initialize();
  }, []);

  const { onboardingCompleted } = useOnboarding();

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ backgroundColor: Colors.background }}>
        <StatusBar style="dark" />
        {/*
          Todos los Stack.Screen se declaran SIEMPRE para que expo-router los tenga
          registrados. La guarda de navegación vive en cada _layout hijo:
          - /onboarding/_layout.tsx → <Redirect href="/(tabs)"> si onboardingCompleted
          - initialRouteName        → dirige al usuario a la ruta correcta al inicio
        */}
        <Stack
          screenOptions={{ headerShown: false }}
          initialRouteName={onboardingCompleted ? '(tabs)' : 'onboarding'}
        >
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="permissions" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
