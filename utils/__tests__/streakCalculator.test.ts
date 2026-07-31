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

    it('debería mantener la racha en días inactivos para hábitos con días específicos', () => {
      // referenceDate es Martes 2026-04-21T12:00:00Z. Lunes es 20, Miércoles es 22.
      // Hábito activo solo Lunes, Miércoles, Viernes (1, 3, 5)
      const inactiveDaysHabit = { ...dummyHabit, frecuencia: Frequency.DAILY, diasSemana: [1, 3, 5] };
      
      const createLogByDate = (dateString: string): HabitLog => ({
        id: `log-custom`,
        habitId: 'habit-1',
        userId: 'user-1',
        fecha: dateString,
        completado: true,
        timestampRegistro: formatISO(new Date())
      });

      // El usuario hizo el hábito el Lunes (2026-04-20)
      const logs = [createLogByDate('2026-04-20')];
      
      // Hoy es Martes 21 (Día inactivo). La racha DEBE ser 1, no 0.
      expect(calculateCurrentStreak(logs, inactiveDaysHabit, new Date('2026-04-21T12:00:00Z'))).toBe(1);
    });

    it('debería calcular correctamente para hábitos semanales basándose en las ocurrencias (L-X-V)', () => {
      // referenceDate: Martes 2026-04-21T12:00:00Z.
      // Días de ocurrencia: Lunes (1), Miércoles (3), Viernes (5)
      const weeklyHabit = { ...dummyHabit, frecuencia: Frequency.WEEKLY, diasSemana: [1, 3, 5] };
      
      const createLogByDate = (dateString: string): HabitLog => ({
        id: `log-custom`,
        habitId: 'habit-1',
        userId: 'user-1',
        fecha: dateString,
        completado: true,
        timestampRegistro: formatISO(new Date())
      });

      // Se hizo el viernes pasado, y el lunes de esta semana
      const logs = [
        createLogByDate('2026-04-17'), // Viernes pasado (Día programado)
        createLogByDate('2026-04-20')  // Lunes actual (Día programado)
      ];
      
      // Hoy es martes 21 (no programado). La racha debe ser 2 porque no se ha roto en el día programado.
      expect(calculateCurrentStreak(logs, weeklyHabit, referenceDate)).toBe(2);

      // Si le sumamos el miércoles anterior (2026-04-15), la racha es 3
      const logs3 = [
        createLogByDate('2026-04-15'), // Miércoles pasado
        createLogByDate('2026-04-17'), // Viernes pasado
        createLogByDate('2026-04-20')  // Lunes actual
      ];
      expect(calculateCurrentStreak(logs3, weeklyHabit, referenceDate)).toBe(3);

      // Si falta el viernes pasado, la racha se rompe. Solo cuenta el Lunes actual (racha de 1)
      const logsBroken = [
        createLogByDate('2026-04-15'), // Miércoles pasado
        // Falta viernes
        createLogByDate('2026-04-20')  // Lunes actual
      ];
      expect(calculateCurrentStreak(logsBroken, weeklyHabit, referenceDate)).toBe(1);
    });

    it('debería calcular correctamente para hábitos mensuales, respetando final de mes corto', () => {
      // referenceDate es el 1 de Marzo, 2026
      const march1 = new Date('2026-03-01T12:00:00Z');
      
      // Hábito mensual, creado el 31 de Enero. 
      // Por tanto, debe ejecutarse el 31 de Ene, el 28 de Feb y el 31 de Mar.
      const monthlyHabit = { 
        ...dummyHabit, 
        frecuencia: Frequency.MONTHLY, 
        fechaInicio: '2026-01-31T00:00:00Z'
      };

      const createLogByDate = (dateString: string): HabitLog => ({
        id: `log-custom`,
        habitId: 'habit-1',
        userId: 'user-1',
        fecha: dateString,
        completado: true,
        timestampRegistro: formatISO(new Date())
      });

      // El usuario lo hizo el 31 de enero y el 28 de febrero.
      const logs = [
        createLogByDate('2026-01-31'),
        createLogByDate('2026-02-28')
      ];

      // Hoy es 1 de Marzo (Día inactivo). La racha DEBE ser 2, no 0.
      expect(calculateCurrentStreak(logs, monthlyHabit, march1)).toBe(2);

      // Si solo lo hizo el 28 de feb, pero no el 31 de ene, la racha es 1.
      const logsBroken = [
        createLogByDate('2026-02-28')
      ];
      expect(calculateCurrentStreak(logsBroken, monthlyHabit, march1)).toBe(1);
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
