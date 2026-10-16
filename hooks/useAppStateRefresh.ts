import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useHabitStore } from '../store/useHabitStore';
import { useLogStore } from '../store/useLogStore';
import { useUserStore } from '../store/useUserStore';
import { usePetStore } from '../store/usePetStore';
import { handleAppForeground } from '../notifications/inactivityService';
import { rescheduleAllHabitNotifications } from '../notifications/notificationService';
import { runDailyPenaltyJob } from './useDailyPenaltyJob';

/**
 * Rutina asíncrona centralizada de sincronización de stores, jobs de inactividad,
 * penalizaciones por hábitos no completados y notificaciones.
 * 
 * Orden de ejecución crítico:
 * 1. Cargar stores iniciales si aún no se encuentran en memoria.
 * 2. Ejecutar handleAppForeground() para evaluar inactividad de 72h.
 * 3. Ejecutar runDailyPenaltyJob() para deducir HP de días cerrados pendientes.
 * 4. Recargar stores (usePetStore, useUserStore, useLogStore) para asegurar que la
 *    interfaz de usuario reciba los valores reales y persistidos más frescos.
 * 5. Reprogramar notificaciones de hábitos.
 */
export async function syncStoresAndJobs(): Promise<void> {
  try {
    // 1. Cargar datos necesarios para los jobs
    await useHabitStore.getState().loadHabits();
    await useUserStore.getState().loadUser();
    await usePetStore.getState().loadPet();

    // 2. Manejo de inactividad de la app (umbral 48h / 72h)
    await handleAppForeground();

    // 3. Ejecutar job de penalización de hábitos diarios
    await runDailyPenaltyJob();

    // 4. Sincronizar logs y recargar stores tras el cálculo de penalizaciones
    await useLogStore.getState().loadLogs();
    await usePetStore.getState().loadPet();
    await useUserStore.getState().loadUser();

    // 5. Reprogramar recordatorios
    const currentHabits = useHabitStore.getState().habits;
    if (currentHabits && currentHabits.length > 0) {
      await rescheduleAllHabitNotifications(currentHabits);
    }
  } catch (error) {
    console.error('[useAppStateRefresh] Error en syncStoresAndJobs:', error);
  }
}

/**
 * Hook para sincronizar la aplicación tanto en Cold Start (arranque inicial en 'active')
 * como en transiciones de segundo plano a primer plano ('inactive'/'background' -> 'active').
 * 
 * @param onRefresh Callback opcional a ejecutar tras completar la sincronización.
 */
export function useAppStateRefresh(onRefresh?: () => void) {
  const appState = useRef(AppState.currentState);
  const isSyncing = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const handleSync = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      await syncStoresAndJobs();
      if (onRefreshRef.current) {
        onRefreshRef.current();
      }
    } finally {
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    // 1. Soporte para arranque en frío (Cold Start):
    // Si la app monta directamente en estado 'active', ejecutamos la sincronización inicial
    if (AppState.currentState === 'active') {
      handleSync();
    }

    // 2. Suscripción a cambios de estado de la aplicación
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        await handleSync();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [handleSync]);
}

