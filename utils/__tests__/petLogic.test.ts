import {
  calculatePenaltyDelta,
  applyHealthDelta,
  getHealthDeltaForPriority,
  clampHealth,
  getPetState,
  calculateNewHealth,
  calculateXpProgress,
  isPetTerminal,
  isTerminalPetState,
} from '../petLogic';
import { Priority, Habit, Category, Frequency, VerificationType, PetState } from '../../types';

describe('petLogic - Prioridades y Deltas de Salud', () => {
  test('ESSENTIAL otorga exactamente 20 HP', () => {
    expect(getHealthDeltaForPriority(Priority.ESSENTIAL)).toBe(20);
    expect(getHealthDeltaForPriority('ESSENTIAL')).toBe(20);
  });

  test('NORMAL otorga exactamente 10 HP', () => {
    expect(getHealthDeltaForPriority(Priority.NORMAL)).toBe(10);
    expect(getHealthDeltaForPriority('NORMAL')).toBe(10);
  });

  test('FLEXIBLE otorga exactamente 5 HP', () => {
    expect(getHealthDeltaForPriority(Priority.FLEXIBLE)).toBe(5);
    expect(getHealthDeltaForPriority('FLEXIBLE')).toBe(5);
  });

  test('Prioridad desconocida o indefinida usa fallback', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getHealthDeltaForPriority(undefined, 10)).toBe(10);
    expect(getHealthDeltaForPriority('UNKNOWN', 0)).toBe(0);
    spy.mockRestore();
  });
});

describe('petLogic - Límites de HP y Clamp', () => {
  test('Clamp superior: 100 + 20 = 100', () => {
    expect(clampHealth(100 + 20)).toBe(100);
    expect(calculateNewHealth(100, 20).nuevaVida).toBe(100);
    expect(calculateNewHealth(90, 20).nuevaVida).toBe(100);
  });

  test('Clamp inferior: 5 - 20 = 0 (transición a ABSENT)', () => {
    expect(clampHealth(5 - 20)).toBe(0);
    const result = calculateNewHealth(5, -20);
    expect(result.nuevaVida).toBe(0);
    expect(result.nuevoEstado).toBe(PetState.ABSENT);
  });

  test('Valores no enteros o atípicos son normalizados por clampHealth', () => {
    expect(clampHealth(500)).toBe(100);
    expect(clampHealth(-30)).toBe(0);
    expect(clampHealth(NaN)).toBe(0);
    expect(clampHealth(75.6)).toBe(76);
  });
});

describe('petLogic - Mapeo Estricto de Estados según HP', () => {
  test('0 HP -> PetState.ABSENT (Marcha definitiva)', () => {
    expect(getPetState(0)).toBe(PetState.ABSENT);
  });

  test('1-25 HP -> PetState.SAD', () => {
    expect(getPetState(1)).toBe(PetState.SAD);
    expect(getPetState(15)).toBe(PetState.SAD);
    expect(getPetState(25)).toBe(PetState.SAD);
  });

  test('26-50 HP -> PetState.CONFUSED', () => {
    expect(getPetState(26)).toBe(PetState.CONFUSED);
    expect(getPetState(40)).toBe(PetState.CONFUSED);
    expect(getPetState(50)).toBe(PetState.CONFUSED);
  });

  test('51-75 HP -> PetState.CHEERING', () => {
    expect(getPetState(51)).toBe(PetState.CHEERING);
    expect(getPetState(65)).toBe(PetState.CHEERING);
    expect(getPetState(75)).toBe(PetState.CHEERING);
  });

  test('76-100 HP -> PetState.HAPPY', () => {
    expect(getPetState(76)).toBe(PetState.HAPPY);
    expect(getPetState(90)).toBe(PetState.HAPPY);
    expect(getPetState(100)).toBe(PetState.HAPPY);
  });

  test('Valores fuera de rango [0, 100] o no enteros lanzan Error descriptivo', () => {
    expect(() => getPetState(-1)).toThrow('El valor de vida debe ser un número entero entre 0 y 100');
    expect(() => getPetState(101)).toThrow('El valor de vida debe ser un número entero entre 0 y 100');
    expect(() => getPetState(50.5)).toThrow('El valor de vida debe ser un número entero entre 0 y 100');
  });
});

describe('petLogic - Irreversibilidad de Estado Terminal (Marcha Irreversible)', () => {
  test('Estando en vida = 0 (ABSENT), un check-in positivo (+5, +10, +20) mantiene vida = 0 y ABSENT', () => {
    // Intento con +20 (Esencial)
    const result20 = calculateNewHealth(0, 20, PetState.ABSENT);
    expect(result20.nuevaVida).toBe(0);
    expect(result20.nuevoEstado).toBe(PetState.ABSENT);
    expect(result20.wasTerminal).toBe(true);

    // Intento con +10 (Normal)
    const result10 = calculateNewHealth(0, 10, PetState.ABSENT);
    expect(result10.nuevaVida).toBe(0);
    expect(result10.nuevoEstado).toBe(PetState.ABSENT);

    // Intento con +5 (Flexible)
    const result5 = calculateNewHealth(0, 5, PetState.ABSENT);
    expect(result5.nuevaVida).toBe(0);
    expect(result5.nuevoEstado).toBe(PetState.ABSENT);
  });

  test('applyHealthDelta con vida = 0 devuelve siempre 0 ignorando hábitos completados', () => {
    const habitos = [
      { id: 'h1', prioridad: Priority.ESSENTIAL, completado: true },
      { id: 'h2', prioridad: Priority.NORMAL, completado: true },
    ];
    expect(applyHealthDelta(0, habitos)).toBe(0);
  });

  test('isPetTerminal y isTerminalPetState detectan estados terminales', () => {
    expect(isTerminalPetState(PetState.ABSENT)).toBe(true);
    expect(isTerminalPetState('DECEASED')).toBe(true);
    expect(isTerminalPetState(PetState.HAPPY)).toBe(false);

    expect(isPetTerminal({ vida: 0, estadoActual: PetState.ABSENT })).toBe(true);
    expect(isPetTerminal({ vida: 0, estadoActual: PetState.HAPPY })).toBe(true);
    expect(isPetTerminal({ vida: 50, estadoActual: PetState.CONFUSED })).toBe(false);
  });
});

describe('petLogic - Progresión de XP y Nivel (Corrección Bug Reseteo)', () => {
  test('Subida de nivel simple: conserva el excedente de XP en lugar de resetear a 0', () => {
    // Nivel 1, XP 80, requiere 100 para Nivel 2. Gana 30 XP -> Total 110 XP.
    // Pasa a Nivel 2 con 10 XP restantes (110 - 100 = 10) y siguiente corte en 150.
    const progress = calculateXpProgress(1, 80, 100, 30);
    expect(progress.nivel).toBe(2);
    expect(progress.xp).toBe(10); // Excedente conservado
    expect(progress.xpParaSiguienteNivel).toBe(150);
  });

  test('Subida múltiple de niveles consecutivos por gran cantidad de XP', () => {
    // Nivel 1, XP 0, 100 requeridos. Gana 300 XP.
    // Nivel 1 -> 2: gasta 100 XP, quedan 200 XP, nuevo corte = 150.
    // Nivel 2 -> 3: gasta 150 XP, quedan 50 XP, nuevo corte = 225 (Math.floor(150 * 1.5)).
    const progress = calculateXpProgress(1, 0, 100, 300);
    expect(progress.nivel).toBe(3);
    expect(progress.xp).toBe(50);
    expect(progress.xpParaSiguienteNivel).toBe(225);
  });

  test('Ganancia de XP sin superar el umbral conserva acumulación exacta', () => {
    const progress = calculateXpProgress(1, 20, 100, 30);
    expect(progress.nivel).toBe(1);
    expect(progress.xp).toBe(50);
    expect(progress.xpParaSiguienteNivel).toBe(100);
  });
});

describe('petLogic - Cálculo de Penalizaciones Diarias', () => {
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

  test('calculatePenaltyDelta([]) debe ser 0', () => {
    expect(calculatePenaltyDelta([])).toBe(0);
  });

  test('calculatePenaltyDelta suma correctamente penalizaciones de distintas prioridades', () => {
    const missedHabits = [
      mockHabit(Priority.ESSENTIAL), // -20
      mockHabit(Priority.NORMAL),    // -10
      mockHabit(Priority.FLEXIBLE),  // -5
    ];
    expect(calculatePenaltyDelta(missedHabits)).toBe(-35);
  });
});
