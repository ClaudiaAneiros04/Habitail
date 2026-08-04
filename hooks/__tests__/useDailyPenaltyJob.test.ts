import { renderHook } from '@testing-library/react-hooks';
import { useDailyPenaltyJob } from '../useDailyPenaltyJob';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStore } from '../../store/useHabitStore';
import { usePetStore } from '../../store/usePetStore';
import { LogRepository } from '../../storage/LogRepository';
import { format, subDays } from 'date-fns';
import { calculatePenaltyDelta } from '../../utils/petLogic';

// Mocks
jest.mock('../../store/useUserStore');
jest.mock('../../store/useHabitStore');
jest.mock('../../store/usePetStore');
jest.mock('../../utils/petLogic');

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

describe('useDailyPenaltyJob', () => {
  const todayString = format(new Date(), 'yyyy-MM-dd');
  
  let mockUpdateUser: jest.Mock;
  let mockUpdateHealth: jest.Mock;
  let mockGetMissedHabits: jest.Mock;

  beforeEach(() => {
    mockUpdateUser = jest.fn();
    mockUpdateHealth = jest.fn();
    (calculatePenaltyDelta as jest.Mock).mockReturnValue(-10);

    // Obtener la instancia del mock creada a nivel de módulo y resetear el spy
    const mockInstance = (LogRepository as any).mock.results[0]?.value || 
                         (LogRepository as any).mock.instances[0];
                         
    mockGetMissedHabits = mockInstance?.getMissedHabitsForDate || jest.fn().mockResolvedValue([]);
    mockGetMissedHabits.mockReset();
    mockGetMissedHabits.mockResolvedValue([]); // Valor por defecto

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: null },
      updateUser: mockUpdateUser,
    });

    (useHabitStore as any).mockReturnValue({
      habits: [{ id: 'h1', activo: true }],
    });

    (usePetStore as any).mockReturnValue({
      pet: { vida: 100 },
      updateHealth: mockUpdateHealth,
    });
  });

  test('Job should not run if lastPenaltyAppliedDate === today', async () => {
    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: todayString },
      updateUser: mockUpdateUser,
    });

    renderHook(() => useDailyPenaltyJob());

    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('Job should run correctly if lastPenaltyAppliedDate is null (first run)', async () => {
    mockGetMissedHabits.mockResolvedValue([]); // No missed habits

    renderHook(() => useDailyPenaltyJob());

    await new Promise(resolve => setTimeout(resolve, 0));

    // First run sets today as lastPenaltyAppliedDate to avoid penalizing right after installation
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
    expect(mockGetMissedHabits).not.toHaveBeenCalled();
  });

  test('Job should process multiple missing days correctly', async () => {
    const lastDate = format(subDays(new Date(), 3), 'yyyy-MM-dd'); // 3 days ago

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: lastDate },
      updateUser: mockUpdateUser,
    });

    mockGetMissedHabits.mockResolvedValue([{ id: 'h1' }]); // Always misses h1

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should process 3 days (subDays(2), subDays(1))
    // Wait, lastDate is 3 days ago. We process from lastDate + 1 to yesterday (inclusive).
    // So 2 days total.
    expect(mockGetMissedHabits).toHaveBeenCalledTimes(2);
    
    // Total delta should be -20 (2 days * -10)
    expect(mockUpdateHealth).toHaveBeenCalledWith(-20);
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
  });

  test('Job should update date but not apply delta if there are no missed habits', async () => {
    const lastDate = format(subDays(new Date(), 1), 'yyyy-MM-dd'); // Yesterday

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: lastDate },
      updateUser: mockUpdateUser,
    });

    mockGetMissedHabits.mockResolvedValue([]); // No missed habits

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGetMissedHabits).toHaveBeenCalledTimes(0); // Since we process up to yesterday, wait, lastProcessed = yesterday, so currentDate = today. Loop is while (current < today), so 0 iterations.
    
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
    expect(mockUpdateHealth).not.toHaveBeenCalled();
  });

  test('Semaphore prevents double execution when rendered concurrently at 00:01', async () => {
    mockGetMissedHabits.mockResolvedValue([]);

    const { rerender } = renderHook(() => useDailyPenaltyJob());
    rerender();
    
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
  });
});
