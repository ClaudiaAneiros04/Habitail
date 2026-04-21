import { 
  calculateCurrentStreak, 
  calculateMaxStreak, 
  calculateCompletionRate 
} from '../streakCalculator';
import { Habit, HabitLog, Frequency, Category, Priority, VerificationType } from '../../types';
import { startOfDay, subDays, subWeeks, formatISO } from 'date-fns';

describe('streakCalculator', () => {
  const referenceDate = new Date('2026-04-21T12:00:00Z'); // Fecha fija para pruebas

  const dummyHabit: Habit = {
    id: 'habit-1',
    userId: 'user-1',
    nombre: 'Beber Agua',
    categoria: Category.SALUD,
    icono: 'water',
    colorHex: '#00F',
    frecuencia: Frequency.DAILY,
    diasSemana: [1,2,3,4,5,6,7],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.FLEXIBLE,
    fechaInicio: '2026-04-01T00:00:00Z',
    activo: true
  };

  const createLog = (daysBack: number, completed: boolean = true): HabitLog => ({
    id: `log-${daysBack}`,
    habitId: 'habit-1',
    userId: 'user-1',
    fecha: formatISO(subDays(startOfDay(referenceDate), daysBack)),
    completado: completed,
    timestampRegistro: formatISO(new Date())
  });

  describe('calculateCurrentStreak', () => {
    it('debería retornar 0 si no hay logs', () => {
      expect(calculateCurrentStreak([], dummyHabit, referenceDate)).toBe(0);
    });

    it('debería contar una racha normal (días consecutivos, incluyendo hoy)', () => {
      // Hoy, ayer y anteayer
      const logs = [createLog(0), createLog(1), createLog(2)];
      expect(calculateCurrentStreak(logs, dummyHabit, referenceDate)).toBe(3);
    });

    it('debería contar la racha si no lo ha hecho hoy, pero sí ayer (racha activa)', () => {
      // Ayer, anteayer, pero faltó hoy
      const logs = [createLog(1), createLog(2)];
      expect(calculateCurrentStreak(logs, dummyHabit, referenceDate)).toBe(2);
    });

    it('debería retornar 0 si la racha está rota (más de un día de gap)', () => {
      // Hoy, y hace 3 días
      const logs = [createLog(0), createLog(3), createLog(4)];
      // Nota: Si lo hizo hoy la racha es de 1 (se reinicia hoy). 
      // Calculamos racha actual.
      expect(calculateCurrentStreak(logs, dummyHabit, referenceDate)).toBe(1);

      // Ayer y hace 4 días
      const logsBroken = [createLog(2), createLog(3)]; // Ni hoy ni ayer
      expect(calculateCurrentStreak(logsBroken, dummyHabit, referenceDate)).toBe(0);
    });

    it('debería calcular correctamente para hábitos semanales (racha contando semanas)', () => {
      const weeklyHabit = { ...dummyHabit, frecuencia: Frequency.WEEKLY };
      
      const createWeeklyLog = (weeksBack: number): HabitLog => ({
        id: `wlog-${weeksBack}`,
        habitId: 'habit-1',
        userId: 'user-1',
        fecha: formatISO(subWeeks(startOfDay(referenceDate), weeksBack)),
        completado: true,
        timestampRegistro: formatISO(new Date())
      });

      // Semana actual, semana pasada, hace dos semanas
      const logs = [createWeeklyLog(0), createWeeklyLog(1), createWeeklyLog(2)];
      expect(calculateCurrentStreak(logs, weeklyHabit, referenceDate)).toBe(3);

      // No se hizo esta semana, pero sí la pasada y la tras pasada
      const logsOngoing = [createWeeklyLog(1), createWeeklyLog(2)];
      expect(calculateCurrentStreak(logsOngoing, weeklyHabit, referenceDate)).toBe(2);

      // Racha rota: hizo hace 2 semanas pero faltó la 1 y 0
      const logsBroken = [createWeeklyLog(2), createWeeklyLog(3)];
      expect(calculateCurrentStreak(logsBroken, weeklyHabit, referenceDate)).toBe(0);
    });
  });

  describe('calculateMaxStreak', () => {
    it('debería retornar 0 si no hay logs', () => {
      expect(calculateMaxStreak([])).toBe(0);
    });

    it('debería calcular la racha máxima histórica correctamente', () => {
      const logs = [
        createLog(10), createLog(9), // Racha de 2
        createLog(7), createLog(6), createLog(5), createLog(4), // Racha de 4
        createLog(2), createLog(1), createLog(0) // Racha de 3
      ];
      expect(calculateMaxStreak(logs)).toBe(4);
    });
    
    it('no debería contar días duplicados ni no completados', () => {
       const logs = [
        createLog(5), 
        createLog(4), 
        createLog(4, false), // ignorado por false
        createLog(4), // dup
        createLog(3)
      ];
      expect(calculateMaxStreak(logs)).toBe(3); // (días 5, 4, 3)
    });
  });

  describe('calculateCompletionRate', () => {
    it('debería retornar 0 si no hay logs', () => {
      expect(calculateCompletionRate([], 30, referenceDate)).toBe(0);
    });

    it('debería calcular el porcentaje correctamente en 10 días', () => {
      // 5 completados en los últimos 10 días
      const logs = [
        createLog(0), createLog(2), createLog(3), createLog(5), createLog(8)
      ];
      expect(calculateCompletionRate(logs, 10, referenceDate)).toBe(50.0);
    });

    it('debería ignorar los logs fuera del rango de días', () => {
      // Rango de 5 días
      // Incluidos: 0, 1, 2 = 3 logs
      // Excluidos: 6, 7 = 2 logs
      const logs = [
        createLog(0), createLog(1), createLog(2), 
        createLog(6), createLog(7)
      ];
      expect(calculateCompletionRate(logs, 5, referenceDate)).toBe(60.0); // 3 de 5 es 60%
    });
    
    it('debería redondear a 1 decimal', () => {
      // 1 de 3 = 33.333% -> 33.3
      const logs = [createLog(1)];
      expect(calculateCompletionRate(logs, 3, referenceDate)).toBe(33.3);
    });
  });
});
