import { computeStats, computeGlobalStats, buildPeriodRange } from '../statsCalculator';
import { Habit, Frequency, Category, Priority, VerificationType, HabitLog } from '../../types';
import { PeriodStats } from '../../storage/LogRepository';

describe('statsCalculator - computeStats y completionRate centralizado', () => {
  const baseHabit: Habit = {
    id: 'habit-1',
    userId: 'user-1',
    nombre: 'Ejercicio',
    categoria: Category.SALUD,
    icono: 'barbell',
    colorHex: '#3b82f6',
    frecuencia: Frequency.WEEKLY,
    diasSemana: [1, 3, 5], // Lun, Mié, Vie
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2026-09-01',
    activo: true,
  };

  it('Ejemplo de usuario: Hábito Lun/Mié/Vie en 1-7 sep con 2 completados debe tener completionRate = 66.7% (2/3), no 28.6% (2/7)', () => {
    // Rango 1 a 7 de septiembre de 2026:
    // Lunes 7, Miércoles 2, Viernes 4 -> Esperado = 3
    const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
    const periodStats: PeriodStats = {
      totalCompleted: 2,
      totalDays: 7, // 7 días calendario
    };
    const logs: HabitLog[] = [];

    const result = computeStats(periodStats, logs, baseHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

    expect(result.expectedCompletions).toBe(3);
    // 2 / 3 * 100 = 66.666... -> redondeado a 1 decimal = 66.7
    expect(result.completionRate).toBe(66.7);
    expect(result.totalCompleted).toBe(2);
  });

  it('Hábito DAILY: en 7 días con 5 completados debe dar completionRate = 71.4% (5/7)', () => {
    const dailyHabit: Habit = {
      ...baseHabit,
      frecuencia: Frequency.DAILY,
      fechaInicio: '2026-09-01',
    };
    const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
    const periodStats: PeriodStats = {
      totalCompleted: 5,
      totalDays: 7,
    };

    const result = computeStats(periodStats, [], dailyHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

    // 5 / 7 * 100 = 71.428... -> 71.4
    expect(result.expectedCompletions).toBe(7);
    expect(result.completionRate).toBe(71.4);
  });

  it('Hábito MONTHLY: en un mes con 1 día esperado y 1 completado debe dar 100%', () => {
    const monthlyHabit: Habit = {
      ...baseHabit,
      frecuencia: Frequency.MONTHLY,
      fechaInicio: '2026-08-15',
    };
    const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-30' };
    const periodStats: PeriodStats = {
      totalCompleted: 1,
      totalDays: 30, // 30 días calendario
    };

    const result = computeStats(periodStats, [], monthlyHabit, new Date('2026-09-30T12:00:00Z'), dateRange);

    expect(result.expectedCompletions).toBe(1);
    expect(result.completionRate).toBe(100);
  });

  it('Retrocompatibilidad: si no se pasa dateRange, utiliza periodStats.totalDays como denominador sin fallar', () => {
    const periodStats: PeriodStats = {
      totalCompleted: 4,
      totalDays: 10,
    };

    const result = computeStats(periodStats, [], baseHabit);

    expect(result.expectedCompletions).toBe(10);
    expect(result.completionRate).toBe(40.0);
  });

  describe('computeGlobalStats', () => {
    it('debe calcular completionRate global sobre la suma de completados esperados de los hábitos del usuario', () => {
      const habit1: Habit = {
        ...baseHabit,
        id: 'h1',
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
      };
      const habit2: Habit = {
        ...baseHabit,
        id: 'h2',
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-09-01',
      };

      // Rango 1-7 sep 2026:
      // habit1 esperado = 7
      // habit2 esperado = 3
      // Total esperado = 10
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = {
        totalCompleted: 8,
        totalDays: 7, // 7 días calendario
      };

      const result = computeGlobalStats(
        periodStats,
        [],
        new Date('2026-09-07T12:00:00Z'),
        [habit1, habit2],
        dateRange
      );

      expect(result.expectedCompletions).toBe(10);
      // 8 / 10 * 100 = 80.0%
      expect(result.completionRate).toBe(80.0);
      expect(result.totalCompleted).toBe(8);
    });
  });
});
