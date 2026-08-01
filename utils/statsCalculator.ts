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
 * Esto garantiza compatibilidad con las comparaciones de texto en SQLite
 * (ver LEARNING.md — Índices y formato de fechas).
 *
 * - 'weekly'  → últimos 7 días (hoy incluido)
 * - 'monthly' → últimos 30 días (hoy incluido)
 * - 'total'   → desde el epoch (1970-01-01) hasta hoy — equivale a "todo el historial"
 *
 * Caso borde — 'total':
 * No conocemos la fecha de inicio del usuario en este nivel de utilidad, así que
 * usamos 1970-01-01 como mínimo absoluto. SQLite retornará 0 registros anteriores
 * a fechaInicio del hábito de todas formas, ya que simplemente no existen.
 *
 * @param period        - Periodo deseado.
 * @param referenceDate - Fecha de referencia (habitualmente new Date()).
 * @returns DateRange con fromDate y toDate en formato YYYY-MM-DD.
 */
export const buildPeriodRange = (period: StatsPeriod, referenceDate: Date = new Date()): DateRange => {
  const today = startOfDay(referenceDate);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (period) {
    case 'weekly':
      return { fromDate: fmt(subDays(today, 6)), toDate: fmt(today) };

    case 'monthly':
      // subMonths respeta meses con distinto número de días (28/29/30/31)
      // y es más semántico que subDays(29): "el mismo día del mes anterior"
      return { fromDate: fmt(subMonths(today, 1)), toDate: fmt(today) };

    case 'total':
    default:
      // Historial completo: cualquier log registrado desde el origen de los tiempos.
      // totalDays será grande (>20.000 días), pero la completionRate seguirá siendo
      // coherente porque totalCompleted también abarca todo el historial.
      return { fromDate: '1970-01-01', toDate: fmt(today) };
  }
};

/**
 * Combina los contadores de `PeriodStats` (obtenidos de SQL) con las rachas
 * calculadas a partir de `logs` para producir el `HabitStatsResult` final.
 *
 * Por qué recibe `logs` para las rachas y no usa contadores SQL:
 * - `calculateCurrentStreak` y `calculateMaxStreak` requieren el orden temporal
 *   completo de los registros para detectar huecos (días/semanas perdidas).
 *   Un simple COUNT no es suficiente; necesitamos la secuencia de fechas.
 * - El array de logs para rachas proviene de `getLogsForRange`, que ya está
 *   acotado al periodo y usa el índice compuesto — no es un full scan.
 * - Para el periodo 'total', logs puede ser grande; la función de racha sí
 *   itera sobre él, pero solo lo hace UNA vez por render gracias al caché Zustand.
 *
 * Caso borde — habit sin logs:
 * Si `logs` está vacío, las rachas son 0 y `periodStats.totalCompleted` es 0.
 * Se retorna un resultado vacío válido en lugar de lanzar excepción.
 *
 * Caso borde — habit con frecuencia WEEKLY:
 * `calculateCurrentStreak` ya gestiona hábitos semanales internamente.
 * `buildPeriodRange` no necesita adaptarse: el rango de fechas es el mismo;
 * la diferencia es cómo se cuentan los huecos dentro de la racha.
 *
 * @param periodStats - Contadores {totalCompleted, totalDays} de la query SQL.
 * @param logs        - Array de HabitLog del mismo periodo (para calcular rachas).
 * @param habit       - Objeto Habit (necesario para la frecuencia en calculateCurrentStreak y expectedCompletions).
 * @param referenceDate - Fecha de referencia para "hoy" en el cálculo de racha actual.
 * @param dateRange   - Rango de fechas {fromDate, toDate} evaluado. Si se provee, se calcula el número esperado exacto.
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
  activeDates: string[],
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
 * El array debe estar ordenado descendentemente (de la fecha más reciente a la más antigua).
 *
 * @param activeDates Array de fechas (ej: ['2026-09-22', '2026-09-21', '2026-09-18'])
 * @param referenceDate Fecha actual de referencia (hoy).
 */
export const calculateGlobalStreaks = (
  activeDates: string[],
  referenceDate: Date = new Date()
): { currentStreak: number; maxStreak: number } => {
  if (!activeDates || activeDates.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(referenceDate, 1), 'yyyy-MM-dd');

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;
  let currentStreakBroken = false;

  // activeDates asume orden DESC
  for (let i = 0; i < activeDates.length; i++) {
    const dStr = activeDates[i];
    const dDate = new Date(dStr + 'T00:00:00Z');

    if (prevDate === null) {
      // Es el primer elemento encontrado. Si no es hoy ni ayer, la racha actual es 0.
      if (dStr !== todayStr && dStr !== yesterdayStr) {
        currentStreakBroken = true;
      }
      tempStreak = 1;
    } else {
      // Comprobar si la fecha anterior era exactamente 1 día después que dDate (porque recorremos DESC)
      const diffTime = prevDate.getTime() - dDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        tempStreak++;
      } else {
        // La racha se rompió
        if (!currentStreakBroken) {
          currentStreak = tempStreak;
          currentStreakBroken = true;
        }
        tempStreak = 1; // empezamos nueva racha para calcular maxStreak
      }
    }

    if (tempStreak > maxStreak) {
      maxStreak = tempStreak;
    }

    prevDate = dDate;
  }

  if (!currentStreakBroken) {
    currentStreak = tempStreak;
  }

  return { currentStreak, maxStreak };
};
