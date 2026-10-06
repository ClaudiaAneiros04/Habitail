import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useLogStore } from '../store/useLogStore';
import { useHabitStore } from '../store/useHabitStore';
import { useUserStore } from '../store/useUserStore';
import { LogicalDate } from '../types';
import { getHabitsExpectedOnDate } from '../utils/frequencyEngine';
import { 
  toLogicalDate, 
  getLogicalToday, 
  compareLogicalDates 
} from '../utils/dateUtils';
import { habitCompletionService } from '../services/HabitCompletionService';

/**
 * Hook de capa de presentación (UI wrapper) para gestionar el Check-In (completar/desmarcar) de hábitos.
 *
 * Delega toda la lógica de negocio, persistencia atómica, gamificación y ledger de recompensas
 * al servicio de dominio `habitCompletionService`.
 *
 * Mantiene exclusivamente responsabilidades de interfaz de usuario:
 * - Animación reactiva de rebote (Bounce effect).
 * - Detección de 'All Tasks Done' para disparo visual de confeti.
 * - Cálculo de progreso diario y estado visual para renderizado.
 */
export const useHabitCheckIn = () => {
  const { logs } = useLogStore();
  const { habits } = useHabitStore();
  const { user } = useUserStore();

  /**
   * Valor animado expuesto para que el frontend lo pueda inyectar en propiedades de estilo
   * como Transform -> scale, para darle un efecto visual reactivo (Bounce).
   */
  const bounceValue = useRef(new Animated.Value(1)).current;

  /**
   * Obtiene el estado actual (completado o no) de un hábito en una fecha determinada.
   * Filtra los logs globales almacenados en memoria para encontrar la coincidencia exacta
   * basada en el ID del hábito y el día en cuestión, ignorando la hora del día.
   *
   * @param habitId - El identificador único del hábito.
   * @param fecha - La fecha en la que se quiere verificar el estado.
   * @returns boolean - true si existe un registro y está completado, false en cualquier otro caso.
   */
  const getStatusForDay = useCallback((habitId: string, fecha: Date | LogicalDate | string): boolean => {
    const targetDateStr = toLogicalDate(fecha);
    
    const log = logs.find(l => {
      if (l.habitId !== habitId) return false;
      const logDateStr = toLogicalDate(l.fecha);
      return logDateStr === targetDateStr;
    });

    return log ? log.completado : false;
  }, [logs]);

  /**
   * Calcula el progreso de cumplimiento de los hábitos de un día de manera reactiva.
   * Utilizado para alimentar la barra de progreso en la cabecera.
   *
   * @param fecha - La fecha para la cual calcular el progreso diario.
   * @returns number - Valor numérico entre 0 (0%) y 1 (100%).
   */
  const getDailyProgress = useCallback((fecha: Date | LogicalDate | string): number => {
    const targetDate = toLogicalDate(fecha);
    const todayHabits = getHabitsExpectedOnDate(habits, targetDate);
    if (todayHabits.length === 0) return 0;

    const completedCount = todayHabits.filter(habit => getStatusForDay(habit.id, targetDate)).length;
    return completedCount / todayHabits.length;
  }, [habits, getStatusForDay]);

  /**
   * Ejecuta una animación de resorte (spring) para dar un efecto de rebote visual.
   */
  const triggerBounce = useCallback(() => {
    Animated.sequence([
      Animated.spring(bounceValue, {
        toValue: 1.15,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(bounceValue, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bounceValue]);

  /**
   * Marca un hábito como completado en una fecha dada a través del servicio de dominio.
   * Maneja el efecto de UI confetti si se completaron todas las tareas del día de hoy.
   *
   * @param habitId - El identificador único del hábito.
   * @param fecha - La fecha calendario en la que se completó el hábito.
   * @returns Promesa resolviendo a un objeto con la bandera { shouldLaunchConfetti: boolean }
   */
  const markComplete = useCallback(async (habitId: string, fecha: Date | LogicalDate | string): Promise<{ shouldLaunchConfetti: boolean }> => {
    const targetDate = toLogicalDate(fecha);
    const today = getLogicalToday();

    // 0. Validación de dominio: no se puede completar un día futuro
    if (compareLogicalDates(targetDate, today) > 0) {
      return { shouldLaunchConfetti: false };
    }

    const userId = user?.id || 'default-user';
    const result = await habitCompletionService.completeHabit({
      userId,
      habitId,
      logicalDate: targetDate,
      source: 'UI',
    });

    if (result.alreadyCompleted) {
      return { shouldLaunchConfetti: false };
    }

    // Efecto de UI: Confetti al completar todas las tareas esperadas para hoy
    let shouldLaunchConfetti = false;
    const isHistorical = compareLogicalDates(targetDate, today) < 0;
    if (!isHistorical) {
      const todayHabits = getHabitsExpectedOnDate(habits, targetDate);
      if (todayHabits.length > 0) {
        const previouslyCompleted = todayHabits.filter(h => h.id !== habitId && getStatusForDay(h.id, targetDate)).length;
        if (previouslyCompleted + 1 === todayHabits.length) {
          shouldLaunchConfetti = true;
        }
      }
    }

    return { shouldLaunchConfetti };
  }, [user, habits, getStatusForDay]);

  /**
   * Desmarca un hábito para una fecha dada a través del servicio de dominio.
   *
   * @param habitId - El identificador único del hábito que se desea desmarcar.
   * @param fecha - La fecha en la que se desmarca el hábito.
   */
  const markIncomplete = useCallback(async (habitId: string, fecha: Date | LogicalDate | string): Promise<void> => {
    const targetDate = toLogicalDate(fecha);
    const today = getLogicalToday();

    if (compareLogicalDates(targetDate, today) > 0) {
      return;
    }

    const userId = user?.id || 'default-user';
    await habitCompletionService.uncompleteHabit({
      userId,
      habitId,
      logicalDate: targetDate,
      source: 'UI',
    });
  }, [user]);

  return {
    bounceValue,
    triggerBounce,
    getDailyProgress,
    markComplete,
    markIncomplete,
    getStatusForDay
  };
};
