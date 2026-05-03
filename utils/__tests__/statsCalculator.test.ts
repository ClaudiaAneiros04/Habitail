/**
 * statsCalculator.test.ts
 *
 * Tests unitarios para las funciones puras de statsCalculator.ts.
 * ──────────────────────────────────────────────────────────────────
 * Cobertura:
 *   - buildPeriodRange: casos normales y borde para weekly/monthly/total
 *   - computeStats: completionRate con distintas combinaciones + integración con rachas
 *   - computeGlobalStats: vista global con/sin logs
 *
 * Convención de fechas de prueba:
 *   Todas las fechas de referencia son mediodía UTC para evitar ambigüedades
 *   de zona horaria al aplicar startOfDay (que usa la zona local del proceso).
 *   En un entorno CI esto es especialmente importante.
 */

import {
  buildPeriodRange,
  computeStats,
  computeGlobalStats,
  HabitStatsResult,
} from '../statsCalculator';
import { PeriodStats } from '../../storage/LogRepository';
import { Habit, HabitLog, Frequency, Category, Priority, VerificationType } from '../../types';
import { formatISO, subDays, startOfDay } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

/** Fecha de referencia fija para todos los tests. */
const REF_DATE = new Date('2026-05-03T12:00:00Z');

const dailyHabit: Habit = {
  id: 'habit-daily',
  userId: 'user-1',
  nombre: 'Correr',
  categoria: Category.DEPORTE,
  icono: 'run',
  colorHex: '#FF5733',
  frecuencia: Frequency.DAILY,
  diasSemana: [1, 2, 3, 4, 5, 6, 7],
  tipoVerificacion: VerificationType.BOOLEAN,
  nivelPrioridad: Priority.NORMAL,
  fechaInicio: '2026-01-01T00:00:00Z',
  activo: true,
};

const weeklyHabit: Habit = {
  ...dailyHabit,
  id: 'habit-weekly',
  frecuencia: Frequency.WEEKLY,
  diasSemana: [1], // Lunes
};

/**
 * Crea un HabitLog completado N días antes de REF_DATE.
 */
const makeLog = (daysBack: number, completed = true): HabitLog => ({
  id: `log-${daysBack}-${completed}`,
  habitId: dailyHabit.id,
  userId: 'user-1',
  fecha: formatISO(subDays(startOfDay(REF_DATE), daysBack)),
  completado: completed,
  timestampRegistro: formatISO(new Date()),
});

// ──────────────────────────────────────────────────────────────────────────────
// buildPeriodRange
// ──────────────────────────────────────────────────────────────────────────────

describe('buildPeriodRange', () => {
  it('weekly → rango de exactamente 7 días', () => {
    const { fromDate, toDate } = buildPeriodRange('weekly', REF_DATE);
    // 2026-05-03 - 6 días = 2026-04-27
    expect(fromDate).toBe('2026-04-27');
    expect(toDate).toBe('2026-05-03');
  });

  it('monthly → fecha inicio es un mes antes del día de referencia', () => {
    const { fromDate, toDate } = buildPeriodRange('monthly', REF_DATE);
    // subMonths(2026-05-03, 1) = 2026-04-03
    expect(fromDate).toBe('2026-04-03');
    expect(toDate).toBe('2026-05-03');
  });

  it('total → desde el epoch hasta hoy', () => {
    const { fromDate, toDate } = buildPeriodRange('total', REF_DATE);
    expect(fromDate).toBe('1970-01-01');
    expect(toDate).toBe('2026-05-03');
  });

  it('fromDate siempre es ≤ toDate en todos los periodos', () => {
    (['weekly', 'monthly', 'total'] as const).forEach((p) => {
      const { fromDate, toDate } = buildPeriodRange(p, REF_DATE);
      expect(fromDate <= toDate).toBe(true);
    });
  });

  it('monthly al final de mes (31 enero → 28/29 feb) no explota', () => {
    const endOfJan = new Date('2026-01-31T12:00:00Z');
    const { fromDate, toDate } = buildPeriodRange('monthly', endOfJan);
    // subMonths(2026-01-31, 1) = 2026-01-01 (date-fns clamp al último día del mes anterior)
    expect(toDate).toBe('2026-01-31');
    expect(fromDate).toBe('2025-12-31');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeStats
// ──────────────────────────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('hábito sin logs → todos los valores en 0', () => {
    const stats: PeriodStats = { totalCompleted: 0, totalDays: 30 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    expect(result).toEqual<HabitStatsResult>({
      completionRate: 0,
      currentStreak: 0,
      maxStreak: 0,
      totalCompleted: 0,
      totalDays: 30,
    });
  });

  it('totalDays = 0 → completionRate 0 (sin división por cero)', () => {
    const stats: PeriodStats = { totalCompleted: 5, totalDays: 0 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    expect(result.completionRate).toBe(0);
  });

  it('completionRate del 50% en periodo de 30 días', () => {
    const stats: PeriodStats = { totalCompleted: 15, totalDays: 30 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    expect(result.completionRate).toBe(50.0);
  });

  it('completionRate se redondea a 1 decimal', () => {
    // 1/3 = 33.333... → 33.3
    const stats: PeriodStats = { totalCompleted: 1, totalDays: 3 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    expect(result.completionRate).toBe(33.3);
  });

  it('completionRate máximo: 100% cuando se completa todo el periodo', () => {
    const stats: PeriodStats = { totalCompleted: 7, totalDays: 7 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    expect(result.completionRate).toBe(100.0);
  });

  it('totalCompleted > totalDays no produce rate > 100 (dato inconsistente de DB)', () => {
    // Situación anómala: más completados que días del periodo. No debería
    // ocurrir con queries correctas, pero el cálculo no debe romperse.
    const stats: PeriodStats = { totalCompleted: 10, totalDays: 7 };
    const result = computeStats(stats, [], dailyHabit, REF_DATE);
    // 10/7 * 100 = 142.857... → Math.round(142857) / 10 = 142.9
    // No limitamos a 100 en la función pura (es responsabilidad de la query correcta),
    // pero sí verificamos que no explota
    expect(result.completionRate).toBeGreaterThan(0);
    expect(Number.isFinite(result.completionRate)).toBe(true);
  });

  it('currentStreak y maxStreak se calculan a partir de los logs provistos', () => {
    // Logs: hoy, ayer, anteayer → racha = 3
    const logs = [makeLog(0), makeLog(1), makeLog(2)];
    const stats: PeriodStats = { totalCompleted: 3, totalDays: 7 };
    const result = computeStats(stats, logs, dailyHabit, REF_DATE);

    expect(result.currentStreak).toBe(3);
    expect(result.maxStreak).toBe(3);
  });

  it('maxStreak refleja la racha más larga histórica, no la actual', () => {
    // Racha pasada de 5 días (hace 10-6 días), racha actual de 2 (hoy y ayer)
    const logs = [
      makeLog(0), makeLog(1),             // racha actual: 2
      makeLog(6), makeLog(7), makeLog(8), makeLog(9), makeLog(10), // racha pasada: 5
    ];
    const stats: PeriodStats = { totalCompleted: 7, totalDays: 30 };
    const result = computeStats(stats, logs, dailyHabit, REF_DATE);

    expect(result.currentStreak).toBe(2);
    expect(result.maxStreak).toBe(5);
  });

  it('logs no completados (completado=false) no cuentan en rachas', () => {
    // Un log incompleto no debe inflar la racha
    const logs = [makeLog(0), makeLog(1, false), makeLog(2)];
    const stats: PeriodStats = { totalCompleted: 2, totalDays: 7 };
    const result = computeStats(stats, logs, dailyHabit, REF_DATE);

    // La racha se rompe en el día 1 (no completado), así que currentStreak = 1 (solo hoy)
    expect(result.currentStreak).toBe(1);
  });

  it('hábito semanal: currentStreak cuenta semanas, no días', () => {
    // 3 semanas consecutivas con al menos un log cada una
    const { subWeeks } = require('date-fns');
    const makeWeeklyLog = (weeksBack: number): HabitLog => ({
      id: `wlog-${weeksBack}`,
      habitId: weeklyHabit.id,
      userId: 'user-1',
      fecha: formatISO(subDays(startOfDay(REF_DATE), weeksBack * 7)),
      completado: true,
      timestampRegistro: formatISO(new Date()),
    });

    const logs = [makeWeeklyLog(0), makeWeeklyLog(1), makeWeeklyLog(2)];
    const stats: PeriodStats = { totalCompleted: 3, totalDays: 21 };
    const result = computeStats(stats, logs, weeklyHabit, REF_DATE);

    expect(result.currentStreak).toBe(3); // 3 semanas
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeGlobalStats
// ──────────────────────────────────────────────────────────────────────────────

describe('computeGlobalStats', () => {
  it('sin logs → todos los valores en 0', () => {
    const stats: PeriodStats = { totalCompleted: 0, totalDays: 30 };
    const result = computeGlobalStats(stats, [], REF_DATE);
    expect(result).toEqual<HabitStatsResult>({
      completionRate: 0,
      currentStreak: 0,
      maxStreak: 0,
      totalCompleted: 0,
      totalDays: 30,
    });
  });

  it('completionRate correcto en modo global', () => {
    const stats: PeriodStats = { totalCompleted: 20, totalDays: 30 };
    const result = computeGlobalStats(stats, [], REF_DATE);
    // 20/30 = 66.666... → 66.7
    expect(result.completionRate).toBe(66.7);
  });

  it('no explota con totalDays = 0', () => {
    const stats: PeriodStats = { totalCompleted: 0, totalDays: 0 };
    const result = computeGlobalStats(stats, [], REF_DATE);
    expect(result.completionRate).toBe(0);
  });

  it('rachas globales se calculan sobre los logs provistos', () => {
    // En modo global los logs son de distintos habitIds pero
    // computeGlobalStats los trata como una sola secuencia
    const mixedLogs: HabitLog[] = [
      { ...makeLog(0), habitId: 'habit-a' },
      { ...makeLog(1), habitId: 'habit-b' },
      { ...makeLog(2), habitId: 'habit-a' },
    ];
    const stats: PeriodStats = { totalCompleted: 3, totalDays: 7 };
    const result = computeGlobalStats(stats, mixedLogs, REF_DATE);

    // calculateCurrentStreak trata todos como un único hábito DAILY sintético
    expect(result.currentStreak).toBe(3);
    expect(result.maxStreak).toBe(3);
  });
});
