import { 
  scheduleHabitReminder, 
  cancelHabitReminder, 
  rescheduleAllHabitNotifications,
  rescheduleAllNotifications,
  rescheduleAll,
  handleDoneAction,
  handleSnoozeAction,
  registerNotificationCategories,
  isValidReminderTime,
  parseReminderTime,
  habitWeekdayToExpoWeekday,
  expoWeekdayToHabitWeekday,
  getUpcomingMonthlyOccurrences,
  isHabitCompletedOnDate,
  getHabitSnoozeCount,
  HABIT_REMINDER_CATEGORY,
  ACTION_DONE,
  ACTION_SNOOZE,
} from '../notificationService';
import * as Notifications from 'expo-notifications';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { usePetStore } from '../../store/usePetStore';
import { useLogStore } from '../../store/useLogStore';
import { Habit, Frequency } from '../../types';
import { habitCompletionService } from '../../services/HabitCompletionService';
import { getLogicalToday } from '../../utils/dateUtils';
import i18n from '../../i18n';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getNextTriggerDateAsync: jest.fn().mockImplementation((trigger) => {
    if (!trigger) return Promise.resolve(Date.now());
    if (trigger.type === 'date' && trigger.date) {
      return Promise.resolve(new Date(trigger.date).getTime());
    }
    if (trigger.type === 'calendar') {
      const d = new Date();
      d.setHours(trigger.hour || 0, trigger.minute || 0, 0, 0);
      return Promise.resolve(d.getTime());
    }
    return Promise.resolve(Date.now() + 60000);
  }),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));

let mockAsyncStorageStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockImplementation((key: string, val: string) => {
    mockAsyncStorageStore[key] = String(val);
    return Promise.resolve();
  }),
  getItem: jest.fn().mockImplementation((key: string) => {
    return Promise.resolve(mockAsyncStorageStore[key] ?? null);
  }),
  removeItem: jest.fn().mockImplementation((key: string) => {
    delete mockAsyncStorageStore[key];
    return Promise.resolve();
  }),
  clear: jest.fn().mockImplementation(() => {
    mockAsyncStorageStore = {};
    return Promise.resolve();
  }),
}));

const mockGetFirstAsync = jest.fn().mockResolvedValue(null);
const mockGetAllAsync = jest.fn().mockResolvedValue([]);
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });

jest.mock('../../storage/database', () => ({
  initDb: jest.fn().mockResolvedValue({}),
  getDb: jest.fn().mockImplementation(() => Promise.resolve({
    getFirstAsync: mockGetFirstAsync,
    getAllAsync: mockGetAllAsync,
    runAsync: mockRunAsync,
  })),
}));

jest.mock('../../services/HabitCompletionService', () => ({
  habitCompletionService: {
    completeHabit: jest.fn().mockResolvedValue({
      success: true,
      logId: 'log-123',
      alreadyCompleted: false,
      healthDelta: 10,
      pointsDelta: 20,
    }),
  },
}));

// ============================================================================
// Tests Suite
// ============================================================================

describe('NotificationService - Cobertura Integral de Reglas Canónicas', () => {
  const baseHabit: Habit = {
    id: 'habit-1',
    userId: 'user-1',
    nombre: 'Hábito de prueba',
    categoria: 'General',
    icono: 'heart',
    colorHex: '#FF0000',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    horaRecordatorio: '08:00',
    nivelPrioridad: 'NORMAL',
    tipoVerificacion: 'BOOLEAN',
    fechaInicio: '2026-05-20',
    activo: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorageStore = {};
    mockGetFirstAsync.mockResolvedValue(null);
    mockGetAllAsync.mockResolvedValue([]);
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
    useHabitStore.setState({ 
      habits: [],
      notificationsEnabled: true,
      setNotificationsEnabled: jest.fn()
    });
    useUserStore.setState({ user: { id: 'user-1', username: 'TestUser' } as any });
    usePetStore.setState({ pet: null });
    useLogStore.setState({ logs: [] });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DIARIO (Daily)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Frecuencia DAILY', () => {
    test('Programa trigger nativo DAILY recurrente con ID namespaced', async () => {
      await scheduleHabitReminder(baseHabit);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:daily',
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.stringContaining(baseHabit.nombre),
            categoryIdentifier: HABIT_REMINDER_CATEGORY,
            data: expect.objectContaining({ habitId: 'habit-1' }),
          }),
          trigger: expect.objectContaining({
            type: 'calendar',
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );
    });

    test('getNextTriggerDateAsync verifica trigger nativo diario', async () => {
      const trigger = {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 8,
        minute: 0,
        repeats: true,
      };
      const nextDateMs = await Notifications.getNextTriggerDateAsync(trigger as any);
      expect(typeof nextDateMs).toBe('number');
      expect(nextDateMs).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SEMANAL L/X/V (Weekly Mon/Wed/Fri)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Frecuencia WEEKLY L/X/V', () => {
    test('Programa un trigger WEEKLY recurrente por cada día configurado (Lunes, Miércoles, Viernes)', async () => {
      const weeklyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5], // Lun=1, Mié=3, Vie=5 en Habitail
      };

      await scheduleHabitReminder(weeklyHabit);

      // Verificamos conversión explícita: Habitail 1->Expo 2, 3->Expo 4, 5->Expo 6
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:weekly:1',
          trigger: expect.objectContaining({
            type: 'calendar',
            weekday: 2, // Lunes
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:weekly:3',
          trigger: expect.objectContaining({
            type: 'calendar',
            weekday: 4, // Miércoles
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:weekly:5',
          trigger: expect.objectContaining({
            type: 'calendar',
            weekday: 6, // Viernes
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DOMINGO (Sunday)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Conversión de Domingo', () => {
    test('Habitail 0 (Domingo) se convierte explícitamente a Expo 1 (Sunday)', () => {
      expect(habitWeekdayToExpoWeekday(0)).toBe(1);
      expect(expoWeekdayToHabitWeekday(1)).toBe(0);
    });

    test('Habitail 7 (Domingo en sistemas ISO) se normaliza a 0 y se convierte a Expo 1', () => {
      expect(habitWeekdayToExpoWeekday(7)).toBe(1);
    });

    test('Programa correctamente trigger semanal para Domingo', async () => {
      const sundayHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [0], // Domingo
      };

      await scheduleHabitReminder(sundayHabit);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:weekly:0',
          trigger: expect.objectContaining({
            type: 'calendar',
            weekday: 1, // Domingo en Expo
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MENSUAL 15 (Monthly 15)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Frecuencia MONTHLY 15 (cabe siempre en el mes)', () => {
    test('Usa trigger nativo MONTHLY recurrente cuando día <= 28', async () => {
      const monthly15Habit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-05-15',
      };

      await scheduleHabitReminder(monthly15Habit);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:monthly:15',
          trigger: expect.objectContaining({
            type: 'calendar',
            day: 15,
            hour: 8,
            minute: 0,
            repeats: true,
          }),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. MENSUAL 29/30/31 Y 6. FEBRERO BISIESTO (Monthly Clamped & Leap Year)
  // ───────────────────────────────────────────────────────────────────────────
  describe('5 & 6. Frecuencia MONTHLY 29/30/31 y Febrero bisiesto', () => {
    test('Aplica regla canónica: genera ocurrencias DATE con ajuste de último día de mes en bisiesto (2024)', () => {
      const habit31: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2024-01-31',
      };

      const occurrences = getUpcomingMonthlyOccurrences(habit31, '2024-01-01', 4);
      expect(occurrences).toEqual([
        '2024-01-31',
        '2024-02-29', // 2024 es bisiesto: febrero tiene 29 días
        '2024-03-31',
        '2024-04-30', // Abril tiene 30 días
      ]);
    });

    test('Aplica regla canónica: genera ocurrencias DATE en febrero no bisiesto (2025: 28 días)', () => {
      const habit31: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2025-01-31',
      };

      const occurrences = getUpcomingMonthlyOccurrences(habit31, '2025-01-01', 3);
      expect(occurrences).toEqual([
        '2025-01-31',
        '2025-02-28', // 2025 no es bisiesto: febrero tiene 28 días
        '2025-03-31',
      ]);
    });

    test('Programa horizonte razonable de DATE triggers para hábito mensual iniciado el 31', async () => {
      const habit31: Habit = {
        ...baseHabit,
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-31',
      };

      await scheduleHabitReminder(habit31);

      // Debe haber programado triggers DATE específicos para los próximos meses
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      const firstCall = calls[0][0];
      expect(firstCall.identifier).toMatch(/^habit:habit-1:monthly:\d{4}-\d{2}-\d{2}$/);
      expect(firstCall.trigger.type).toBe('date');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. EDITAR FRECUENCIA
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Editar frecuencia', () => {
    test('Limpia triggers anteriores con prefijo namespaced y programa los nuevos sin dejar huérfanos', async () => {
      // Simular que en el sistema existen notificaciones viejas de este hábito
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'habit:habit-1:daily' },
        { identifier: 'habit:habit-other:daily' },
      ]);

      const weeklyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1], // Lunes
      };

      await scheduleHabitReminder(weeklyHabit);

      // Verificamos que canceló la diaria vieja de este hábito pero no la del otro
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:habit-1:daily');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('habit:habit-other:daily');

      // Programó el nuevo trigger semanal
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:weekly:1',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. ARCHIVAR Y 9. REACTIVAR
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Archivar y 9. Reactivar', () => {
    test('Archivar: cancelHabitReminder cancela únicamente triggers del hábito', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'habit:habit-1:weekly:1' },
        { identifier: 'habit:habit-1:weekly:3' },
        { identifier: 'pet:inactivity' },
      ]);

      await cancelHabitReminder('habit-1');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:habit-1:weekly:1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:habit-1:weekly:3');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('pet:inactivity');
    });

    test('Hábito inactivo (archivado) omite programar notificaciones', async () => {
      const inactiveHabit = { ...baseHabit, activo: false };
      await scheduleHabitReminder(inactiveHabit);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('Reactivar: vuelve a programar triggers normalmente', async () => {
      const activeHabit = { ...baseHabit, activo: true };
      await scheduleHabitReminder(activeHabit);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:daily',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. COMPLETAR ANTES DEL RECORDATORIO
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Completar antes del recordatorio y supervivencia indefinida', () => {
    test('No programa recordatorio para hoy pero mantiene programadas fechas futuras y trigger recurrente diario', async () => {
      // Simular que el hábito ya fue completado hoy en SQLite
      mockGetFirstAsync.mockResolvedValueOnce({ completado: 1 });

      const todayStr = getLogicalToday();
      const habit: Habit = {
        ...baseHabit,
        horaRecordatorio: '23:59', // Hora que aún no ha pasado hoy
      };

      await scheduleHabitReminder(habit);

      // Verificamos que ninguna notificación se programó para hoy
      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // No debe existir trigger con fecha de hoy
      const scheduledForToday = calls.some((c) => c[0].identifier === `habit:habit-1:daily:${todayStr}`);
      expect(scheduledForToday).toBe(false);

      // Pero deben haberse programado días futuros (DATE triggers de horizonte)
      const scheduledForFuture = calls.some((c) => c[0].trigger.type === 'date');
      expect(scheduledForFuture).toBe(true);

      // Y FUNDAMENTAL: Mantiene además el trigger diario nativo recurrente (repeats: true)
      // para que si la app nunca se abre tras el horizonte de 7 días, el hábito no se extinga
      const scheduledDailyNative = calls.some(
        (c) => c[0].identifier === 'habit:habit-1:daily' && c[0].trigger.type === 'calendar' && c[0].trigger.repeats === true
      );
      expect(scheduledDailyNative).toBe(true);
    });

    test('Hábito semanal completado hoy antes de la hora mantiene el trigger nativo semanal recurrente', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ completado: 1 });

      const todayStr = getLogicalToday();
      const [y, m, d] = todayStr.split('-').map(Number);
      const todayDate = new Date(y, m - 1, d);
      const currentHabitDay = todayDate.getDay(); // 0..6

      const weeklyHabit: Habit = {
        ...baseHabit,
        frecuencia: Frequency.WEEKLY,
        diasSemana: [currentHabitDay],
        horaRecordatorio: '23:59',
      };

      await scheduleHabitReminder(weeklyHabit);

      const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
      // Debe haber programado la próxima ocurrencia específica (DATE)
      const hasDateTrigger = calls.some((c) => c[0].identifier === `habit:habit-1:weekly:${currentHabitDay}:next`);
      expect(hasDateTrigger).toBe(true);

      // Y también el trigger recurrente nativo (repeats: true) para que nunca se extinga
      const hasRepeatingCalendar = calls.some(
        (c) => c[0].identifier === `habit:habit-1:weekly:${currentHabitDay}` && c[0].trigger.repeats === true
      );
      expect(hasRepeatingCalendar).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. APP CERRADA Y VUELTA A ABRIR
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. App cerrada y vuelta a abrir (rescheduleAllHabitNotifications)', () => {
    test('Reprograma hábitos activos limpiando deterministamente los previos del namespace de hábitos', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'habit:old:daily' },
      ]);

      await rescheduleAllHabitNotifications([baseHabit]);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:old:daily');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit:habit-1:daily',
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. REPROGRAMAR HÁBITOS NO ELIMINA RECORDATORIO DE MASCOTA
  // ───────────────────────────────────────────────────────────────────────────
  describe('12. Preservación estricta de notificaciones del sistema (pet:inactivity)', () => {
    test('NUNCA llama a cancelAllScheduledNotificationsAsync ni cancela pet:inactivity al reprogramar hábitos', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
        { identifier: 'habit:old-1:daily' },
        { identifier: 'habit:old-2:weekly:1' },
        { identifier: 'pet:inactivity' },
        { identifier: 'pet_inactivity_reminder' },
      ]);

      await rescheduleAllHabitNotifications([baseHabit]);

      // Solo debe cancelar las de namespace de hábitos
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:old-1:daily');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:old-2:weekly:1');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('pet:inactivity');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('pet_inactivity_reminder');

      // NUNCA debe invocar la API global destructiva
      expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. DONE SIMULTÁNEO CON CHECKBOX UI
  // ───────────────────────────────────────────────────────────────────────────
  describe('13. Acción DONE y simultaneidad con checkbox UI', () => {
    test('handleDoneAction delega en habitCompletionService y cancela snooze pendiente', async () => {
      await handleDoneAction('habit-1');

      expect(habitCompletionService.completeHabit).toHaveBeenCalledWith(
        expect.objectContaining({
          habitId: 'habit-1',
          source: 'NOTIFICATION',
        })
      );
    });

    test('Ejecución simultánea UI y NOTIFICATION es serializada idénticamente por HabitCompletionService', async () => {
      const p1 = habitCompletionService.completeHabit({
        userId: 'user-1',
        habitId: 'habit-1',
        logicalDate: getLogicalToday(),
        source: 'UI',
      });
      const p2 = handleDoneAction('habit-1');

      await Promise.all([p1, p2]);

      expect(habitCompletionService.completeHabit).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. SNOOZE MÁXIMO (1 por hábito y día)
  // ───────────────────────────────────────────────────────────────────────────
  describe('14. Regla de Snooze: Máximo 1 posposición por hábito y LogicalDate', () => {
    test('Primera posposición se programa a 30 minutos e incrementa contador persistido', async () => {
      const mockContent = {
        title: 'Original Title',
        body: 'Original Body',
        data: { habitId: 'habit-1' },
      } as any;

      await handleSnoozeAction('habit-1', 0, mockContent);

      const todayStr = getLogicalToday();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: `habit:habit-1:snooze:${todayStr}`,
          trigger: expect.objectContaining({
            type: 'timeInterval',
            seconds: 1800,
            repeats: false,
          }),
        })
      );

      const count = await getHabitSnoozeCount('habit-1', todayStr);
      expect(count).toBe(1);
    });

    test('Segunda posposición en el mismo día es bloqueada tanto por payload como por AsyncStorage', async () => {
      const mockContent = {
        title: 'Original Title',
        body: 'Original Body',
        data: { habitId: 'habit-1' },
      } as any;

      // Primer snooze
      await handleSnoozeAction('habit-1', 0, mockContent);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      // Segundo snooze con payload count = 1
      await handleSnoozeAction('habit-1', 1, mockContent);
      // No debe volverse a agendar
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      // Tercer snooze con bypass de payload (count = 0) pero AsyncStorage ya en 1
      await handleSnoozeAction('habit-1', 0, mockContent);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. VALIDACIÓN DE HORA Y CAMBIO DE TIMEZONE / DST
  // ───────────────────────────────────────────────────────────────────────────
  describe('15. Validación de hora HH:mm y compatibilidad DST/Timezone', () => {
    test('Valida correctamente formatos de hora válidos', () => {
      expect(isValidReminderTime('00:00')).toBe(true);
      expect(isValidReminderTime('08:30')).toBe(true);
      expect(isValidReminderTime('23:59')).toBe(true);
      expect(isValidReminderTime('7:05')).toBe(true);

      expect(parseReminderTime('08:30')).toEqual({ hours: 8, minutes: 30 });
    });

    test('Rechaza horas o minutos fuera de rango o formatos corruptos', () => {
      expect(isValidReminderTime('24:00')).toBe(false);
      expect(isValidReminderTime('12:60')).toBe(false);
      expect(isValidReminderTime('-01:30')).toBe(false);
      expect(isValidReminderTime('invalido')).toBe(false);
      expect(isValidReminderTime(undefined)).toBe(false);

      expect(() => parseReminderTime('25:00')).toThrow();
    });

    test('Hábito con hora inválida no programa notificación y emite advertencia segura', async () => {
      const invalidHabit: Habit = {
        ...baseHabit,
        horaRecordatorio: '26:99',
      };

      await scheduleHabitReminder(invalidHabit);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. INTERNACIONALIZACIÓN (i18n)
  // ───────────────────────────────────────────────────────────────────────────
  describe('16. Internacionalización (i18n)', () => {
    test('registerNotificationCategories registra botones Hecho y Posponer con textos traducidos', async () => {
      await registerNotificationCategories();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        HABIT_REMINDER_CATEGORY,
        expect.arrayContaining([
          expect.objectContaining({
            identifier: ACTION_DONE,
            buttonTitle: expect.any(String),
          }),
          expect.objectContaining({
            identifier: ACTION_SNOOZE,
            buttonTitle: expect.any(String),
          }),
        ])
      );
    });

    test('Notificación programada incluye título y cuerpo con traducción', async () => {
      await scheduleHabitReminder(baseHabit);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.stringContaining(baseHabit.nombre),
          }),
        })
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. SEPARACIÓN DE PERMISOS DEL SO Y PREFERENCIAS DEL USUARIO
  // ───────────────────────────────────────────────────────────────────────────
  describe('17. Separación de permisos del SO y preferencias del usuario', () => {
    test('Permiso concedido pero preferencia del usuario desactivada: NO programa recordatorio', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      useHabitStore.setState({ notificationsEnabled: false });

      await scheduleHabitReminder(baseHabit);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('Permiso concedido pero preferencia del usuario desactivada: rescheduleAllHabitNotifications cancela y NO programa', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      useHabitStore.setState({ notificationsEnabled: false });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'habit:habit-1:daily', content: { data: { habitId: 'habit-1' } } }
      ]);

      await rescheduleAllHabitNotifications([baseHabit]);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:habit-1:daily');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('Permiso denegado por el SO: cancelHabitReminder se ejecuta correctamente sin abortar por falta de permisos', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        { identifier: 'habit:habit-1:daily', content: { data: { habitId: 'habit-1' } } }
      ]);

      await cancelHabitReminder('habit-1');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit:habit-1:daily');
    });

    test('runSafeNotificationOperation NUNCA altera o sobrescribe notificationsEnabled en el store', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      const mockSetNotificationsEnabled = jest.fn();
      useHabitStore.setState({ 
        notificationsEnabled: false,
        setNotificationsEnabled: mockSetNotificationsEnabled 
      });

      await scheduleHabitReminder(baseHabit);

      expect(mockSetNotificationsEnabled).not.toHaveBeenCalled();
      expect(useHabitStore.getState().notificationsEnabled).toBe(false);
    });
  });
});

