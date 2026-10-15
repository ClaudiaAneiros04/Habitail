import { renderHook, act } from '@testing-library/react-hooks';
import { useStatsStore, buildStatsCacheKey } from '../../store/useStatsStore';
import { useHeatmapStore, buildHeatmapCacheKey } from '../../store/useHeatmapStore';
import { CacheInvalidationService } from '../../services/cacheInvalidationService';
import { useHabitStats } from '../../hooks/useHabitStats';
import { ILogRepository, PeriodStats } from '../../storage/LogRepository';
import { IHabitRepository } from '../../storage/HabitRepository';
import { Habit, Category, Frequency, VerificationType, Priority } from '../../types';
import { format, subDays, addDays } from 'date-fns';

describe('Stats Temporal Cache and User Isolation System', () => {
  let mockHabitRepo: jest.Mocked<IHabitRepository>;
  let mockLogRepo: jest.Mocked<ILogRepository>;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const mockHabitUser1: Habit = {
    id: 'habit-u1',
    userId: 'user-1',
    nombre: 'Ejercicio Diario',
    categoria: Category.SALUD,
    icono: 'fitness',
    colorHex: '#3b82f6',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2026-01-01',
    activo: true,
  };

  const mockHabitUser2: Habit = {
    id: 'habit-u2',
    userId: 'user-2',
    nombre: 'Lectura Nocturna',
    categoria: Category.APRENDIZAJE,
    icono: 'book',
    colorHex: '#10b981',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: VerificationType.BOOLEAN,
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: '2026-01-01',
    activo: true,
  };

  beforeEach(() => {
    CacheInvalidationService.clearAll();

    mockHabitRepo = {
      get: jest.fn().mockResolvedValue([mockHabitUser1]),
      getById: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'habit-u1') return mockHabitUser1;
        if (id === 'habit-u2') return mockHabitUser2;
        return null;
      }),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      delete: jest.fn(),
    };

    mockLogRepo = {
      upsert: jest.fn(),
      deleteById: jest.fn(),
      getByHabit: jest.fn().mockResolvedValue([]),
      getByDate: jest.fn(),
      getLogsForRange: jest.fn(),
      getStatsByPeriod: jest.fn().mockResolvedValue({ totalCompleted: 10, totalDays: 30 } as PeriodStats),
      getGlobalStatsByPeriod: jest.fn().mockResolvedValue({ totalCompleted: 25, totalDays: 30 } as PeriodStats),
      getHeatmapForHabit: jest.fn(),
      getHeatmapGlobal: jest.fn(),
      getLogsForRangeGlobal: jest.fn(),
      getAll: jest.fn(),
      getMissedHabitsForDate: jest.fn(),
      getLogsForRangePaginated: jest.fn(),
      getLogsForRangeGlobalPaginated: jest.fn(),
      getGlobalActiveDates: jest.fn().mockResolvedValue([todayStr, yesterdayStr]),
    };
  });

  // 1. Claves con aislamiento por usuario en periodos semanal, mensual y total
  test('1. Genera claves canónicas segmentadas por usuario y evita mezcla de datos entre sesiones', () => {
    const keyUser1Weekly = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');
    const keyUser2Weekly = buildStatsCacheKey('habit-u1', 'weekly', 'user-2');
    const keyGlobalUser1 = buildStatsCacheKey(undefined, 'monthly', 'user-1');
    const keyGlobalUser2 = buildStatsCacheKey(undefined, 'monthly', 'user-2');

    expect(keyUser1Weekly).toBe('user-1:habit-u1:weekly');
    expect(keyUser2Weekly).toBe('user-2:habit-u1:weekly');
    expect(keyGlobalUser1).toBe('user-1:global:monthly');
    expect(keyGlobalUser2).toBe('user-2:global:monthly');

    useStatsStore.getState().setData(keyUser1Weekly, {
      totalCompleted: 7,
      totalDays: 7,
      expectedCompletions: 7,
      completionRate: 100,
      currentStreak: 7,
      maxStreak: 7,
    }, todayStr);

    useStatsStore.getState().setData(keyUser2Weekly, {
      totalCompleted: 2,
      totalDays: 7,
      expectedCompletions: 7,
      completionRate: 28.5,
      currentStreak: 1,
      maxStreak: 2,
    }, todayStr);

    // Los datos están perfectamente aislados
    expect(useStatsStore.getState().cache[keyUser1Weekly]?.data?.completionRate).toBe(100);
    expect(useStatsStore.getState().cache[keyUser2Weekly]?.data?.completionRate).toBe(28.5);
  });

  // 2. Cambio de usuario e invalidación segmentada
  test('2. CacheInvalidationService.invalidateUserCaches purga solo los datos del usuario especificado', () => {
    const k1 = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');
    const k2 = buildStatsCacheKey('habit-u2', 'weekly', 'user-2');
    const hm1 = buildHeatmapCacheKey('habit-u1', 'user-1');
    const hm2 = buildHeatmapCacheKey('habit-u2', 'user-2');

    useStatsStore.getState().setData(k1, { totalCompleted: 5, totalDays: 7, expectedCompletions: 7, completionRate: 71, currentStreak: 3, maxStreak: 5 }, todayStr);
    useStatsStore.getState().setData(k2, { totalCompleted: 4, totalDays: 7, expectedCompletions: 7, completionRate: 57, currentStreak: 2, maxStreak: 4 }, todayStr);
    useHeatmapStore.getState().setData(hm1, [{ date: todayStr, value: 2 }], todayStr);
    useHeatmapStore.getState().setData(hm2, [{ date: todayStr, value: 1 }], todayStr);

    // Invalida usuario 1
    CacheInvalidationService.invalidateUserCaches('user-1');

    expect(useStatsStore.getState().cache[k1]).toBeUndefined();
    expect(useHeatmapStore.getState().cache[hm1]).toBeUndefined();

    // Usuario 2 permanece intacto
    expect(useStatsStore.getState().cache[k2]).toBeDefined();
    expect(useHeatmapStore.getState().cache[hm2]).toBeDefined();
  });

  // 3. Invalidación al completar, desmarcar, crear o archivar hábitos
  test('3. Invalida correctamente el hábito y la vista global al modificar o completar un hábito', () => {
    const habitKey = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');
    const globalKey = buildStatsCacheKey(undefined, 'weekly', 'user-1');
    const otherHabitKey = buildStatsCacheKey('habit-other', 'weekly', 'user-1');

    useStatsStore.getState().setData(habitKey, { totalCompleted: 5, totalDays: 7, expectedCompletions: 7, completionRate: 71, currentStreak: 3, maxStreak: 5 }, todayStr);
    useStatsStore.getState().setData(globalKey, { totalCompleted: 15, totalDays: 14, expectedCompletions: 14, completionRate: 71, currentStreak: 3, maxStreak: 5 }, todayStr);
    useStatsStore.getState().setData(otherHabitKey, { totalCompleted: 2, totalDays: 7, expectedCompletions: 7, completionRate: 28, currentStreak: 1, maxStreak: 2 }, todayStr);

    // Invalidar 'habit-u1' del usuario 1
    CacheInvalidationService.invalidateHabitCaches('habit-u1', 'user-1');

    expect(useStatsStore.getState().cache[habitKey]).toBeUndefined();
    expect(useStatsStore.getState().cache[globalKey]).toBeUndefined();
    // El otro hábito no se vio afectado
    expect(useStatsStore.getState().cache[otherHabitKey]).toBeDefined();
  });

  // 4. Detección de cambio de día: no sirve datos obsoletos de días anteriores
  test('4. Recalcula estadísticas si los datos en caché corresponden al día anterior', async () => {
    const habitKey = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');

    // Supongamos que había una entrada calculada ayer
    useStatsStore.getState().setData(habitKey, {
      totalCompleted: 3,
      totalDays: 7,
      expectedCompletions: 7,
      completionRate: 42,
      currentStreak: 2,
      maxStreak: 2,
    }, yesterdayStr);

    const { result, waitForNextUpdate } = renderHook(() =>
      useHabitStats({
        habitId: 'habit-u1',
        period: 'weekly',
        userId: 'user-1',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    await waitForNextUpdate();

    // LogRepo debe haber sido consultado porque la entrada era del día anterior (stale-day)
    expect(mockLogRepo.getStatsByPeriod).toHaveBeenCalled();
    // La nueva entrada debe tener calculatedForDate de hoy
    expect(useStatsStore.getState().cache[habitKey]?.calculatedForDate).toBe(todayStr);
  });

  // 5. Evita consultas redundantes a SQLite si los datos están vigentes (hit de caché)
  test('5. No repite consultas a SQLite si el dato ya existe para hoy y no está en loading', async () => {
    const habitKey = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');

    useStatsStore.getState().setData(habitKey, {
      totalCompleted: 10,
      totalDays: 7,
      expectedCompletions: 7,
      completionRate: 100,
      currentStreak: 5,
      maxStreak: 5,
    }, todayStr);

    const { result } = renderHook(() =>
      useHabitStats({
        habitId: 'habit-u1',
        period: 'weekly',
        userId: 'user-1',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    // No debe haber llamado a SQLite
    expect(mockHabitRepo.getById).not.toHaveBeenCalled();
    expect(mockLogRepo.getStatsByPeriod).not.toHaveBeenCalled();
    expect(result.current.completionRate).toBe(100);
  });

  // 6. Varias consultas simultáneas no sobrescriben con respuestas lentas fuera de orden
  test('6. Condiciones de carrera: consulta rápida posterior no es pisada por respuesta tardía anterior', async () => {
    let slowResolve: (v: any) => void = () => {};
    const slowPromise = new Promise<PeriodStats>((res) => {
      slowResolve = res;
    });

    const key1 = buildStatsCacheKey('habit-u1', 'weekly', 'user-1');
    const key2 = buildStatsCacheKey('habit-u1', 'monthly', 'user-1');

    // Primera llamada simula SQLite lento para 'weekly'
    mockLogRepo.getStatsByPeriod.mockImplementationOnce(() => slowPromise);

    const hookWeekly = renderHook(() =>
      useHabitStats({
        habitId: 'habit-u1',
        period: 'weekly',
        userId: 'user-1',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    // Segunda consulta para 'monthly' que resuelve rápido
    mockLogRepo.getStatsByPeriod.mockResolvedValueOnce({ totalCompleted: 20, totalDays: 30 });
    const hookMonthly = renderHook(() =>
      useHabitStats({
        habitId: 'habit-u1',
        period: 'monthly',
        userId: 'user-1',
        _habitRepo: mockHabitRepo,
        _logRepo: mockLogRepo,
      })
    );

    await hookMonthly.waitForNextUpdate();

    expect(useStatsStore.getState().cache[key2]?.data?.totalCompleted).toBe(20);

    // Ahora la promesa lenta de 'weekly' responde después
    slowResolve({ totalCompleted: 5, totalDays: 7 });

    await hookWeekly.waitForNextUpdate();

    // Cada periodo mantiene sus propios resultados sin pisar al otro
    expect(useStatsStore.getState().cache[key1]?.data?.totalCompleted).toBe(5);
    expect(useStatsStore.getState().cache[key2]?.data?.totalCompleted).toBe(20);
  });

  // 7. Poda de memoria LRU cuando se acumulan muchas claves
  test('7. Control de límite de memoria: poda entradas antiguas al sobrepasar el límite', () => {
    for (let i = 0; i < 65; i++) {
      const key = `user-1:habit-${i}:weekly`;
      useStatsStore.getState().setData(key, {
        totalCompleted: i,
        totalDays: 7,
        expectedCompletions: 7,
        completionRate: 50,
        currentStreak: 1,
        maxStreak: 1,
      }, todayStr);
    }

    const currentCache = useStatsStore.getState().cache;
    const cacheKeys = Object.keys(currentCache);
    // El límite establecido es 50
    expect(cacheKeys.length).toBeLessThanOrEqual(50);
  });
});
