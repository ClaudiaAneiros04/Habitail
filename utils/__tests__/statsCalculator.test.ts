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

  // ────────────────────────────────────────────────────────────────────────────
  // CASOS OBLIGATORIOS ESPECIFICADOS
  // ────────────────────────────────────────────────────────────────────────────

  describe('Casos de negocio obligatorios', () => {
    // Caso 1: Hábito diario durante 7 días
    it('Caso 1: Hábito diario durante 7 días con 7 completados debe dar 100% (7/7)', () => {
      const dailyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
      };
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 7, totalDays: 7 };

      const result = computeStats(periodStats, [], dailyHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

      expect(result.expectedCompletions).toBe(7);
      expect(result.completionRate).toBe(100);
      expect(result.totalCompleted).toBe(7);
    });

    // Caso 2: Hábito lunes-miércoles-viernes
    it('Caso 2: Hábito Lun-Mié-Vie en semana con 2 completados debe dar 66.7% (2/3), no 28.6% (2/7)', () => {
      const weeklyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-09-01',
      };
      // 1-7 sep 2026: Mié 2, Vie 4, Lun 7 -> 3 esperados
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 2, totalDays: 7 };

      const result = computeStats(periodStats, [], weeklyHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

      expect(result.expectedCompletions).toBe(3);
      expect(result.completionRate).toBe(66.7);
      expect(result.totalCompleted).toBe(2);
    });

    // Caso 3: Hábito creado a mitad de semana
    it('Caso 3: Hábito creado a mitad de semana ajusta el denominador únicamente a los días válidos', () => {
      // Semana 1 a 7 sep 2026. Creado el Jueves 4 de septiembre.
      // Días evaluados: Jue 4, Vie 5, Sáb 6, Dom 7 = 4 días
      const midWeekHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-04',
      };
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 4, totalDays: 7 };

      const result = computeStats(periodStats, [], midWeekHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

      // Denominador debe ser 4, no 7
      expect(result.expectedCompletions).toBe(4);
      expect(result.completionRate).toBe(100);
    });

    it('Caso 3b: Hábito Lun-Mié-Vie creado a mitad de semana cuenta solo los días programados posteriores a fechaInicio', () => {
      // Creado el Jueves 3 de septiembre. En 1-7 sep: Mié 2 queda descartado, solo Vie 4 y Lun 7 -> 2 esperados
      const midWeekWeekly: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-09-03',
      };
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 2, totalDays: 7 };

      const result = computeStats(periodStats, [], midWeekWeekly, new Date('2026-09-07T12:00:00Z'), dateRange);

      expect(result.expectedCompletions).toBe(2);
      expect(result.completionRate).toBe(100);
    });

    // Caso 4: Hábito con fechaFin
    it('Caso 4: Hábito con fechaFin finalizado a mitad de semana solo cuenta días hasta fechaFin', () => {
      // Creado 1 sep, finalizado el 3 sep (Miércoles). Solo 1, 2, 3 sep -> 3 días
      const endingHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-03',
      };
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 2, totalDays: 7 };

      const result = computeStats(periodStats, [], endingHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

      // Esperado debe ser 3 días (1, 2, 3), denominador = 3
      expect(result.expectedCompletions).toBe(3);
      // 2 / 3 * 100 = 66.7%
      expect(result.completionRate).toBe(66.7);
    });

    // Caso 5: Hábito que cambió de frecuencia históricamente
    it('Caso 5: Hábito que cambió de frecuencia calcula los esperados combinando configuraciones históricas', () => {
      const historyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'habit-1',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [1, 3, 5],
            validFrom: '2026-09-01T00:00:00Z',
            validUntil: '2026-09-04T00:00:00Z', // Mié 2 -> 1 esperado
          },
          {
            id: 'sh-2',
            habitId: 'habit-1',
            frecuencia: Frequency.DAILY,
            diasSemana: [],
            validFrom: '2026-09-04T00:00:00Z',
            validUntil: null, // Vie 4, Sáb 5, Dom 6, Lun 7 -> 4 esperados
          },
        ],
      };
      // Total esperado: 1 + 4 = 5
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = { totalCompleted: 4, totalDays: 7 };

      const result = computeStats(periodStats, [], historyHabit, new Date('2026-09-07T12:00:00Z'), dateRange);

      expect(result.expectedCompletions).toBe(5);
      // 4 / 5 * 100 = 80.0%
      expect(result.completionRate).toBe(80.0);
    });

    // Caso 6: Semana sin ningún día programado
    it('Caso 6: Semana sin ningún día programado da completionRate = 0 sin división por cero', () => {
      const emptyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [0], // Solo domingos
        fechaInicio: '2026-09-01',
      };
      // Martes 1 a Viernes 4 de sep (no incluye domingo)
      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-04' };
      const periodStats: PeriodStats = { totalCompleted: 0, totalDays: 4 };

      const result = computeStats(periodStats, [], emptyHabit, new Date('2026-09-04T12:00:00Z'), dateRange);

      expect(result.expectedCompletions).toBe(0);
      expect(result.completionRate).toBe(0);
    });

    // Caso 7: Periodo total
    it('Caso 7: Periodo total calcula días esperados desde fechaInicio lógica y no desde 1970-01-01', () => {
      const totalHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-08-01',
      };
      // Rango total desde su creación hasta el 31 de agosto (31 días)
      const totalRange = buildPeriodRange('total', new Date('2026-08-31T12:00:00Z'), totalHabit.fechaInicio);
      expect(totalRange.fromDate).toBe('2026-08-01');
      expect(totalRange.toDate).toBe('2026-08-31');

      const periodStats: PeriodStats = { totalCompleted: 31, totalDays: 31 };
      const result = computeStats(periodStats, [], totalHabit, new Date('2026-08-31T12:00:00Z'), totalRange);

      expect(result.expectedCompletions).toBe(31);
      expect(result.completionRate).toBe(100);
    });

    // Caso 8: Hábito archivado pero con histórico anterior
    it('Caso 8: Hábito archivado mantiene su histórico y calcula correctamente estadísticas de su periodo activo', () => {
      const archivedHabit: Habit = {
        ...baseHabit,
        activo: false,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-31', // Archivado el 31 de agosto
      };

      // Si se consulta su periodo activo (Agosto)
      const activePeriodRange = { fromDate: '2026-08-01', toDate: '2026-08-31' };
      const periodStats: PeriodStats = { totalCompleted: 25, totalDays: 31 };

      const logs: HabitLog[] = [
        {
          id: 'l1',
          habitId: archivedHabit.id,
          userId: archivedHabit.userId,
          fecha: '2026-08-30',
          completado: true,
          timestampRegistro: '2026-08-30T10:00:00Z',
        },
        {
          id: 'l2',
          habitId: archivedHabit.id,
          userId: archivedHabit.userId,
          fecha: '2026-08-31',
          completado: true,
          timestampRegistro: '2026-08-31T10:00:00Z',
        },
      ];

      const result = computeStats(periodStats, logs, archivedHabit, new Date('2026-10-05T12:00:00Z'), activePeriodRange);

      expect(result.expectedCompletions).toBe(31);
      // 25 / 31 = 80.6%
      expect(result.completionRate).toBe(80.6);
      expect(result.totalCompleted).toBe(25);
      expect(result.maxStreak).toBeGreaterThanOrEqual(2);
      // Racha actual en octubre (hoy) debe ser 0 porque no se completó hoy/ayer
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('computeGlobalStats y calculateGlobalStreaks', () => {
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

      const dateRange = { fromDate: '2026-09-01', toDate: '2026-09-07' };
      const periodStats: PeriodStats = {
        totalCompleted: 8,
        totalDays: 7,
      };

      const result = computeGlobalStats(
        periodStats,
        ['2026-09-07', '2026-09-06'],
        new Date('2026-09-07T12:00:00Z'),
        [habit1, habit2],
        dateRange
      );

      expect(result.expectedCompletions).toBe(10);
      expect(result.completionRate).toBe(80.0);
      expect(result.totalCompleted).toBe(8);
      expect(result.currentStreak).toBe(2);
      expect(result.maxStreak).toBe(2);
    });

    it('calculateGlobalStreaks debe aceptar tanto string[] como HabitLog[] sin romperse con [object Object]', () => {
      const habitLogs = [
        { fecha: '2026-09-07T10:00:00Z' },
        { fecha: '2026-09-06T10:00:00Z' },
        { fecha: '2026-09-05T10:00:00Z' },
      ] as any[];

      const periodStats: PeriodStats = { totalCompleted: 3, totalDays: 3 };
      const result = computeGlobalStats(
        periodStats,
        habitLogs,
        new Date('2026-09-07T12:00:00Z')
      );

      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });

    it('calculateGlobalStreaks debe deduplicar fechas y ordenar correctamente', () => {
      const datesWithDuplicates = ['2026-09-05', '2026-09-07', '2026-09-06', '2026-09-06', '2026-09-07'];
      const periodStats: PeriodStats = { totalCompleted: 3, totalDays: 3 };

      const result = computeGlobalStats(
        periodStats,
        datesWithDuplicates,
        new Date('2026-09-07T12:00:00Z')
      );

      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });

    it('calculateGlobalStreaks retorna 0 en racha actual si el último registro fue hace más de 1 día', () => {
      const oldDates = ['2026-09-04', '2026-09-03', '2026-09-02'];
      const periodStats: PeriodStats = { totalCompleted: 3, totalDays: 7 };

      const result = computeGlobalStats(
        periodStats,
        oldDates,
        new Date('2026-09-07T12:00:00Z') // Hoy es 7, último fue 4 -> racha actual 0, max 3
      );

      expect(result.currentStreak).toBe(0);
      expect(result.maxStreak).toBe(3);
    });
  });
});
