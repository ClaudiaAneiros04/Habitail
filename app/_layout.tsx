import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert, AppState, AppStateStatus } from 'react-native';
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
import { registerNotificationCategories, setupNotificationListeners } from '../src/notifications/notificationService';
import { handleAppForeground } from '../src/notifications/inactivityService';
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
    const initialize = async () => {
      try {
        // 0. Inicializar notificaciones
        await registerNotificationCategories();

        // 1. Inicializar Base de Datos (Tablas)
        await initDb();
        
        // 2. Carga secuencial de datos críticos para evitar colisiones de Foreign Keys
        // Primero el usuario, ya que la mascota y los hábitos referencian su ID
        await useUserStore.getState().loadUser();
        
        // Después la mascota
        await usePetStore.getState().loadPet();
        
        // Finalmente los hábitos
        await useHabitStore.getState().loadHabits();
        
        setDbReady(true);
      } catch (error: any) {
        console.error("Error durante la inicialización de la app:", error);
        Alert.alert(
          "Error de Inicialización",
          "Hubo un problema al cargar los datos: " + (error?.message || "Error desconocido")
        );
        setDbReady(true);
      }
    };

    initialize();
  }, []);

  // Configurar listeners de notificaciones interactivos
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return () => {
      cleanup();
    };
  }, []);

  // Listener para capturar el regreso al primer plano (foreground) y programar retención por inactividad
  useEffect(() => {
    if (!dbReady) return;

    // Ejecución inicial al cargar la app por primera vez en esta sesión
    handleAppForeground();

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[RootLayout] App ha regresado a primer plano. Actualizando lastOpenedAt y reiniciando temporizador de inactividad.');
        await handleAppForeground();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [dbReady]);

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
