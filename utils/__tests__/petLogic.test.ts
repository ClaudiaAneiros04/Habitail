import { calculatePenaltyDelta, applyHealthDelta } from '../petLogic';
import { Priority, Habit, Category, Frequency, VerificationType } from '../../types';

describe('petLogic - Penalty Calculation', () => {
  const mockHabit = (priority: Priority): Habit => ({
    id: 'h1',
    userId: 'u1',
    nombre: 'Habit 1',
    categoria: Category.SALUD,
    icono: 'heart',
    colorHex: '#ff0000',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: priority,
    fechaInicio: '2026-01-01',
    activo: true,
  });

  test('calculatePenaltyDelta([]) should return 0', () => {
    expect(calculatePenaltyDelta([])).toBe(0);
  });

  test('calculatePenaltyDelta with mixed priorities should return correct negative sum', () => {
    const missedHabits = [
      mockHabit(Priority.ESSENTIAL), // -20
      mockHabit(Priority.NORMAL),    // -10
      mockHabit(Priority.FLEXIBLE),  // -5
    ];
    expect(calculatePenaltyDelta(missedHabits)).toBe(-35);
  });

  test('calculatePenaltyDelta with all essential missed should return minimum expected value', () => {
    const missedHabits = [
      mockHabit(Priority.ESSENTIAL),
      mockHabit(Priority.ESSENTIAL),
    ];
    expect(calculatePenaltyDelta(missedHabits)).toBe(-40);
  });

  test('clamp should be applied correctly in applyHealthDelta when delta exceeds current life', () => {
    // Caso: Vida 10, Delta -20 -> Debería ser 0, no -10
    const vidaActual = 10;
    const habitosMissed = [
      { id: 'h1', prioridad: Priority.ESSENTIAL, completado: false }
    ];
    expect(applyHealthDelta(vidaActual, habitosMissed)).toBe(0);
  });

  test('clamp should be applied correctly in applyHealthDelta when delta exceeds maximum life', () => {
    // Caso: Vida 90, Delta +20 -> Debería ser 100, no 110
    const vidaActual = 90;
    const habitosCompleted = [
      { id: 'h1', prioridad: Priority.ESSENTIAL, completado: true }
    ];
    expect(applyHealthDelta(vidaActual, habitosCompleted)).toBe(100);
  });
});
