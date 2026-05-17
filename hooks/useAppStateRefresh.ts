import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useHabitStore } from '../store/useHabitStore';
import { useLogStore } from '../store/useLogStore';

/**
 * Hook para detectar cuando la app vuelve a primer plano (active)
 * y forzar una recarga del store (hábitos y logs) para reflejar
 * interacciones hechas desde notificaciones en segundo plano.
 * 
 * ¿Por qué AppState en lugar de un listener de notificaciones?
 * Porque el listener de notificaciones en background ya modifica la base de datos
 * a través de handlers. Al volver a primer plano, simplemente necesitamos que la UI
 * sincronice su estado con la base de datos actualizada, evitando acoplar componentes
 * visuales directamente con `expo-notifications`.
 */
export function useAppStateRefresh(onRefresh: () => void) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App ha vuelto a primer plano
        await useHabitStore.getState().loadHabits();
        await useLogStore.getState().loadLogs();
        onRefresh();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [onRefresh]);
}
