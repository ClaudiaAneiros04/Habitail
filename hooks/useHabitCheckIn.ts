import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { useLogStore } from '../store/useLogStore';
import { usePetStore } from '../store/usePetStore';
import { useHabitStore } from '../store/useHabitStore';
import { useStatsStore } from '../store/useStatsStore';
import { useHeatmapStore } from '../store/useHeatmapStore';
import { HabitLog, LogicalDate } from '../types';
import { getHabitsExpectedOnDate } from '../utils/frequencyEngine';
import { useUserStore } from '../store/useUserStore';
import { calcPointsDelta } from '../utils/pointsEngine';
import { evaluateBadges } from '../utils/badgeEngine';
import { 
  generateLogId, 
  toLogicalDate, 
  getCurrentInstant, 
  getLogicalToday, 
  compareLogicalDates 
} from '../utils/dateUtils';
import { getHealthDeltaForPriority } from '../utils/petLogic';

/**
 * Hook principal y modular para gestionar el Check-In (completar/desmarcar) de los hábitos.
 * 
 * Se encarga de la lógica de negocio e integridad de datos subyacente sin mezclarse
 * con componentes de interfaz de usuario. Centraliza las operaciones de:
 * - Persistencia del estado histórico a través de logStore.
 * - Conexión automática con el sistema de gamificación (petStore).
 * - Verificación determinista del estado para un día en particular.
 * - Lógica de avance y recompensas (Bounce effect y Confetti).
 * 
 * Cumple con las restricciones de dominio:
 * - Días futuros nunca pueden completarse.
 * - Check-ins en fechas históricas no modifican arbitrariamente la salud/vida de la mascota actual.
 */
export const useHabitCheckIn = () => {
  const { logs, addLog, deleteLog } = useLogStore();
  const { updateHealth } = usePetStore();
  const { habits } = useHabitStore();
  const { user, updatePoints, addBadges } = useUserStore();

  /**
   * Valor animado expuesto para que el frontend lo pueda inyectar en propiedades de estilo
   * como Transform -> scale, para darle un efecto visual reactivo (Bounce).
   */
  const bounceValue = useRef(new Animated.Value(1)).current;

  /**
   * Genera un ID determinista para el registro (log) de un día específico.
   * Redirige a la utilidad centralizada para mantener consistencia.
   */
  const getLogId = (habitId: string, targetDate: Date | LogicalDate | string): string => {
    return generateLogId(habitId, targetDate);
  };

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
    
    // Busca en el estado global el log que concuerde en fecha y ID de hábito
    const log = logs.find(l => {
      if (l.habitId !== habitId) return false;
      const logDateStr = toLogicalDate(l.fecha);
      return logDateStr === targetDateStr;
    });

    return log ? log.completado : false;
  }, [logs]);

  /**
   * Calcula el progreso de cumplimiento de los hábitos de un día de manera reactiva.
   * Utilizado para poder alimentar una barra de progreso que se llene al ir completando tareas.
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
   * Ejecuta una animación de resorte (spring) para dar un efecto de rebote.
   * Esta función puede ser llamada desde el frontend al pulsar sobre el check de un hábito.
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
   * Marca un hábito como completado en una fecha dada.
   * Revisa primero si no estaba ya completado para evitar actualizaciones superfluas.
   * De no estarlo, crea o actualiza un registro de log como completado, lo persiste 
   * en el estado global persistente (logStore) e impacta la gamificación sumando salud.
   * Revisa si se completaron todos los hábitos del día, devolviendo el estado 'shouldLaunchConfetti'.
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

    // 1. Verificamos el estado actual para evitar procesos redundantes
    const status = getStatusForDay(habitId, targetDate);
    if (status) return { shouldLaunchConfetti: false }; // Ya está completado en esa fecha, abortar

    const habit = habits.find(h => h.id === habitId);

    // 2. Crear la entidad de registro (log)
    const newLog: HabitLog = {
      id: generateLogId(habitId, targetDate),
      habitId,
      userId: user?.id || 'default-user',
      fecha: targetDate,
      completado: true,
      timestampRegistro: getCurrentInstant()
    };

    // 3. Persistimos el registro de éxito
    await addLog(newLog);

    // 4. Actualizamos la gamificación según la prioridad
    // REGLA: Los check-ins históricos no deben modificar arbitrariamente la salud actual
    const isHistorical = compareLogicalDates(targetDate, today) < 0;
    if (!isHistorical) {
      const healthDelta = getHealthDeltaForPriority(habit?.nivelPrioridad, 0);
      await updateHealth(healthDelta);
    }

    // 5. Asignación de puntos y evaluación de insignias
    if (habit) {
      const points = calcPointsDelta(habit);
      await updatePoints(points);

      if (user) {
        // Necesitamos asegurar que los logs pasados a evaluateBadges incluyen el que acabamos de agregar
        try {
          const allLogs = [...logs, newLog];
          const newEarnedBadges = evaluateBadges(user as any, habits, allLogs);
          if (newEarnedBadges.length > 0) {
            await addBadges(newEarnedBadges);
          }
        } catch (badgeError) {
          console.error('[useHabitCheckIn] Error evaluating badges:', badgeError);
        }
      }
    }

    // 6. Verificamos el requerimiento 'All Tasks Done' (solo en el día de hoy)
    let shouldLaunchConfetti = false;
    if (!isHistorical) {
      const todayHabits = getHabitsExpectedOnDate(habits, targetDate);
      if (todayHabits.length > 0) {
        const previouslyCompleted = todayHabits.filter(h => h.id !== habitId && getStatusForDay(h.id, targetDate)).length;
        if (previouslyCompleted + 1 === todayHabits.length) {
          shouldLaunchConfetti = true;
        }
      }
    }

    // Invalida el caché de estadísticas para que la pantalla Stats refleje los cambios
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();

    return { shouldLaunchConfetti };
  }, [addLog, getStatusForDay, updateHealth, habits, updatePoints, user, logs, addBadges]);

  /**
   * Desmarca un hábito (lo marca como incompleto) para una fecha dada.
   * Verifica primero su estado; si no estaba completado, no realiza operaciones.
   * Si estaba completado, crea o sobrescribe el log reflejando el cambio a incompleto
   * y aplica una penalización en el sistema de gamificación (solo si no es histórico).
   * 
   * @param habitId - El identificador único del hábito que se desea desmarcar.
   * @param fecha - La fecha en la que se desmarca el hábito.
   */
  const markIncomplete = useCallback(async (habitId: string, fecha: Date | LogicalDate | string): Promise<void> => {
    const targetDate = toLogicalDate(fecha);
    const today = getLogicalToday();

    // 1. Verificamos el estado actual para evitar procesos redundantes
    const status = getStatusForDay(habitId, targetDate);
    if (!status) return; // Ya está desmarcado o nunca se completó, abortar

    const habit = habits.find(h => h.id === habitId);

    // 2. Crear/Actualizar la entidad de registro indicando que NO está completado
    const newLog: HabitLog = {
      id: generateLogId(habitId, targetDate),
      habitId,
      userId: user?.id || 'default-user',
      fecha: targetDate,
      completado: false, // Refleja explícitamente el cambio de estado
      timestampRegistro: getCurrentInstant()
    };

    // 3. Persistimos el cambio de estado en el histórico
    if (deleteLog) {
      await deleteLog(generateLogId(habitId, targetDate));
    } else {
      await addLog(newLog);
    }

    // 4. Actualizamos la gamificación a modo de penalización si NO es histórico
    const isHistorical = compareLogicalDates(targetDate, today) < 0;
    if (!isHistorical) {
      const healthDelta = -getHealthDeltaForPriority(habit?.nivelPrioridad, 0);
      await updateHealth(healthDelta);
    }

    // 5. Descontar puntos por deshacer el check-in
    if (habit) {
      const points = calcPointsDelta(habit);
      await updatePoints(-points);
    }

    // Invalida el caché para reflejar la eliminación del log en las estadísticas
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();

  }, [addLog, deleteLog, getStatusForDay, updateHealth, habits, updatePoints]);

  // Exponemos la Interfaz limpia para el Desarrollador de Frontend
  return {
    bounceValue,
    triggerBounce,
    getDailyProgress,
    markComplete,
    markIncomplete,
    getStatusForDay
  };
};
