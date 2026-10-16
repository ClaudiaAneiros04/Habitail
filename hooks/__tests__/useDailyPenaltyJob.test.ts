import { renderHook } from '@testing-library/react-native';
import { useDailyPenaltyJob } from '../useDailyPenaltyJob';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStore } from '../../store/useHabitStore';
import { usePetStore } from '../../store/usePetStore';
import { LogRepository } from '../../storage/LogRepository';
import { format, subDays } from 'date-fns';
import { calculatePenaltyDelta } from '../../utils/petLogic';
import { PetState } from '../../types';

// Mocks
jest.mock('../../store/useUserStore');
jest.mock('../../store/useHabitStore');
jest.mock('../../store/usePetStore');
jest.mock('../../utils/petLogic', () => {
  const actual = jest.requireActual('../../utils/petLogic');
  return {
    ...actual,
    calculatePenaltyDelta: jest.fn().mockReturnValue(-10),
  };
});

// Mock manual de LogRepository para interceptar el constructor a nivel de módulo
jest.mock('../../storage/LogRepository', () => {
  const mockGetMissed = jest.fn().mockResolvedValue([]);
  return {
    LogRepository: jest.fn().mockImplementation(() => {
      return {
        getMissedHabitsForDate: mockGetMissed,
      };
    }),
  };
});

// Mock de base de datos para no requerir SQLite nativo en tests unitarios del hook
jest.mock('../../storage/database', () => ({
  getDb: jest
    .fn()
    .mockRejectedValue(new Error('Unit test environment: fallback to store updateHealth')),
}));

describe('useDailyPenaltyJob - Reglas de Dominio y Resiliencia', () => {
  const todayString = format(new Date(), 'yyyy-MM-dd');

  let mockUpdateUser: jest.Mock;
  let mockUpdateHealth: jest.Mock;
  let mockGetMissedHabits: jest.Mock;

  beforeEach(() => {
    mockUpdateUser = jest.fn();
    mockUpdateHealth = jest.fn();
    (calculatePenaltyDelta as jest.Mock).mockReturnValue(-10);

    const mockInstance =
      (LogRepository as any).mock.results[0]?.value || (LogRepository as any).mock.instances[0];

    mockGetMissedHabits = mockInstance?.getMissedHabitsForDate || jest.fn().mockResolvedValue([]);
    mockGetMissedHabits.mockReset();
    mockGetMissedHabits.mockResolvedValue([]);

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: null, lastOpenedAt: Date.now() },
      updateUser: mockUpdateUser,
    });

    (useHabitStore as any).mockReturnValue({
      habits: [
        {
          id: 'h1',
          activo: true,
          diasSemana: [1, 2, 3, 4, 5],
          fechaInicio: '2026-01-01',
        },
      ],
    });

    (usePetStore as any).mockReturnValue({
      pet: { vida: 100, estadoActual: PetState.HAPPY },
      updateHealth: mockUpdateHealth,
    });
  });

  test('El job no se ejecuta si lastPenaltyAppliedDate === yesterday', async () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: yesterday },
      updateUser: mockUpdateUser,
    });

    renderHook(() => useDailyPenaltyJob());

    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('Primera ejecución (lastPenaltyAppliedDate es null y registrado hoy): registra yesterday y no penaliza', async () => {
    mockGetMissedHabits.mockResolvedValue([]);
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: null, fechaRegistro: todayString, lastOpenedAt: Date.now() },
      updateUser: mockUpdateUser,
    });

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: yesterday });
    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
  });

  test('Itera y penaliza cada día de ausencia no completado desde la última fecha procesada', async () => {
    // Usuario no abrió la app durante 2 días de ausencia (lastPenaltyAppliedDate hace 2 días)
    const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    (useUserStore as any).mockReturnValue({
      user: {
        id: 'u1',
        lastPenaltyAppliedDate: twoDaysAgo,
        fechaRegistro: twoDaysAgo,
        lastOpenedAt: Date.now() - 48 * 60 * 60 * 1000,
      },
      updateUser: mockUpdateUser,
    });

    mockGetMissedHabits.mockResolvedValue([{ id: 'h1' }]);

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 10));

    // Debe consultar el día cerrado pendiente (yesterday)
    expect(mockGetMissedHabits).toHaveBeenCalledTimes(1);
    expect(mockGetMissedHabits).toHaveBeenCalledWith(yesterday, expect.any(Array));

    // Aplica delta de salud (-10)
    expect(mockUpdateHealth).toHaveBeenCalledWith(-10);
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: yesterday });
  });

  test('Itera múltiples días ausentes (ej. 3 días) acumulando penalizaciones por cada día', async () => {
    // Usuario ausente desde hace 3 días
    const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');
    const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    (useUserStore as any).mockReturnValue({
      user: {
        id: 'u1',
        lastPenaltyAppliedDate: threeDaysAgo,
        fechaRegistro: threeDaysAgo,
        lastOpenedAt: Date.now() - 72 * 60 * 60 * 1000,
      },
      updateUser: mockUpdateUser,
    });

    mockGetMissedHabits.mockResolvedValue([{ id: 'h1' }]);

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 10));

    // Debe evaluar 2 días cerrados pendientes: twoDaysAgo y yesterday
    expect(mockGetMissedHabits).toHaveBeenCalledTimes(2);
    expect(mockGetMissedHabits).toHaveBeenNthCalledWith(1, twoDaysAgo, expect.any(Array));
    expect(mockGetMissedHabits).toHaveBeenNthCalledWith(2, yesterday, expect.any(Array));

    // Se aplicaron las deducciones correspondientes (-10 por cada día = 2 veces)
    expect(mockUpdateHealth).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: yesterday });
  });

  test('Mascota en estado terminal (vida = 0 / ABSENT): no aplica penalizaciones', async () => {
    const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: twoDaysAgo, lastOpenedAt: Date.now() },
      updateUser: mockUpdateUser,
    });

    (usePetStore as any).mockReturnValue({
      pet: { vida: 0, estadoActual: PetState.ABSENT },
      updateHealth: mockUpdateHealth,
    });

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: yesterday });
  });

  test('Semáforo de ejecución previene doble procesamiento concurrente', async () => {
    mockGetMissedHabits.mockResolvedValue([]);
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const { rerender } = renderHook(() => useDailyPenaltyJob());
    rerender(undefined);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: yesterday });
  });
});
