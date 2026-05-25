import { useLogStore } from '../useLogStore';
import { LogRepository } from '../../storage/LogRepository';
import { HabitLog } from '../../types';

describe('useLogStore', () => {
  let saveSpy: jest.SpyInstance;
  let deleteByIdSpy: jest.SpyInstance;
  let getByDateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    useLogStore.setState({ logs: [] });

    // Spy on prototype methods to intercept calls correctly regardless of construction timing
    saveSpy = jest.spyOn(LogRepository.prototype, 'save').mockResolvedValue(undefined);
    deleteByIdSpy = jest.spyOn(LogRepository.prototype, 'deleteById').mockResolvedValue(undefined);
    getByDateSpy = jest.spyOn(LogRepository.prototype, 'getByDate').mockResolvedValue([]);
  });

  afterEach(() => {
    saveSpy.mockRestore();
    deleteByIdSpy.mockRestore();
    getByDateSpy.mockRestore();
  });

  it('should add a log and persist it', async () => {
    const testLog: HabitLog = {
      id: 'h1_2026-05-25',
      habitId: 'h1',
      userId: 'user-1',
      fecha: '2026-05-25',
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };

    await useLogStore.getState().addLog(testLog);

    expect(saveSpy).toHaveBeenCalledWith(testLog);
    expect(useLogStore.getState().logs).toContainEqual(testLog);
  });

  it('should delete a log and remove it from store', async () => {
    const logId = 'h1_2026-05-25';
    const testLog: HabitLog = {
      id: logId,
      habitId: 'h1',
      userId: 'user-1',
      fecha: '2026-05-25',
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };

    useLogStore.setState({ logs: [testLog] });

    await useLogStore.getState().deleteLog(logId);

    expect(deleteByIdSpy).toHaveBeenCalledWith(logId);
    expect(useLogStore.getState().logs).not.toContainEqual(testLog);
  });

  it('should retrieve logs for a day and synchronize them with the Zustand store state', async () => {
    const date = '2026-05-25';
    const dbLogs: HabitLog[] = [
      {
        id: 'h1_2026-05-25',
        habitId: 'h1',
        userId: 'user-1',
        fecha: date,
        completado: true,
        timestampRegistro: new Date().toISOString(),
      },
      {
        id: 'h2_2026-05-25',
        habitId: 'h2',
        userId: 'user-1',
        fecha: date,
        completado: false,
        timestampRegistro: new Date().toISOString(),
      }
    ];

    getByDateSpy.mockResolvedValue(dbLogs);

    const result = await useLogStore.getState().getLogsForDay(date);

    expect(getByDateSpy).toHaveBeenCalledWith(date);
    expect(result).toEqual(dbLogs);
    
    // Verify that the Zustand store logs array is synchronized with the loaded logs
    const stateLogs = useLogStore.getState().logs;
    expect(stateLogs).toContainEqual(dbLogs[0]);
    expect(stateLogs).toContainEqual(dbLogs[1]);
  });
});
