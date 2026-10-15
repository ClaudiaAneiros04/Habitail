import { renderHook, act } from '@testing-library/react-native';
import { useHabitCheckIn } from '../useHabitCheckIn';
import { useLogStore } from '../../store/useLogStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { habitCompletionService } from '../../services/HabitCompletionService';
import { Priority, Category, Frequency, VerificationType } from '../../types';

// Mocks
jest.mock('../../store/useLogStore');
jest.mock('../../store/useHabitStore');
jest.mock('../../store/useUserStore');
jest.mock('../../services/HabitCompletionService', () => ({
  habitCompletionService: {
    completeHabit: jest.fn(),
    uncompleteHabit: jest.fn(),
  },
}));

describe('useHabitCheckIn (UI Wrapper)', () => {
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T12:00:00Z'));

    (useLogStore as any).mockReturnValue({
      logs: [],
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
    });

    (habitCompletionService.completeHabit as jest.Mock).mockResolvedValue({
      success: true,
      logId: 'log-1',
      eventKey: 'event-1',
      alreadyCompleted: false,
      healthDelta: 20,
      pointsDelta: 20,
      isHistorical: false,
    });

    (habitCompletionService.uncompleteHabit as jest.Mock).mockResolvedValue({
      success: true,
      logId: 'log-1',
      eventKey: 'event-1',
      alreadyUncompleted: false,
      healthDeltaReverted: 20,
      pointsDeltaReverted: 20,
    });
  });

  describe('markComplete delegation', () => {
    test('should delegate to habitCompletionService with UI source', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markComplete('h-essential', new Date('2026-05-22'));

      expect(habitCompletionService.completeHabit).toHaveBeenCalledWith({
        userId: 'u1',
        habitId: 'h-essential',
        logicalDate: '2026-05-22',
        source: 'UI',
      });
    });

    test('should reject completing future date early without calling service', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      const res = await result.current.markComplete('h-essential', '2026-05-23');

      expect(res.shouldLaunchConfetti).toBe(false);
      expect(habitCompletionService.completeHabit).not.toHaveBeenCalled();
    });

    test('should calculate shouldLaunchConfetti when all daily tasks are done', async () => {
      // Setup: 2 habits, 1 already completed
      (useHabitStore as any).mockReturnValue({
        habits: [mockHabit('h-1', Priority.NORMAL), mockHabit('h-2', Priority.NORMAL)],
      });

      (useLogStore as any).mockReturnValue({
        logs: [{ habitId: 'h-1', fecha: '2026-05-22', completado: true }],
      });

      const { result } = renderHook(() => useHabitCheckIn());
      const res = await result.current.markComplete('h-2', '2026-05-22');

      expect(res.shouldLaunchConfetti).toBe(true);
    });

    test('should NOT launch confetti if service returns alreadyCompleted', async () => {
      (habitCompletionService.completeHabit as jest.Mock).mockResolvedValueOnce({
        success: true,
        logId: 'log-1',
        eventKey: 'event-1',
        alreadyCompleted: true,
        healthDelta: 0,
        pointsDelta: 0,
        isHistorical: false,
      });

      const { result } = renderHook(() => useHabitCheckIn());
      const res = await result.current.markComplete('h-essential', '2026-05-22');

      expect(res.shouldLaunchConfetti).toBe(false);
    });
  });

  describe('markIncomplete delegation', () => {
    test('should delegate to habitCompletionService with UI source', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markIncomplete('h-essential', new Date('2026-05-22'));

      expect(habitCompletionService.uncompleteHabit).toHaveBeenCalledWith({
        userId: 'u1',
        habitId: 'h-essential',
        logicalDate: '2026-05-22',
        source: 'UI',
      });
    });

    test('should reject uncompleting future date early without calling service', async () => {
      const { result } = renderHook(() => useHabitCheckIn());
      await result.current.markIncomplete('h-essential', '2026-05-23');

      expect(habitCompletionService.uncompleteHabit).not.toHaveBeenCalled();
    });
  });

  describe('UI helpers', () => {
    test('getStatusForDay reflects store logs', () => {
      (useLogStore as any).mockReturnValue({
        logs: [{ habitId: 'h-essential', fecha: '2026-05-22', completado: true }],
      });

      const { result } = renderHook(() => useHabitCheckIn());
      expect(result.current.getStatusForDay('h-essential', '2026-05-22')).toBe(true);
      expect(result.current.getStatusForDay('h-essential', '2026-05-21')).toBe(false);
      expect(result.current.getStatusForDay('h-normal', '2026-05-22')).toBe(false);
    });

    test('getDailyProgress calculates ratio of completed habits', () => {
      (useHabitStore as any).mockReturnValue({
        habits: [mockHabit('h-1', Priority.NORMAL), mockHabit('h-2', Priority.NORMAL)],
      });

      (useLogStore as any).mockReturnValue({
        logs: [{ habitId: 'h-1', fecha: '2026-05-22', completado: true }],
      });

      const { result } = renderHook(() => useHabitCheckIn());
      expect(result.current.getDailyProgress('2026-05-22')).toBe(0.5);
    });

    test('triggerBounce triggers spring animation sequence', () => {
      const { result } = renderHook(() => useHabitCheckIn());
      expect(() => {
        act(() => {
          result.current.triggerBounce();
        });
      }).not.toThrow();
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });
});
