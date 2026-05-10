import { renderHook } from '@testing-library/react-hooks';
import { useDailyPenaltyJob } from '../useDailyPenaltyJob';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStore } from '../../store/useHabitStore';
import { usePetStore } from '../../store/usePetStore';
import { LogRepository } from '../../storage/LogRepository';
import { format } from 'date-fns';

// Mocks
jest.mock('../../store/useUserStore');
jest.mock('../../store/useHabitStore');
jest.mock('../../store/usePetStore');
jest.mock('../../storage/LogRepository');

describe('useDailyPenaltyJob', () => {
  const todayString = format(new Date(), 'yyyy-MM-dd');
  
  let mockUpdateUser: jest.Mock;
  let mockUpdateHealth: jest.Mock;
  let mockGetMissedHabits: jest.Mock;

  beforeEach(() => {
    mockUpdateUser = jest.fn();
    mockUpdateHealth = jest.fn();
    mockGetMissedHabits = jest.fn();

    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: null },
      updateUser: mockUpdateUser,
    });

    (useHabitStore as any).mockReturnValue({
      habits: [],
    });

    (usePetStore as any).mockReturnValue({
      pet: { vida: 100 },
      updateHealth: mockUpdateHealth,
    });

    (LogRepository as any).prototype.getMissedHabitsForDate = mockGetMissedHabits;
  });

  test('Job should not run if lastPenaltyAppliedDate === today', async () => {
    (useUserStore as any).mockReturnValue({
      user: { id: 'u1', lastPenaltyAppliedDate: todayString },
      updateUser: mockUpdateUser,
    });

    renderHook(() => useDailyPenaltyJob());

    // Esperar a que los efectos asíncronos (si los hubiera detectables) terminen
    // En este caso, simplemente verificamos que no se llamó a nada
    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test('Job should run correctly if lastPenaltyAppliedDate is null (first run)', async () => {
    mockGetMissedHabits.mockResolvedValue([]); // No missed habits

    renderHook(() => useDailyPenaltyJob());

    // El job es asíncrono dentro de useEffect. 
    // Usamos un pequeño delay o waitFor para asegurar ejecución si fuera necesario, 
    // pero aquí simulamos la lógica.
    
    // Verificamos que se intentó buscar hábitos incumplidos y se actualizó la fecha
    // Nota: renderHook ejecuta useEffect. 
    // Para tests reales de hooks con promesas internas se usaría waitForNextUpdate.
    
    // Simulamos paso del tiempo para promesas
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
  });

  test('Job should update date but not apply delta if vida is already 0', async () => {
    (usePetStore as any).mockReturnValue({
      pet: { vida: 0 },
      updateHealth: mockUpdateHealth,
    });

    renderHook(() => useDailyPenaltyJob());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockUpdateUser).toHaveBeenCalledWith({ lastPenaltyAppliedDate: todayString });
    expect(mockGetMissedHabits).not.toHaveBeenCalled();
    expect(mockUpdateHealth).not.toHaveBeenCalled();
  });
});
