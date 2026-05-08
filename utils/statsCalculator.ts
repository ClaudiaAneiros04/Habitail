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
  /** Porcentaje de días completados sobre el total de días del periodo (0–100). */
  completionRate: number;
  /** Racha actual de días/semanas consecutivos completados. */
  currentStreak: number;
  /** Racha máxima histórica (días consecutivos completados). */
  maxStreak: number;
  /** Número de días (o combinaciones día×hábito en vista global) completados. */
  totalCompleted: number;
  /** Número de días calendario del periodo evaluado. */
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
 * @param habit       - Objeto Habit (necesario para la frecuencia en calculateCurrentStreak).
 * @param referenceDate - Fecha de referencia para "hoy" en el cálculo de racha actual.
 * @returns HabitStatsResult listo para cachear y exponer al hook.
 */
export const computeStats = (
  periodStats: PeriodStats,
  logs: HabitLog[],
  habit: Habit,
  referenceDate: Date = new Date()
): HabitStatsResult => {
  const { totalCompleted, totalDays } = periodStats;

  // Evitar división por cero si el periodo calculado es 0 días (no debería ocurrir
  // con buildPeriodRange correctamente llamado, pero se cubre por robustez).
  const completionRate =
    totalDays > 0 ? Math.round((totalCompleted / totalDays) * 1000) / 10 : 0;
  // Math.round(x * 1000) / 10 = redondea a 1 decimal en porcentaje (misma lógica que streakCalculator)

  const currentStreak = calculateCurrentStreak(logs, habit, referenceDate);
  const maxStreak = calculateMaxStreak(logs);

  return {
    completionRate,
    currentStreak,
    maxStreak,
    totalCompleted,
    totalDays,
  };
};

/**
 * Versión de computeStats para la vista GLOBAL (sin habitId).
 *
 * En la vista global no existe un único `Habit` de referencia para la frecuencia,
 * por lo que las rachas se calculan con frecuencia implícita DAILY sobre los logs
 * combinados de todos los hábitos. Esto es una simplificación aceptable para una
 * vista de resumen: se documentan las implicaciones en LEARNING.md.
 *
 * Se crea un `Habit` sintético con frecuencia DAILY para reutilizar calculateCurrentStreak.
 *
 * @param periodStats   - Contadores SQL del periodo, modo global.
 * @param logs          - Logs del periodo de todos los hábitos del usuario.
 * @param referenceDate - Fecha de referencia.
 */
export const computeGlobalStats = (
  periodStats: PeriodStats,
  logs: HabitLog[],
  referenceDate: Date = new Date()
): HabitStatsResult => {
  const { totalCompleted, totalDays } = periodStats;

  const completionRate =
    totalDays > 0 ? Math.round((totalCompleted / totalDays) * 1000) / 10 : 0;

  // Hábito sintético para reutilizar calculateCurrentStreak en modo global.
  // diasSemana vacío y fechaInicio en el pasado son valores seguros porque
  // la función solo los usa para hábitos WEEKLY; en DAILY los ignora.
  const syntheticHabit: Habit = {
    id: '__global__',
    userId: '__global__',
    nombre: '__global__',
    categoria: 'SALUD',
    icono: '',
    colorHex: '',
    frecuencia: 'DAILY',
    diasSemana: [],
    tipoVerificacion: 'BOOLEAN',
    nivelPrioridad: 'NORMAL',
    fechaInicio: '1970-01-01',
    activo: true,
  };

  const currentStreak = calculateCurrentStreak(logs, syntheticHabit, referenceDate);
  const maxStreak = calculateMaxStreak(logs);

  return {
    completionRate,
    currentStreak,
    maxStreak,
    totalCompleted,
    totalDays,
  };
};
