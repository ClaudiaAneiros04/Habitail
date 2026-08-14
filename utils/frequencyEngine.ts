import { Habit, Frequency } from '../types';
import { startOfDay, parseISO, isBefore, isAfter } from 'date-fns';
import { parseLogicalDateUTC } from './dateUtils';

/**
 * Normaliza una fecha (Date o string ISO / YYYY-MM-DD) al inicio del día local (00:00:00).
 */
export const normalizeToStartOfDay = (date: Date | string): Date => {
  return parseLogicalDateUTC(date);
};

/**
 * Obtiene la configuración de programación activa para una fecha dada utilizando el historial,
 * o la configuración actual si no hay historial disponible.
 */
export const getActiveScheduleForDate = (habit: Habit, date: Date | string): { frecuencia: string; diasSemana: number[] } => {
  if (!habit.scheduleHistory || habit.scheduleHistory.length === 0) {
    return { frecuencia: habit.frecuencia, diasSemana: habit.diasSemana };
  }

  const targetDate = normalizeToStartOfDay(date);

  for (let i = habit.scheduleHistory.length - 1; i >= 0; i--) {
    const history = habit.scheduleHistory[i];
    const validFrom = normalizeToStartOfDay(history.validFrom);
    const validUntil = history.validUntil ? normalizeToStartOfDay(history.validUntil) : null;

    // is targetDate >= validFrom AND (targetDate < validUntil OR validUntil is null)
    if ((targetDate.getTime() >= validFrom.getTime()) && 
        (!validUntil || targetDate.getTime() < validUntil.getTime())) {
      return { frecuencia: history.frecuencia, diasSemana: history.diasSemana };
    }
  }

  // Fallback
  return { frecuencia: habit.frecuencia, diasSemana: habit.diasSemana };
};

/**
 * Determina si un hábito está programado para una fecha concreta.
 *
 * Reglas aplicadas:
 * 1. Si targetDate es anterior a habit.fechaInicio -> false (el hábito no había sido creado).
 * 2. Si habit.fechaFin existe y targetDate es posterior a habit.fechaFin -> false (hábito desactivado/finalizado).
 * 3. Según frecuencia activa en esa fecha (history o actual):
 *    - DAILY: siempre true.
 *    - WEEKLY: true si el día de la semana coincide con diasSemana (normalizando 7 a 0 para Domingo).
 *    - MONTHLY: true si el día del mes coincide con el día de creación del hábito.
 *      En meses con menos días que el día de creación (ej. día 31 en mes de 28/30 días),
 *      se programa para el último día del mes.
 *
 * @param habit Hábito a evaluar.
 * @param date Fecha objetivo (Date o string).
 * @returns boolean indicando si el hábito debe realizarse en esa fecha.
 */
export const isHabitScheduledForDate = (habit: Habit, date: Date | string): boolean => {
  const targetDate = normalizeToStartOfDay(date);
  const habitStart = normalizeToStartOfDay(habit.fechaInicio);

  if (targetDate.getTime() < habitStart.getTime()) {
    return false;
  }

  if (habit.fechaFin) {
    const habitEnd = normalizeToStartOfDay(habit.fechaFin);
    if (targetDate.getTime() > habitEnd.getTime()) {
      return false;
    }
  }

  const activeSchedule = getActiveScheduleForDate(habit, targetDate);
  const freq = activeSchedule.frecuencia as Frequency;

  switch (freq) {
    case Frequency.DAILY:
    case 'DAILY':
      return true;

    case Frequency.WEEKLY:
    case 'WEEKLY': {
      if (!Array.isArray(activeSchedule.diasSemana) || activeSchedule.diasSemana.length === 0) {
        return false;
      }
      // Convención JS: 0=Domingo, 1=Lunes, ..., 6=Sábado.
      // Normalizamos 7 a 0 por si se ingresó con la convención ISO (1-7).
      const normalizedDays = activeSchedule.diasSemana.map((d) => (d === 7 ? 0 : d));
      return normalizedDays.includes(targetDate.getUTCDay());
    }

    case Frequency.MONTHLY:
    case 'MONTHLY': {
      const creationDay = habitStart.getUTCDate();
      // Obtenemos el número de días del mes de targetDate (año, mes+1, día 0) en UTC
      const maxDaysInMonth = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth() + 1,
        0
      )).getUTCDate();
      const targetDay = Math.min(creationDay, maxDaysInMonth);
      return targetDate.getUTCDate() === targetDay;
    }

    default:
      return false;
  }
};

/**
 * Calcula cuántas veces debería haberse realizado un hábito entre fromDate y toDate (ambas inclusive).
 *
 * Respeta:
 * - Frecuencia DAILY, WEEKLY y MONTHLY.
 * - Días de la semana seleccionados (para WEEKLY).
 * - Fecha de creación / inicio del hábito (fechaInicio).
 * - Fecha de desactivación / fin del hábito si existe (fechaFin).
 * - Rango solicitado [fromDate, toDate].
 *
 * @param habit Hábito a evaluar.
 * @param fromDate Fecha inicial del rango (Date o string).
 * @param toDate Fecha final del rango (Date o string).
 * @returns Número esperado de completados.
 */
export const getExpectedCompletions = (
  habit: Habit,
  fromDate: Date | string,
  toDate: Date | string
): number => {
  const rangeStart = normalizeToStartOfDay(fromDate);
  const rangeEnd = normalizeToStartOfDay(toDate);

  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return 0;
  }

  const habitStart = normalizeToStartOfDay(habit.fechaInicio);
  const effectiveStart = rangeStart.getTime() < habitStart.getTime() ? habitStart : rangeStart;

  let effectiveEnd = rangeEnd;
  if (habit.fechaFin) {
    const habitEnd = normalizeToStartOfDay(habit.fechaFin);
    if (effectiveEnd.getTime() > habitEnd.getTime()) {
      effectiveEnd = habitEnd;
    }
  }

  if (effectiveStart.getTime() > effectiveEnd.getTime()) {
    return 0;
  }

  let count = 0;
  const current = new Date(effectiveStart.getTime());

  while (current.getTime() <= effectiveEnd.getTime()) {
    if (isHabitScheduledForDate(habit, current)) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
};

/**
 * Calcula el número total esperado de completados para una lista de hábitos
 * en un rango de fechas [fromDate, toDate].
 *
 * @param habits Lista de hábitos.
 * @param fromDate Fecha inicial del rango.
 * @param toDate Fecha final del rango.
 * @returns Número total esperado de completados para todos los hábitos.
 */
export const getExpectedCompletionsForHabits = (
  habits: Habit[],
  fromDate: Date | string,
  toDate: Date | string
): number => {
  return habits.reduce((acc, habit) => acc + getExpectedCompletions(habit, fromDate, toDate), 0);
};

/**
 * Filtra la lista de hábitos para devolver solo aquellos que deben completarse en la fecha especificada.
 *
 * NOTA: Esta función es pura. No modifica los argumentos ni tiene efectos secundarios.
 * Reutiliza la lógica central de programación (`isHabitScheduledForDate`).
 *
 * @param habits Lista de hábitos a filtrar.
 * @param date Fecha para la que se quieren obtener los hábitos (por defecto, hoy).
 * @returns Lista de hábitos aplicables para esa fecha.
 */
export const getHabitsForToday = (habits: Habit[], date: Date = new Date()): Habit[] => {
  return habits.filter((habit) => {
    // Si el hábito está marcado como inactivo, no se muestra
    if (!habit.activo) return false;
    return isHabitScheduledForDate(habit, date);
  });
};
