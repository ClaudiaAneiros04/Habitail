import { renderHook } from '@testing-library/react-hooks';
import { useHabitCheckIn } from '../useHabitCheckIn';
import { useLogStore } from '../../store/useLogStore';
import { usePetStore } from '../../store/usePetStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { useStatsStore } from '../../store/useStatsStore';
import { Priority, Category, Frequency, VerificationType } from '../../types';

// Mocks
jest.mock('../../store/useLogStore');
jest.mock('../../store/usePetStore');
jest.mock('../../store/useHabitStore');
jest.mock('../../store/useUserStore');
jest.mock('../../store/useStatsStore', () => ({
  useStatsStore: {
    getState: jest.fn().mockReturnValue({
      clearAll: jest.fn(),
    }),
  },
}));

describe('useHabitCheckIn', () => {
  let mockAddLog: jest.Mock;
  let mockDeleteLog: jest.Mock;
  let mockUpdateHealth: jest.Mock;
  let mockUpdatePoints: jest.Mock;
  let mockAddBadges: jest.Mock;
  let mockClearAll: jest.Mock;

  const mockHabit = (id: string, priority: Priority) => ({
    id,
    userId: 'u1',
    nombre: `Habit ${id}`,
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

  beforeEach(() => {
    jest.clearAllMocks();

    mockAddLog = jest.fn().mockResolvedValue(undefined);
    mockDeleteLog = jest.fn().mockResolvedValue(undefined);
    mockUpdateHealth = jest.fn().mockResolvedValue(undefined);
    mockUpdatePoints = jest.fn().mockResolvedValue(undefined);
    mockAddBadges = jest.fn().mockResolvedValue(undefined);
    mockClearAll = jest.fn();

    // Reset store state
    (useStatsStore.getState as jest.Mock).mockReturnValue({
      clearAll: mockClearAll,
    });

    (useLogStore as any).mockReturnValue({
      logs: [],
      addLog: mockAddLog,
      deleteLog: mockDeleteLog,
    });

    (usePetStore as any).mockReturnValue({
      updateHealth: mockUpdateHealth,
    });

    (useHabitStore as any).mockReturnValue({
      habits: [
        mockHabit('h-essential', Priority.ESSENTIAL),
        mockHabit('h-normal', Priority.NORMAL),
        mockHabit('h-flexible', Priority.FLEXIBLE),
      ],
    });

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', puntos: 100 },
      updatePoints: mockUpdatePoints,
      addBadges: mockAddBadges,
    });
  });

  describe('markComplete', () => {
    test('should add 20 health for ESSENTIAL habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markComplete('h-essential', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(20);
    });

    test('should add 10 health for NORMAL habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markComplete('h-normal', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(10);
    });

    test('should add 5 health for FLEXIBLE habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markComplete('h-flexible', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(5);
    });
  });

  describe('markIncomplete', () => {
    beforeEach(() => {
      // Mock existing log to allow markIncomplete to run
      (useLogStore as any).mockReturnValue({
        logs: [
          {
            id: 'h-essential_2026-05-22',
            habitId: 'h-essential',
            completado: true,
            fecha: '2026-05-22',
          },
          {
            id: 'h-normal_2026-05-22',
            habitId: 'h-normal',
            completado: true,
            fecha: '2026-05-22',
          },
          {
            id: 'h-flexible_2026-05-22',
            habitId: 'h-flexible',
            completado: true,
            fecha: '2026-05-22',
          },
        ],
        addLog: mockAddLog,
        deleteLog: mockDeleteLog,
      });
    });

    test('should subtract 20 health for ESSENTIAL habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markIncomplete('h-essential', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(-20);
    });

    test('should subtract 10 health for NORMAL habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markIncomplete('h-normal', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(-10);
    });

    test('should subtract 5 health for FLEXIBLE habit', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markIncomplete('h-flexible', new Date('2026-05-22'));

      expect(mockUpdateHealth).toHaveBeenCalledWith(-5);
    });
  });
});
