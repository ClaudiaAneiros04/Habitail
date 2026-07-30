/**
 * chartAggregator.ts
 *
 * Funciones puras de agregación de datos para gráficos de barras de hábitos.
 * ─────────────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD ÚNICA: transformar un array de HabitLog y un Habit en
 * arrays de ChartData aptos para renderizar directamente en un gráfico.
 *
 * No hay I/O, no hay efectos secundarios, no hay acceso a stores.
 * Mismo input → mismo output siempre.
 */

import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, eachDayOfInterval, startOfDay, parseISO,
  format, isBefore, isAfter, max, min, subMonths
} from 'date-fns';
import { Habit, HabitLog, Frequency } from '../types';
import { isHabitScheduledForDate } from './frequencyEngine';
import i18n from '../i18n';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export type AggregateMode = 'weekly' | 'monthly' | 'total';

/**
 * Una barra del gráfico: puede representar un día (modo semanal)
 * o una semana del mes (modo mensual).
 */
export type ChartData = {
  /** Etiqueta del eje X. Ej: 'Lun', 'Semana 1', 'Ene'. */
  label: string;
  /** Tasa de cumplimiento 0–100 (redondeada a 1 decimal). */
  value: number;
  /** Días completados dentro del periodo de esta barra. */
  completed: number;
  /** Días con hábito programado dentro del periodo (denominador). */
  total: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Etiquetas de día para el modo semanal (Lun=índice 0, Dom=índice 6). */
const getDayLabel = (index: number): string => {
  const keys = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  return i18n.t(`common.daysShort.${keys[index]}`, { defaultValue: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index] });
};

/**
 * Alias de la lógica centralizada de programación para compatibilidad interna.
 */
const isDayScheduled = (day: Date, habit: Habit): boolean => isHabitScheduledForDate(habit, day);

/**
 * Dado un conjunto de días y los logs del hábito, cuenta:
 * - `total`     : días dentro del conjunto donde el hábito está programado.
 * - `completed` : de esos días, cuántos tienen un log completado.
 *
 * Deduplicación de logs:
 *   Se usa un Set<string> de fechas completadas → si hay dos logs el mismo día
 *   (corrupción de datos), solo cuenta uno. Documentado en LEARNING.md.
 *
 * Filtro por habitId:
 *   Se filtra `l.habitId === habit.id` por si el consumidor pasa logs mixtos,
 *   aunque lo recomendable es pasar logs ya filtrados para mayor eficiencia.
 *
 * @param days  - Días del periodo a evaluar.
 * @param logs  - Logs del hábito (pueden ser mixtos; se filtra por habitId).
 * @param habit - Hábito de referencia.
 */
const countDaysInPeriod = (
  days: Date[],
  logs: HabitLog[],
  habitOrHabits: Habit | Habit[],
): { total: number; completed: number } => {
  const habits = Array.isArray(habitOrHabits) ? habitOrHabits : [habitOrHabits];
  let totalAll = 0;
  let completedAll = 0;

  for (const habit of habits) {
    // Set de fechas completadas en formato YYYY-MM-DD → deduplicación automática
    const completedSet = new Set(
      logs
        .filter(l => l.completado && l.habitId === habit.id)
        .map(l => format(startOfDay(parseISO(l.fecha)), 'yyyy-MM-dd')),
    );

    for (const day of days) {
      if (!isDayScheduled(day, habit)) continue;
      totalAll++;
      if (completedSet.has(format(startOfDay(day), 'yyyy-MM-dd'))) completedAll++;
    }
  }

  return { total: totalAll, completed: completedAll };
};

/**
 * Calcula la tasa de cumplimiento redondeada a 1 decimal (0–100).
 * Devuelve 0 si `total = 0` para evitar división por cero.
 */
const computeRate = (completed: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((completed / total) * 1000) / 10;
};

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Agrega logs por día de la semana actual (Lun–Dom).
 * Devuelve exactamente 7 entradas ChartData.
 *
 * La semana se calcula respecto a `referenceDate` (por defecto, hoy).
 * Las semanas empiezan en Lunes (weekStartsOn: 1) para alinearse con
 * el resto de la lógica de la app (ver streakCalculator.ts).
 *
 * Caso borde — hábito creado a mitad de semana:
 *   Los días anteriores a `fechaInicio` tienen `total = 0` y `value = 0`.
 *   No aparecen como incumplidos, solo como "sin datos".
 *
 * @param logs          - Logs del hábito en cualquier rango (se filtran internamente).
 * @param habit         - Hábito a representar.
 * @param referenceDate - Fecha de referencia para determinar la semana actual.
 */
export const aggregateByWeek = (
  logs: HabitLog[],
  habitOrHabits: Habit | Habit[],
  referenceDate: Date = new Date(),
): ChartData[] => {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });

  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const { total, completed } = countDaysInPeriod([day], logs, habitOrHabits);
    return { label: getDayLabel(i), value: computeRate(completed, total), completed, total };
  });
};

/**
 * Agrega logs por semana ISO del mes actual.
 * Devuelve entre 4 y 5 entradas, una por semana que se solape con el mes.
 * Las semanas se recortan a los límites del mes (max/min).
 *
 * Caso borde — mes que empieza en miércoles:
 *   La primera "Semana" solo tiene días miércoles–domingo del mes.
 *   `total` refleja solo esos días (≤5), no una semana completa de 7.
 *
 * Caso borde — mes con 5 semanas (ej: mayo 2026, 31 días empezando viernes):
 *   Se generan 5 entradas; la última cubre los días restantes aunque sean <7.
 *
 * @param logs          - Logs del hábito en cualquier rango.
 * @param habit         - Hábito a representar.
 * @param referenceDate - Fecha de referencia para determinar el mes actual.
 */
export const aggregateByMonth = (
  logs: HabitLog[],
  habitOrHabits: Habit | Habit[],
  referenceDate: Date = new Date(),
): ChartData[] => {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd   = endOfMonth(referenceDate);
  const result: ChartData[] = [];

  let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  let weekNum   = 1;

  while (!isAfter(weekStart, monthEnd)) {
    const weekEnd        = endOfWeek(weekStart, { weekStartsOn: 1 });
    const effectiveStart = max([weekStart, monthStart]);
    const effectiveEnd   = min([weekEnd, monthEnd]);

    const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
    const { total, completed } = countDaysInPeriod(days, logs, habitOrHabits);

    result.push({
      label: i18n.t('stats.charts.weekNum', { num: weekNum, defaultValue: `Semana ${weekNum}` }),
      value: computeRate(completed, total),
      completed,
      total,
    });

    weekStart = addDays(weekEnd, 1);
    weekNum++;
  }

  return result;
};

/**
 * Agrega logs por mes para los últimos 6 meses.
 * Útil para la vista "Total" o "Histórica".
 *
 * @param logs          - Logs del hábito.
 * @param habit         - Hábito a representar.
 * @param referenceDate - Fecha de referencia (hoy).
 */
export const aggregateByHistory = (
  logs: HabitLog[],
  habitOrHabits: Habit | Habit[],
  referenceDate: Date = new Date(),
): ChartData[] => {
  const result: ChartData[] = [];
  const getMonthLabel = (monthIndex: number): string => {
    const keys = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return i18n.t(`common.monthsShort.${keys[monthIndex]}`, { defaultValue: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][monthIndex] });
  };

  for (let i = 5; i >= 0; i--) {
    const monthTarget = subMonths(referenceDate, i);
    const monthStart = startOfMonth(monthTarget);
    const monthEnd = endOfMonth(monthTarget);

    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const { total, completed } = countDaysInPeriod(days, logs, habitOrHabits);

    result.push({
      label: getMonthLabel(monthTarget.getMonth()),
      value: computeRate(completed, total),
      completed,
      total,
    });
  }

  return result;
};

/**
 * Función de entrada única parametrizable por modo.
 * Delega a `aggregateByWeek`, `aggregateByMonth` o `aggregateByHistory` según `mode`.
 *
 * @param logs          - Logs del hábito.
 * @param habit         - Hábito a representar.
 * @param mode          - 'weekly' | 'monthly' | 'total'.
 * @param referenceDate - Fecha de referencia (por defecto: hoy).
 */
export const aggregateChartData = (
  logs: HabitLog[],
  habitOrHabits: Habit | Habit[],
  mode: AggregateMode,
  referenceDate: Date = new Date(),
): ChartData[] => {
  switch (mode) {
    case 'weekly':
      return aggregateByWeek(logs, habitOrHabits, referenceDate);
    case 'monthly':
      return aggregateByMonth(logs, habitOrHabits, referenceDate);
    case 'total':
      return aggregateByHistory(logs, habitOrHabits, referenceDate);
    default:
      return [];
  }
};
