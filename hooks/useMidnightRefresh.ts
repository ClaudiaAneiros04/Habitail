import { useEffect, useRef } from 'react';
import { useHabitStore } from '../store/useHabitStore';
import { useLogStore } from '../store/useLogStore';
import { useUserStore } from '../store/useUserStore';
import { usePetStore } from '../store/usePetStore';
import { AppState } from 'react-native';

/**
 * Hook que detecta cambios de día (medianoche o cambios manuales de zona horaria)
 * mientras la app está activa en primer plano.
 * Comprueba periódicamente si el día ha cambiado y fuerza una recarga de los stores.
 */
export function useMidnightRefresh(onRefresh: () => void) {
  const currentDayRef = useRef(new Date().toDateString());

  useEffect(() => {
    // Comprobar cada minuto (60000 ms) si el día local ha cambiado
    const interval = setInterval(async () => {
      // Solo hacer el chequeo pesado si la app está en primer plano
      // Si está en background, useAppStateRefresh se encargará al volver
      if (AppState.currentState !== 'active') return;

      const newDay = new Date().toDateString();
      if (newDay !== currentDayRef.current) {
        console.log('[useMidnightRefresh] Cambio de día detectado (medianoche o zona horaria). Refrescando...');
        currentDayRef.current = newDay;
        
        await useHabitStore.getState().loadHabits();
        await useLogStore.getState().loadLogs();
        await useUserStore.getState().loadUser();
        await usePetStore.getState().loadPet();
        onRefresh();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [onRefresh]);
}
