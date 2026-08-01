import { renderHook } from '@testing-library/react-hooks';
import { useHabitStats } from '../useHabitStats';
import { ILogRepository, PeriodStats } from '../../storage/LogRepository';
import { IHabitRepository } from '../../storage/HabitRepository';
import { Habit, HabitLog, Category, Frequency, VerificationType, Priority } from '../../types';
import { useStatsStore } from '../../store/useStatsStore';
import { format, subDays } from 'date-fns';

describe('useHabitStats Hook', () => {
  let mockHabitRepo: jest.Mocked<IHabitRepository>;
  let mockLogRepo: jest.Mocked<ILogRepository>;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const mockHabit: Habit = {
    id: 'habit-123',
    userId: 'user-456',
    nombre: 'Hábito de prueba',
    categoria: Category.SALUD,
    icono: 'heart',
    colorHex: '#ff0000',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2026-05-01',
    activo: true,
  };

  beforeEach(() => {
    // Limpiar el cache del store de Zustand antes de cada test
    useStatsStore.getState().clearAll();

    mockHabitRepo = {
      get: jest.fn(),
      getById: jest.fn().mockResolvedValue(mockHabit),
      save: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      delete: jest.fn(),
    };

    mockLogRepo = {
      save: jest.fn(),
      deleteById: jest.fn(),
      getByHabit: jest.fn().mockResolvedValue([]),
      getByDate: jest.fn(),
      getLogsForRange: jest.fn(),
      getStatsByPeriod: jest.fn().mockResolvedValue({ totalCompleted: 5, totalDays: 30 } as PeriodStats),
      getGlobalStatsByPeriod: jest.fn().mockResolvedValue({ totalCompleted: 15, totalDays: 30 } as PeriodStats),
      getHeatmapForHabit: jest.fn(),
      getHeatmapGlobal: jest.fn(),
      getLogsForRangeGlobal: jest.fn(),
      getAll: jest.fn(),
      getMissedHabitsForDate: jest.fn(),
      getLogsForRangePaginated: jest.fn(),
      getLogsForRangeGlobalPaginated: jest.fn(),
      getGlobalActiveDates: jest.fn().mockResolvedValue([]),
    };
  });

  test('Debería cargar estadísticas usando el repositorio para un hábito individual', async () => {
    // Simulamos un log completado reciente (hoy)
    const mockLogs: HabitLog[] = [
      {
        id: 'log-1',
        habitId: 'habit-123',
        userId: 'user-456',
        fecha: todayStr,
        completado: true,
        timestampRegistro: `${todayStr}T10:00:00Z`,
      },
    ];

    mockLogRepo.getByHabit.mockResolvedValueOnce(mockLogs);

    const { result, waitForNextUpdate } = renderHook(() =>
      useHabitStats({
        habitId: 'habit-123',
        period: 'monthly',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    await waitForNextUpdate();

    expect(mockHabitRepo.getById).toHaveBeenCalledWith('habit-123');
    expect(mockLogRepo.getByHabit).toHaveBeenCalledWith('habit-123');

    expect(result.current.currentStreak).toBe(1);
    expect(result.current.totalCompleted).toBe(5);
  });

  test('Debería cargar estadísticas globales usando getGlobalActiveDates', async () => {
    mockHabitRepo.get.mockResolvedValueOnce([mockHabit]);
    
    // El usuario tiene actividad hoy y ayer
    mockLogRepo.getGlobalActiveDates.mockResolvedValueOnce([todayStr, yesterdayStr]);

    const { result, waitForNextUpdate } = renderHook(() =>
      useHabitStats({
        habitId: undefined, // Global
        userId: 'user-456',
        period: 'monthly',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    await waitForNextUpdate();

    expect(mockHabitRepo.get).toHaveBeenCalled();
    expect(mockLogRepo.getGlobalActiveDates).toHaveBeenCalledWith('user-456');

    expect(result.current.currentStreak).toBe(2);
    expect(result.current.totalCompleted).toBe(15);
  });
});
