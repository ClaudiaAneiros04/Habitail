import {
  getHabitsForToday,
  isHabitScheduledForDate,
  getExpectedCompletions,
  getExpectedCompletionsForHabits,
} from '../frequencyEngine';
import { Habit, Frequency, Category, Priority, VerificationType } from '../../types';

describe('frequencyEngine', () => {
  const baseHabit: Habit = {
    id: '1',
    userId: 'user1',
    nombre: 'Test Habit',
    categoria: Category.SALUD,
    icono: 'heart',
    colorHex: '#000000',
    frecuencia: Frequency.DAILY,
    diasSemana: [],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2023-10-15T00:00:00Z',
    activo: true,
  };

  describe('getHabitsForToday (retrocompatibilidad)', () => {
    it('1. Debe incluir siempre un hábito DAILY', () => {
      const dailyHabit = { ...baseHabit, frecuencia: Frequency.DAILY };
      const date = new Date('2023-10-20T12:00:00Z');
      const result = getHabitsForToday([dailyHabit], date);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('2. Debe incluir un hábito WEEKLY si el día de la semana coincide (ej: Lunes)', () => {
      const testDate = new Date('2023-10-23T12:00:00Z');
      const dayOfWeek = testDate.getDay(); // 1

      const weeklyHabit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [dayOfWeek],
      };

      const result = getHabitsForToday([weeklyHabit], testDate);
      expect(result).toHaveLength(1);
    });

    it('3. NO debe incluir un hábito WEEKLY si el día de la semana no coincide', () => {
      const testDate = new Date('2023-10-23T12:00:00Z');
      const dayOfWeek = testDate.getDay();

      const weeklyHabit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [(dayOfWeek + 1) % 7],
      };

      const result = getHabitsForToday([weeklyHabit], testDate);
      expect(result).toHaveLength(0);
    });

    it('4. Debe incluir un hábito MONTHLY si el día del mes coincide', () => {
      const testDate = new Date('2023-11-15T12:00:00Z');
      expect(testDate.getDate()).toBe(15);

      const monthlyHabit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2023-10-15T12:00:00Z',
      };

      const result = getHabitsForToday([monthlyHabit], testDate);
      expect(result).toHaveLength(1);
    });

    it('5. Debe devolver una lista vacía si le pasamos una lista vacía', () => {
      const date = new Date('2023-10-20T12:00:00Z');
      const result = getHabitsForToday([], date);
      expect(result).toHaveLength(0);
    });

    it('6. NO debe incluir un hábito inactivo (activo: false)', () => {
      const inactiveHabit = { ...baseHabit, activo: false };
      const date = new Date('2023-10-20T12:00:00Z');
      const result = getHabitsForToday([inactiveHabit], date);
      expect(result).toHaveLength(0);
    });
  });

  describe('getExpectedCompletions - Frecuencia DAILY', () => {
    it('debe devolver el número exacto de días en un rango de 7 días', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
      };
      // 1 al 7 de septiembre = 7 días
      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(7);
    });

    it('debe respetar fechaInicio si el hábito se creó a mitad del rango', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-04', // Creado el 4 de septiembre
      };
      // Rango 1 al 7 de septiembre: solo debe contar 4, 5, 6, 7 = 4 días
      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(4);
    });

    it('debe respetar fechaFin si el hábito fue desactivado antes del fin del rango', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-03', // Finalizado el 3 de septiembre
      };
      // Rango 1 al 7 de septiembre: solo 1, 2, 3 = 3 días
      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(3);
    });

    it('debe devolver 0 si el rango es anterior a fechaInicio', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-10',
      };
      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(0);
    });

    it('debe devolver 0 si el rango es posterior a fechaFin', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-08-01',
        fechaFin: '2026-08-31',
      };
      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(0);
    });
  });

  describe('getExpectedCompletions - Frecuencia WEEKLY', () => {
    it('Ejemplo de usuario: Lunes, Miércoles y Viernes en 1-7 septiembre debe esperar 3', () => {
      // 1 de septiembre de 2026 es Martes (2)
      // 2: Mié (3), 3: Jue (4), 4: Vie (5), 5: Sáb (6), 6: Dom (0), 7: Lun (1)
      // Días que coinciden en 1-7 sep: Mié 2, Vie 4, Lun 7 -> Total 3
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5], // Lun, Mié, Vie
        fechaInicio: '2026-09-01',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(3);
    });

    it('Ejemplo de usuario: Hábito solo los lunes en un mes con 4 lunes debe esperar 4 (no 30 o 31)', () => {
      // Septiembre 2026 tiene 30 días y exactamente 4 lunes: 7, 14, 21, 28
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1], // Solo lunes
        fechaInicio: '2026-09-01',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-30');
      expect(expected).toBe(4);
    });

    it('debe normalizar el día Domingo si viene codificado como 7 en diasSemana', () => {
      // Septiembre 2026: Domingos son 6, 13, 20, 27 -> 4 domingos
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [7], // 7 normalizado a 0 (Domingo)
        fechaInicio: '2026-09-01',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-30');
      expect(expected).toBe(4);
    });

    it('debe respetar fechaInicio dentro de la semana', () => {
      // Hábito Lun, Mié, Vie creado el Jueves 3 de septiembre
      // En la semana del 1 al 7 de septiembre:
      // Mié 2 no cuenta (antes de fechaInicio).
      // Solo cuentan Vie 4 y Lun 7 -> Total 2
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-09-03',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(2);
    });

    it('debe respetar fechaFin dentro de la semana', () => {
      // Hábito Lun, Mié, Vie con fechaFin el Jueves 3 de septiembre
      // Solo cuenta Mié 2 (Vie 4 y Lun 7 son posteriores a fechaFin) -> Total 1
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-03',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-07');
      expect(expected).toBe(1);
    });

    it('debe devolver 0 si diasSemana está vacío', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [],
        fechaInicio: '2026-09-01',
      };

      const expected = getExpectedCompletions(habit, '2026-09-01', '2026-09-30');
      expect(expected).toBe(0);
    });
  });

  describe('getExpectedCompletions - Frecuencia MONTHLY', () => {
    it('hábito mensual creado el 15 debe ocurrir 3 veces en un trimestre', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-15',
      };

      // 1 de enero a 31 de marzo = 15 Ene, 15 Feb, 15 Mar -> 3 veces
      const expected = getExpectedCompletions(habit, '2026-01-01', '2026-03-31');
      expect(expected).toBe(3);
    });

    it('hábito mensual creado el 31 se ajusta en febrero (28 días) y abril (30 días)', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-31',
      };

      // Febrero 2026 (28 días): debe ejecutarse el 28 de febrero -> 1 vez
      const expectedFeb = getExpectedCompletions(habit, '2026-02-01', '2026-02-28');
      expect(expectedFeb).toBe(1);

      // Abril 2026 (30 días): debe ejecutarse el 30 de abril -> 1 vez
      const expectedAbr = getExpectedCompletions(habit, '2026-04-01', '2026-04-30');
      expect(expectedAbr).toBe(1);
    });

    it('no debe contar si el rango del mes termina antes del día del hábito', () => {
      const habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-20',
      };

      // Rango del 1 al 10 de febrero: el día 20 aún no ha llegado -> 0
      const expected = getExpectedCompletions(habit, '2026-02-01', '2026-02-10');
      expect(expected).toBe(0);
    });
  });

  describe('getExpectedCompletions - con historial de programación (scheduleHistory)', () => {
    it('debe calcular los completados esperados combinando múltiples configuraciones históricas', () => {
      const habitWithHistory: Habit = {
        ...baseHabit,
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
        scheduleHistory: [
          {
            id: 'h1',
            habitId: '1',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [1, 3, 5],
            validFrom: '2026-09-01T00:00:00Z',
            validUntil: '2026-09-08T00:00:00Z',
          },
          {
            id: 'h2',
            habitId: '1',
            frecuencia: Frequency.DAILY,
            diasSemana: [],
            validFrom: '2026-09-08T00:00:00Z',
            validUntil: null,
          }
        ]
      };

      // 1 al 7 sept 2026 (config WEEKLY: 1, 3, 5). Días que coinciden: Mié 2, Vie 4, Lun 7 -> Total 3
      const expectedWeek1 = getExpectedCompletions(habitWithHistory, '2026-09-01', '2026-09-07');
      expect(expectedWeek1).toBe(3);

      // 8 al 10 sept 2026 (config DAILY) -> Total 3
      const expectedDaily = getExpectedCompletions(habitWithHistory, '2026-09-08', '2026-09-10');
      expect(expectedDaily).toBe(3);

      // Rango completo 1 al 10 sept -> Total 6
      const expectedTotal = getExpectedCompletions(habitWithHistory, '2026-09-01', '2026-09-10');
      expect(expectedTotal).toBe(6);
    });
  });

  describe('getExpectedCompletionsForHabits (agregación global)', () => {
    it('debe sumar correctamente los esperados de múltiples hábitos con distintas frecuencias', () => {
      const habitDaily: Habit = {
        ...baseHabit,
        id: 'h1',
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-09-01',
      };
      const habitWeekly: Habit = {
        ...baseHabit,
        id: 'h2',
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5], // 3 días en la semana 1-7 sep
        fechaInicio: '2026-09-01',
      };
      const habitMonthly: Habit = {
        ...baseHabit,
        id: 'h3',
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-08-15', // cae el día 15 -> en 1-7 sep es 0
      };

      // Rango 1-7 de septiembre:
      // habitDaily = 7
      // habitWeekly = 3
      // habitMonthly = 0
      // Total esperado = 10
      const totalExpected = getExpectedCompletionsForHabits(
        [habitDaily, habitWeekly, habitMonthly],
        '2026-09-01',
        '2026-09-07'
      );

      expect(totalExpected).toBe(10);
    });
  });
});
