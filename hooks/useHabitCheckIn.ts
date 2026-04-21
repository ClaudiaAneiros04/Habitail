import { useState, useCallback, useMemo, useEffect } from 'react';
import { Animated } from 'react-native';
import { useHabitStore } from '../store/useHabitStore';
import { useLogStore } from '../store/useLogStore';
import { usePetStore } from '../store/usePetStore';
import { HabitLog } from '../types';
import { startOfDay, formatISO, parseISO } from 'date-fns';
import { getHabitsForToday } from '../utils/frequencyEngine';

/**
 * Hook para gestionar el check-in (completar/desmarcar) de los hábitos.
 * Incluye persistencia a través de logStore, impacto en la mascota gamificada
 * mediante petStore, cálculos de progreso, y manejo de triggers para UI (Confetti, Animaciones).
 */
export const useHabitCheckIn = (targetDate: Date = new Date()) => {
  const { habits } = useHabitStore();
  const { logs, addLog } = useLogStore();
  const { updateHealth } = usePetStore();

  const [showConfetti, setShowConfetti] = useState(false);

  // Obtener hábitos correspondientes al día seleccionado
  const habitsForToday = useMemo(() => {
    return getHabitsForToday(habits, targetDate);
  }, [habits, targetDate]);

  // Filtrar logs de este día
  const logsForToday = useMemo(() => {
    const todayISO = startOfDay(targetDate).toISOString();
    return logs.filter(log => {
      // Comparar a nivel de inicio de día para garantizar que estén en el mismo bloque
      return startOfDay(parseISO(log.fecha)).toISOString() === todayISO;
    });
  }, [logs, targetDate]);

  // Completados el día de hoy
  const completedTodayCount = useMemo(() => {
    return habitsForToday.filter(habit => {
      const log = logsForToday.find(l => l.habitId === habit.id);
      return log && log.completado;
    }).length;
  }, [habitsForToday, logsForToday]);

  const totalTodayCount = habitsForToday.length;

  // Barra de progreso en tiempo real (0 a 1)
  const progress = totalTodayCount === 0 ? 0 : completedTodayCount / totalTodayCount;

  /**
   * Generador simple de UUID para los logs
   */
  const generateId = () => 'log-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();

  /**
   * Obtiene el estado de un hábito particular para el día actual consultado.
   * Útil para que la UI sepa si el Switch/Checkbox debe estar activado.
   */
  const getStatusForDay = useCallback((habitId: string): boolean => {
    const log = logsForToday.find(l => l.habitId === habitId);
    return log ? log.completado : false;
  }, [logsForToday]);

  /**
   * Chequea si todos los hábitos del día fueron completados, y dispara el confeti
   */
  const checkAllCompletedAndTriggerConfetti = useCallback((currentCompletedCount: number) => {
    // Si la acción sumó el último hábito necesario
    if (totalTodayCount > 0 && currentCompletedCount === totalTodayCount) {
      setShowConfetti(true);
      // Reseteamos el estado opcionalmente después para que pueda volver a dispararse otro día
      setTimeout(() => setShowConfetti(false), 5000); // 5 segundos de confetti
    }
  }, [totalTodayCount]);

  /**
   * Marca un hábito como completado
   */
  const markComplete = useCallback(async (habitId: string) => {
    const status = getStatusForDay(habitId);
    if (status) return; // Ya está completado

    const newLog: HabitLog = {
      id: generateId(),
      habitId,
      userId: 'current-user', // Podría venir de useUserStore, asumiendo placeholder
      fecha: formatISO(targetDate),
      completado: true,
      timestampRegistro: formatISO(new Date())
    };

    await addLog(newLog);

    // Gamificación: sumar 10 puntos de salud (ajustable)
    await updateHealth(10);

    // Revisar si todo lo de hoy se ha completado
    checkAllCompletedAndTriggerConfetti(completedTodayCount + 1);
  }, [addLog, getStatusForDay, targetDate, updateHealth, completedTodayCount, checkAllCompletedAndTriggerConfetti]);

  /**
   * Desmarca un hábito como completado
   */
  const markIncomplete = useCallback(async (habitId: string) => {
    const status = getStatusForDay(habitId);
    if (!status) return; // Ya está desmarcado

    const newLog: HabitLog = {
      id: generateId(),
      habitId,
      userId: 'current-user', 
      fecha: formatISO(targetDate),
      completado: false,
      timestampRegistro: formatISO(new Date())
    };

    await addLog(newLog);

    // Gamificación: restar vida (penalización suave, e.g., -5)
    await updateHealth(-5);
  }, [addLog, getStatusForDay, targetDate, updateHealth]);

  /**
   * Proporciona un trigger listo para animaciones en UI usando Animated.spring
   * El desarrollador Frontend llamará a esto pasándole su Animated.Value.
   */
  const triggerBounceAnimation = useCallback((animatedValue: Animated.Value) => {
    animatedValue.setValue(0.8); // Escala inicial al presionar
    Animated.spring(animatedValue, {
      toValue: 1,      // Rebota hasta la escala normal
      friction: 3,     // Fricción baja para un efecto bounce vistoso
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return {
    markComplete,
    markIncomplete,
    getStatusForDay,
    triggerBounceAnimation,
    progress,              // Float 0..1 para rellenar la progress bar
    showConfetti,          // Booleano para el componente React-Native-Confetti-Cannon
    habitsForToday,        // Lista de hábitos a renderizar hoy
  };
};
