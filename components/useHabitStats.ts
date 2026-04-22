import { useState, useEffect, useCallback } from 'react';
import { HabitLog, Habit } from '../types';
import { LogRepository } from '../storage/LogRepository';
import { calculateCurrentStreak, calculateMaxStreak, calculateCompletionRate } from '../utils/streakCalculator';

// Instanciamos el repositorio a nivel módulo para no recrearlo en cada render.
// Decisión de diseño: Al no poder tocar ni expandir useLogStore, inyectamos la carga de bbdd 
// a través de este Hook (capa UI/Presentacional abstracta) para alimentar los componentes.
const logRepo = new LogRepository();

/**
 * Hook personalizado para consumo de la UI que obtiene todo el historial
 * de un hábito y expone las métricas gamificadas usando la lógica central de rachas.
 * 
 * @param {Habit} habit - El hábito sobre el que queremos calcular las rachas.
 * @returns Objeto con métricas (racha actual, mejor racha, % éxito) y método refetch.
 */
export function useHabitStats(habit: Habit) {
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Obtiene todos los logs del Storage de dispositivo para el Hábito,
   * y corre las funciones importadas de lógica estricta para resolver métricas de gamificación.
   */
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedLogs = await logRepo.getByHabit(habit.id);
      setLogs(fetchedLogs);
      
      // Llamadas a la lógica importada sin tocar su código.
      const current = calculateCurrentStreak(fetchedLogs, habit);
      const max = calculateMaxStreak(fetchedLogs);
      // Extraemos la tasa de completado de los últimos 30 días para un KPI de éxito a medio plazo.
      const rate = calculateCompletionRate(fetchedLogs, 30);

      setCurrentStreak(current);
      setMaxStreak(max);
      setCompletionRate(rate);
    } catch (error) {
      console.error('Error fetching habit stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [habit]);

  // Se recarga cada vez que el ID cambie (previniendo stale-data en navegación persistente).
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    logs,
    currentStreak,
    maxStreak,
    completionRate,
    isLoading,
    refetch: fetchStats
  };
}
