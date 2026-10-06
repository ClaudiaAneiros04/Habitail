import { Habit, Frequency, LogicalDate } from '../types';
import {
  toLogicalDate,
  addDaysToLogicalDate,
  getDayOfWeek,
  getDaysInMonth,
  parseLogicalDateUTC,
} from './dateUtils';

/**
 * Snapshot del estado de programación de un hábito en una fecha histórica o actual.
 */
export interface HabitScheduleSnapshot {
  /** Indica si el hábito ya existía en la fecha dada (targetDate >= fechaInicio). */
  exists: boolean;
  /** Indica si el hábito estaba activo (no archivado) en la fecha dada. */
  active: boolean;
  /** Frecuencia vigente en esa fecha (DAILY, WEEKLY, MONTHLY). */
  frecuencia: Frequency | string;
  /** Días semanales configurados en esa fecha (para WEEKLY). */
  diasSemana: number[];
}

/**
 * Normaliza una fecha (Date o string ISO / YYYY-MM-DD) al inicio del día en UTC.
 * Mantenido por retrocompatibilidad.
 */
export const normalizeToStartOfDay = (date: Date | string): Date => {
  return parseLogicalDateUTC(date);
};

/**
 * Obtiene la configuración de programación y estado activo del hábito para cualquier fecha.
 * Consulta el historial (scheduleHistory) si está disponible, o la configuración actual si no hay historial.
 *
 * @param habit Hábito a consultar.
 * @param date Fecha objetivo (LogicalDate, string o Date).
 * @returns HabitScheduleSnapshot o null si el hábito aún no existía en esa fecha.
 */
export const getHabitScheduleForDate = (
  habit: Habit,
  date: LogicalDate | string | Date
): HabitScheduleSnapshot | null => {
  const targetDate = toLogicalDate(date);
  const habitStart = toLogicalDate(habit.fechaInicio);

  // 1. Si targetDate es anterior a fechaInicio, el hábito aún no existía
  if (targetDate < habitStart) {
    return null;
  }

  // 2. Si habit.fechaFin existe y targetDate es posterior, el hábito ha finalizado
  if (habit.fechaFin) {
    const habitEnd = toLogicalDate(habit.fechaFin);
    if (targetDate > habitEnd) {
      return {
        exists: true,
        active: false,
        frecuencia: habit.frecuencia,
        diasSemana: habit.diasSemana,
      };
    }
  }

  // 3. Si hay historial de programación, evaluamos los intervalos
  if (habit.scheduleHistory && habit.scheduleHistory.length > 0) {
    // Ordenamos cronológicamente por validFrom ascendente
    const sorted = [...habit.scheduleHistory].sort((a, b) =>
      toLogicalDate(a.validFrom).localeCompare(toLogicalDate(b.validFrom))
    );

    // Buscamos de más reciente a más antiguo el intervalo aplicable
    // Regla de intervalo semiabierto: validFrom <= targetDate < validUntil (o validUntil === null)
    for (let i = sorted.length - 1; i >= 0; i--) {
      const entry = sorted[i];
      const validFrom = toLogicalDate(entry.validFrom);
      const validUntil = entry.validUntil ? toLogicalDate(entry.validUntil) : null;

      if (targetDate >= validFrom && (validUntil === null || targetDate < validUntil)) {
        return {
          exists: true,
          active: entry.activo !== undefined ? Boolean(entry.activo) : true,
          frecuencia: entry.frecuencia,
          diasSemana: Array.isArray(entry.diasSemana) ? entry.diasSemana : [],
        };
      }
    }

    // Si targetDate es anterior al primer registro de historial pero >= habitStart
    if (sorted.length > 0 && targetDate < toLogicalDate(sorted[0].validFrom)) {
      return {
        exists: true,
        active: sorted[0].activo !== undefined ? Boolean(sorted[0].activo) : true,
        frecuencia: sorted[0].frecuencia,
        diasSemana: Array.isArray(sorted[0].diasSemana) ? sorted[0].diasSemana : [],
      };
    }
  }

  // Fallback si no hay historial disponible:
  // Si targetDate está dentro del ciclo de vida [fechaInicio, fechaFin], el hábito estaba activo durante ese periodo.
  const wasActiveDuringLifespan = habit.fechaFin
    ? targetDate <= toLogicalDate(habit.fechaFin)
    : Boolean(habit.activo);

  return {
    exists: true,
    active: wasActiveDuringLifespan,
    frecuencia: habit.frecuencia,
    diasSemana: Array.isArray(habit.diasSemana) ? habit.diasSemana : [],
  };
};

/**
 * Determina canónicamente si un hábito correspondía realizarse en una fecha dada.
 *
 * Reglas de dominio:
 * 1. Si targetDate < fechaInicio -> false (el hábito aún no existía; fechaInicio es inclusiva).
 * 2. Si targetDate > fechaFin (si existe) -> false (fechaFin es inclusiva).
 * 3. Si el hábito estaba archivado / inactivo en esa fecha según su historial -> false.
 * 4. DAILY: corresponde todos los días de su intervalo activo.
 * 5. WEEKLY: corresponde si el día de la semana (0=Dom...6=Sáb) coincide con diasSemana.
 * 6. MONTHLY: corresponde en el día mensual de creación. Si el hábito nació un 29, 30 o 31
 *    y el mes no tiene ese día, corresponde el último día del mes.
 *
 * @param habit Hábito a evaluar.
 * @param date Fecha objetivo (LogicalDate, string o Date).
 * @returns boolean indicando si el hábito debía realizarse ese día.
 */
export const isHabitExpectedOnDate = (
  habit: Habit,
  date: LogicalDate | string | Date
): boolean => {
  const targetDate = toLogicalDate(date);
  const schedule = getHabitScheduleForDate(habit, targetDate);

  if (!schedule || !schedule.exists || !schedule.active) {
    return false;
  }

  const freq = schedule.frecuencia as Frequency;

  switch (freq) {
    case Frequency.DAILY:
    case 'DAILY':
      return true;

    case Frequency.WEEKLY:
    case 'WEEKLY': {
      if (!Array.isArray(schedule.diasSemana) || schedule.diasSemana.length === 0) {
        return false;
      }
      // Convención estándar JS: 0=Domingo, 1=Lunes, ..., 6=Sábado.
      // Normalizamos 7 a 0 por compatibilidad con sistemas que usan ISO (1-7).
      const normalizedDays = schedule.diasSemana.map((d) => (d === 7 ? 0 : d));
      const dayOfWeek = getDayOfWeek(targetDate);
      return normalizedDays.includes(dayOfWeek);
    }

    case Frequency.MONTHLY:
    case 'MONTHLY': {
      // Regla de Habitail: el día mensual procede del día de inicio
      const habitStart = toLogicalDate(habit.fechaInicio);
      const creationDay = parseInt(habitStart.split('-')[2], 10);

      const targetParts = targetDate.split('-').map(Number);
      const targetYear = targetParts[0];
      const targetMonth = targetParts[1];
      const targetDay = targetParts[2];

      const maxDaysInMonth = getDaysInMonth(targetYear, targetMonth);
      const expectedDay = Math.min(creationDay, maxDaysInMonth);

      return targetDay === expectedDay;
    }

    default:
      return false;
  }
};

/**
 * Filtra una lista de hábitos devolviendo solo aquellos que correspondían
 * completarse en la fecha especificada según su estado histórico.
 *
 * @param habits Lista de hábitos.
 * @param date Fecha objetivo (LogicalDate, string o Date).
 * @returns Hábitos esperados en esa fecha.
 */
export const getHabitsExpectedOnDate = (
  habits: Habit[],
  date: LogicalDate | string | Date
): Habit[] => {
  const targetDate = toLogicalDate(date);
  return habits.filter((habit) => isHabitExpectedOnDate(habit, targetDate));
};

/**
 * Cuenta cuántas veces debía realizarse un hábito entre dos fechas (ambas inclusive),
 * evaluando día por día según el historial real de programación y estado activo.
 *
 * @param habit Hábito a evaluar.
 * @param from Fecha inicial (inclusive).
 * @param to Fecha final (inclusive).
 * @returns Número exacto de ocurrencias esperadas.
 */
export const countExpectedOccurrences = (
  habit: Habit,
  from: LogicalDate | string | Date,
  to: LogicalDate | string | Date
): number => {
  const fromDate = toLogicalDate(from);
  const toDate = toLogicalDate(to);

  if (fromDate > toDate) {
    return 0;
  }

  let count = 0;
  let current = fromDate;

  while (current <= toDate) {
    if (isHabitExpectedOnDate(habit, current)) {
      count++;
    }
    current = addDaysToLogicalDate(current, 1);
  }

  return count;
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers temporales de retrocompatibilidad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper de retrocompatibilidad para getActiveScheduleForDate.
 */
export const getActiveScheduleForDate = (
  habit: Habit,
  date: Date | string
): { frecuencia: string; diasSemana: number[] } => {
  const snapshot = getHabitScheduleForDate(habit, date);
  if (!snapshot) {
    return { frecuencia: habit.frecuencia, diasSemana: habit.diasSemana };
  }
  return { frecuencia: snapshot.frecuencia, diasSemana: snapshot.diasSemana };
};

/**
 * Wrapper de retrocompatibilidad para isHabitScheduledForDate.
 */
export const isHabitScheduledForDate = (habit: Habit, date: Date | string): boolean => {
  return isHabitExpectedOnDate(habit, date);
};

/**
 * Wrapper de retrocompatibilidad para getExpectedCompletions.
 */
export const getExpectedCompletions = (
  habit: Habit,
  fromDate: Date | string,
  toDate: Date | string
): number => {
  return countExpectedOccurrences(habit, fromDate, toDate);
};

/**
 * Wrapper de retrocompatibilidad para getExpectedCompletionsForHabits.
 */
export const getExpectedCompletionsForHabits = (
  habits: Habit[],
  fromDate: Date | string,
  toDate: Date | string
): number => {
  return habits.reduce((acc, habit) => acc + countExpectedOccurrences(habit, fromDate, toDate), 0);
};

/**
 * Wrapper de retrocompatibilidad para getHabitsForToday.
 */
export const getHabitsForToday = (habits: Habit[], date: Date | string = new Date()): Habit[] => {
  return getHabitsExpectedOnDate(habits, date);
};
