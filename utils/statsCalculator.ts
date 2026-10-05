/**
 * statsCalculator.ts
 *
 * Funciones puras de cálculo de estadísticas de hábitos.
 * ──────────────────────────────────────────────────────
 * RESPONSABILIDAD ÚNICA: transformar datos crudos (contadores de PeriodStats
 * y arrays de HabitLog ya cargados) en las métricas finales del contrato
 * de useHabitStats. Ninguna función aquí toca I/O ni efectos secundarios.
 *
 * Separación de capas:
 *   Repository  → consulta SQL optimizada  →  PeriodStats (solo contadores)
 *   statsCalculator  →  lógica pura        →  HabitStatsResult
 *   useHabitStats    →  orquestación       →  caché Zustand + hook público
 */

import { format, subDays, subMonths, startOfDay } from 'date-fns';
import { HabitLog, Habit } from '../types';
import { PeriodStats } from '../storage/LogRepository';
import { calculateCurrentStreak, calculateMaxStreak } from './streakCalculator';
import { getExpectedCompletions, getExpectedCompletionsForHabits } from './frequencyEngine';
import { parseLogicalDateUTC } from './dateUtils';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ──────────────────────────────────────────────────────────────────────────────

/** Periodos soportados por useHabitStats. */
export type StatsPeriod = 'weekly' | 'monthly' | 'total';

/**
 * Contrato de salida del hook useHabitStats.
 * Todos los valores son deterministas y derivables de los datos de la DB.
 */
export interface HabitStatsResult {
  /** Porcentaje de días completados sobre el total esperado de completados del periodo (0–100). */
  completionRate: number;
  /** Racha actual de días/semanas consecutivos completados. */
  currentStreak: number;
  /** Racha máxima histórica (días consecutivos completados). */
  maxStreak: number;
  /** Número de días (o combinaciones día×hábito en vista global) completados. */
  totalCompleted: number;
  /** Número esperado de completados del hábito en el periodo según su frecuencia y configuración. */
  expectedCompletions: number;
  /** Número de días calendario o esperado del periodo evaluado (mantenido por compatibilidad). */
  totalDays: number;
}

/**
 * Rango de fechas en formato YYYY-MM-DD (ordenable lexicográficamente en SQLite).
 */
export interface DateRange {
  fromDate: string;
  toDate: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Funciones puras
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera el rango de fechas [fromDate, toDate] correspondiente al periodo
 * solicitado, usando `referenceDate` como «hoy».
 *
 * Formatos de salida: YYYY-MM-DD (ISO 8601 sin hora).
 * Esto garantiza compatibilidad con las comparaciones de texto en SQLite.
 *
 * - 'weekly'  → últimos 7 días (hoy incluido)
 * - 'monthly' → últimos 30 días (hoy incluido)
 * - 'total'   → desde la fecha de inicio lógica (customStartDate o hoy si no se provee) hasta hoy.
 *
 * @param period          - Periodo deseado.
 * @param referenceDate   - Fecha de referencia (habitualmente new Date()).
 * @param customStartDate - Fecha inicial lógica opcional para 'total' (ej. fechaInicio o primer registro).
 * @returns DateRange con fromDate y toDate en formato YYYY-MM-DD.
 */
export const buildPeriodRange = (
  period: StatsPeriod,
  referenceDate: Date = new Date(),
  customStartDate?: string | Date
): DateRange => {
  const today = startOfDay(referenceDate);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (period) {
    case 'weekly':
      return { fromDate: fmt(subDays(today, 6)), toDate: fmt(today) };

    case 'monthly':
      return { fromDate: fmt(subMonths(today, 1)), toDate: fmt(today) };

    case 'total':
    default: {
      let fromDate: string;
      if (customStartDate) {
        if (typeof customStartDate === 'string') {
          fromDate = customStartDate.includes('T') ? customStartDate.split('T')[0] : customStartDate;
        } else {
          fromDate = fmt(customStartDate);
        }
      } else {
        // En ausencia de fecha explícita, se usa el día de hoy como fecha base lógica,
        // evitando fechas arbitrarias como 1970-01-01.
        fromDate = fmt(today);
      }
      return { fromDate, toDate: fmt(today) };
    }
  }
};

/**
 * Combina los contadores de `PeriodStats` (obtenidos de SQL) con las rachas
 * calculadas a partir de `logs` para producir el `HabitStatsResult` final.
 *
 * Denominador real de cumplimiento:
 * Si se pasa `dateRange`, se calcula mediante `getExpectedCompletions`
 * respetando la frecuencia real del hábito (diario, días de semana, mensual,
 * historial de programación, fechaInicio y fechaFin).
 *
 * @param periodStats   - Contadores {totalCompleted, totalDays} de la query SQL.
 * @param logs          - Array de HabitLog del mismo periodo (para calcular rachas).
 * @param habit         - Objeto Habit (necesario para la frecuencia en calculateCurrentStreak y expectedCompletions).
 * @param referenceDate - Fecha de referencia para "hoy" en el cálculo de racha actual.
 * @param dateRange     - Rango de fechas {fromDate, toDate} evaluado. Si se provee, se calcula el número esperado exacto.
 * @returns HabitStatsResult listo para cachear y exponer al hook.
 */
export const computeStats = (
  periodStats: PeriodStats,
  logs: HabitLog[],
  habit: Habit,
  referenceDate: Date = new Date(),
  dateRange?: DateRange
): HabitStatsResult => {
  const { totalCompleted } = periodStats;

  // Calculamos los completados esperados respetando la frecuencia real del hábito
  let expectedCompletions = periodStats.totalDays;
  if (dateRange) {
    expectedCompletions = getExpectedCompletions(habit, dateRange.fromDate, dateRange.toDate);
  }

  // completionRate: porcentaje de completados respecto a lo esperado (0-100)
  const completionRate =
    expectedCompletions > 0
      ? Math.min(100, Math.round((totalCompleted / expectedCompletions) * 1000) / 10)
      : 0;

  const currentStreak = calculateCurrentStreak(logs, habit, referenceDate);
  const maxStreak = calculateMaxStreak(logs, habit);

  return {
    completionRate,
    currentStreak,
    maxStreak,
    totalCompleted,
    expectedCompletions,
    totalDays: expectedCompletions,
  };
};

/**
 * Versión de computeStats para la vista GLOBAL (sin habitId).
 *
 * Si se proporciona la lista de hábitos del usuario y el dateRange,
 * el número esperado de completados se calcula como la suma de los esperados
 * de cada hábito en el rango, resolviendo el problema de denominadores incompatibles.
 *
 * @param periodStats   - Contadores SQL del periodo, modo global.
 * @param activeDates   - Fechas de todos los logs globales completados ordenados DESC (ej. ['2026-09-22', '2026-09-21']).
 * @param referenceDate - Fecha de referencia (hoy).
 * @param habits        - Lista opcional de hábitos del usuario para calcular esperado global.
 * @param dateRange     - Rango de fechas del periodo evaluado.
 */
export const computeGlobalStats = (
  periodStats: PeriodStats,
  activeDates: (string | HabitLog)[],
  referenceDate: Date = new Date(),
  habits?: Habit[],
  dateRange?: DateRange
): HabitStatsResult => {
  const { totalCompleted } = periodStats;

  let expectedCompletions = periodStats.totalDays;
  if (habits && habits.length > 0 && dateRange) {
    expectedCompletions = getExpectedCompletionsForHabits(habits, dateRange.fromDate, dateRange.toDate);
  }

  const completionRate =
    expectedCompletions > 0
      ? Math.min(100, Math.round((totalCompleted / expectedCompletions) * 1000) / 10)
      : 0;

  const { currentStreak, maxStreak } = calculateGlobalStreaks(activeDates, referenceDate);

  return {
    completionRate,
    currentStreak,
    maxStreak,
    totalCompleted,
    expectedCompletions,
    totalDays: expectedCompletions,
  };
};

/**
 * Calcula currentStreak y maxStreak dados un array de fechas únicas en formato YYYY-MM-DD
 * donde se ha completado al menos un hábito.
 * Maneja tanto strings de fechas como objetos HabitLog si se pasaran accidentalmente.
 *
 * @param activeDates   Array de fechas (ej: ['2026-09-22', '2026-09-21', '2026-09-18']) o logs
 * @param referenceDate Fecha actual de referencia (hoy).
 */
export const calculateGlobalStreaks = (
  activeDates: (string | HabitLog)[],
  referenceDate: Date = new Date()
): { currentStreak: number; maxStreak: number } => {
  if (!activeDates || activeDates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  // Normalizamos a array de strings 'YYYY-MM-DD', extrayendo si son objetos HabitLog
  const rawDates: string[] = activeDates.map((item: any) => {
    if (typeof item === 'string') {
      return item.includes('T') ? item.split('T')[0] : item;
    }
    if (item && typeof item === 'object' && typeof item.fecha === 'string') {
      return item.fecha.includes('T') ? item.fecha.split('T')[0] : item.fecha;
    }
    return '';
  }).filter(Boolean);

  if (rawDates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  // Deduplicar fechas y ordenar de forma estrictamente descendente
  const uniqueDates = Array.from(new Set(rawDates)).sort((a, b) => b.localeCompare(a));

  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(referenceDate, 1), 'yyyy-MM-dd');

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  let streakActive = false;

  const latestDate = uniqueDates[0];
  if (latestDate === todayStr || latestDate === yesterdayStr) {
    streakActive = true;
    tempStreak = 1;
    currentStreak = 1;
  } else {
    tempStreak = 1;
  }

  if (tempStreak > maxStreak) {
    maxStreak = tempStreak;
  }

  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const dCurr = parseLogicalDateUTC(uniqueDates[i]);
    const dNext = parseLogicalDateUTC(uniqueDates[i + 1]);
    const diffDays = Math.round((dCurr.getTime() - dNext.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      tempStreak++;
      if (streakActive) {
        currentStreak = tempStreak;
      }
    } else {
      streakActive = false;
      tempStreak = 1;
    }

    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }
  }

  return { currentStreak, maxStreak };
};
