import { getHabitsForToday } from './frequencyEngine';
import { Habit, Frequency, Category, Priority, VerificationType } from '../types';

describe('frequencyEngine - getHabitsForToday', () => {
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

  it('1. Debe incluir siempre un hábito DAILY', () => {
    const dailyHabit = { ...baseHabit, frecuencia: Frequency.DAILY };
    const date = new Date('2023-10-20T12:00:00Z'); // Cualquier fecha
    const result = getHabitsForToday([dailyHabit], date);
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('2. Debe incluir un hábito WEEKLY si el día de la semana coincide (ej: Lunes)', () => {
    // 2023-10-23 es Lunes (getDay() === 1 en localtime si es UTC, tener cuidado con la zona horaria)
    // Para ser seguros con Jest, usemos getDay directamente controlando el locale o valores
    const testDate = new Date('2023-10-23T12:00:00Z'); 
    const dayOfWeek = testDate.getDay(); // 1

    const weeklyHabit = { 
      ...baseHabit, 
      frecuencia: Frequency.WEEKLY, 
      diasSemana: [dayOfWeek] 
    };
    
    const result = getHabitsForToday([weeklyHabit], testDate);
    
    expect(result).toHaveLength(1);
  });

  it('3. NO debe incluir un hábito WEEKLY si el día de la semana no coincide', () => {
    const testDate = new Date('2023-10-23T12:00:00Z'); 
    const dayOfWeek = testDate.getDay(); // 1 (Lunes)

    const weeklyHabit = { 
      ...baseHabit, 
      frecuencia: Frequency.WEEKLY, 
      diasSemana: [(dayOfWeek + 1) % 7] // Martes, u otro diferente
    };
    
    const result = getHabitsForToday([weeklyHabit], testDate);
    
    expect(result).toHaveLength(0);
  });

  it('4. Debe incluir un hábito MONTHLY si el día del mes coincide', () => {
    // mes: 15 de octubre
    const testDate = new Date('2023-11-15T12:00:00Z'); 
    // Aseguramos de que el getDate de la prueba sea exactamente el que pusimos en fechaInicio (15)
    expect(testDate.getDate()).toBe(15);

    const monthlyHabit = { 
      ...baseHabit, 
      frecuencia: Frequency.MONTHLY,
      fechaInicio: '2023-10-15T12:00:00Z' // getDate() === 15 a nivel local puede variar, pero con T12 garantizamos el 15.
    };
    
    const result = getHabitsForToday([monthlyHabit], testDate);
    
    expect(result).toHaveLength(1);
  });

  it('5. Debe devolver una lista vacía si le pasamos una lista vacía', () => {
    const date = new Date('2023-10-20T12:00:00Z');
    const result = getHabitsForToday([], date);
    
    expect(result).toHaveLength(0);
  });
});
