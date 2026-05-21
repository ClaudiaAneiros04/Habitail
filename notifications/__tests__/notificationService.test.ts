import { 
  scheduleHabitReminder, 
  cancelHabitReminder, 
  rescheduleAll,
  HABIT_REMINDER_CATEGORY
} from '../notificationService';
import * as Notifications from 'expo-notifications';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { usePetStore } from '../../store/usePetStore';
import { useLogStore } from '../../store/useLogStore';
import { Habit } from '../../types';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
}));

// Mock database
jest.mock('../../storage/database', () => ({
  initDb: jest.fn().mockResolvedValue({}),
  getDb: jest.fn().mockResolvedValue({}),
}));

// Mock LogRepository
const mockGetAll = jest.fn().mockResolvedValue([]);
jest.mock('../../storage/LogRepository', () => {
  return {
    LogRepository: jest.fn().mockImplementation(() => {
      return {
        getAll: mockGetAll,
        save: jest.fn().mockResolvedValue(undefined),
      };
    })
  };
});

describe('NotificationService - Pruebas Unitarias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useHabitStore.setState({ habits: [] });
    useUserStore.setState({ user: null });
    usePetStore.setState({ pet: null });
    useLogStore.setState({ logs: [] });
  });

  describe('scheduleHabitReminder', () => {
    const mockHabit: Habit = {
      id: 'habit-1',
      userId: 'user-1',
      nombre: 'Hábito de prueba',
      icono: 'heart',
      colorHex: '#FF0000',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      horaRecordatorio: '08:00',
      nivelPrioridad: 'NORMAL',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-05-20',
      activo: true,
    };

    test('Debe programar una notificación para un hábito activo con hora de recordatorio', async () => {
      await scheduleHabitReminder(mockHabit);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(mockHabit.id);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: mockHabit.id,
          content: expect.objectContaining({
            title: '¡Hora de tu hábito!',
            body: expect.stringContaining(mockHabit.nombre),
            categoryIdentifier: HABIT_REMINDER_CATEGORY,
            data: { habitId: mockHabit.id },
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

    test('No debe programar una notificación si el hábito está inactivo', async () => {
      const inactiveHabit = { ...mockHabit, activo: false };
      await scheduleHabitReminder(inactiveHabit);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('No debe programar una notificación si el hábito no tiene hora de recordatorio', async () => {
      const noReminderHabit = { ...mockHabit, horaRecordatorio: undefined };
      await scheduleHabitReminder(noReminderHabit);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancelHabitReminder', () => {
    test('Debe cancelar la notificación con el ID del hábito', async () => {
      await cancelHabitReminder('habit-123');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('habit-123');
    });
  });

  describe('rescheduleAll', () => {
    test('Debe cancelar todas las notificaciones y reprogramar las activas', async () => {
      const habits: Habit[] = [
        {
          id: 'habit-active',
          userId: 'user-1',
          nombre: 'Activo',
          icono: 'heart',
          colorHex: '#FF0000',
          frecuencia: 'DAILY',
          diasSemana: [0, 1, 2, 3, 4, 5, 6],
          horaRecordatorio: '09:00',
          nivelPrioridad: 'NORMAL',
          tipoVerificacion: 'BOOLEAN',
          fechaInicio: '2026-05-20',
          activo: true,
        },
        {
          id: 'habit-inactive',
          userId: 'user-1',
          nombre: 'Inactivo',
          icono: 'heart',
          colorHex: '#FF0000',
          frecuencia: 'DAILY',
          diasSemana: [0, 1, 2, 3, 4, 5, 6],
          horaRecordatorio: '10:00',
          nivelPrioridad: 'NORMAL',
          tipoVerificacion: 'BOOLEAN',
          fechaInicio: '2026-05-20',
          activo: false,
        }
      ];

      await rescheduleAll(habits);

      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'habit-active',
        })
      );
    });
  });
});
