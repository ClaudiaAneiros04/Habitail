import {
  getPetMotivationMessage,
  PET_INACTIVITY_NOTIFICATION_ID,
  scheduleInactivityReminder,
  handleAppForeground
} from '../inactivityService';
import {
  mockHappyPet,
  mockCheeringPet,
  mockConfusedPet,
  mockSadPet,
  mockAbsentPet
} from '../inactivityMocks';
import * as Notifications from 'expo-notifications';
import { useUserStore } from '../../store/useUserStore';
import { usePetStore } from '../../store/usePetStore';

// Mock de expo-notifications para testeo aislado
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  AndroidNotificationPriority: {
    HIGH: 'high',
  },
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
  },
}));

// Mock de AsyncStorage para evitar llamadas a la API nativa de Android/iOS en pruebas
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
}));

describe('InactivityService - Pruebas Unitarias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPetMotivationMessage - Mensajería de Motivación según Salud', () => {
    test('Debe devolver el mensaje adecuado para mascota Feliz (Vida: 100)', () => {
      const msg = getPetMotivationMessage(mockHappyPet);
      expect(msg.title).toContain('esperando');
      expect(msg.body).toContain('100 HP');
    });

    test('Debe devolver el mensaje adecuado para mascota Estable (Vida: 70)', () => {
      const msg = getPetMotivationMessage(mockCheeringPet);
      expect(msg.title).toContain('No te rindas');
      expect(msg.body).toContain('70 HP');
    });

    test('Debe devolver el mensaje adecuado para mascota Confundida (Vida: 40)', () => {
      const msg = getPetMotivationMessage(mockConfusedPet);
      expect(msg.title).toContain('Dónde has estado');
      expect(msg.body).toContain('40 HP');
    });

    test('Debe devolver el mensaje de ALERTA para mascota Triste/Enferma (Vida: 15)', () => {
      const msg = getPetMotivationMessage(mockSadPet);
      expect(msg.title).toContain('ALERTA');
      expect(msg.body).toContain('15 HP');
    });

    test('Debe devolver el mensaje adecuado para mascota Ausente (Vida: 0)', () => {
      const msg = getPetMotivationMessage(mockAbsentPet);
      expect(msg.title).toContain('Oh no');
      expect(msg.body).toContain('marchado');
    });
  });

  describe('scheduleInactivityReminder - Programación con Control de Estado', () => {
    test('RESTRICCIÓN ESTRICTA: No debe programar notificación si la vida de la mascota es 0 (Ausente)', async () => {
      // Mockear el estado global de la mascota a vida 0
      const originalPetState = usePetStore.getState();
      usePetStore.setState({
        ...originalPetState,
        pet: mockAbsentPet,
      });

      await scheduleInactivityReminder();

      // Debe intentar cancelar notificaciones previas pero NO programar una nueva
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(PET_INACTIVITY_NOTIFICATION_ID);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('Debe programar la notificación de inactividad si la mascota está viva (Vida > 0)', async () => {
      // Mockear el estado global de la mascota a vida 100
      const originalPetState = usePetStore.getState();
      usePetStore.setState({
        ...originalPetState,
        pet: mockHappyPet,
      });

      await scheduleInactivityReminder(10); // 10 segundos para testeo rápido

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(PET_INACTIVITY_NOTIFICATION_ID);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: PET_INACTIVITY_NOTIFICATION_ID,
        content: expect.objectContaining({
          title: expect.any(String),
          body: expect.any(String),
          data: expect.objectContaining({
            type: 'pet_inactivity',
            petVida: 100,
          }),
        }),
        trigger: {
          type: 'timeInterval',
          seconds: 10,
          repeats: false,
        },
      });
    });
  });

  describe('handleAppForeground - Manejo de Regreso a Primer Plano', () => {
    test('Debe actualizar el timestamp lastOpenedAt y reprogramar el recordatorio de inactividad', async () => {
      // Mock del usuario e implementación de actualización de la fecha de apertura
      const originalUserState = useUserStore.getState();
      const mockUser = {
        id: 'default-user',
        username: 'Usuario',
        fechaRegistro: new Date().toISOString(),
        puntos: 20,
        onboardingCompleted: true,
        lastOpenedAt: Date.now() - (49 * 60 * 60 * 1000), // Inactivo desde hace 49 horas
      };

      const updateLastOpenedAtMock = jest.fn().mockImplementation(async () => {
        useUserStore.setState({
          user: { ...mockUser, lastOpenedAt: Date.now() },
        });
      });

      useUserStore.setState({
        ...originalUserState,
        user: mockUser,
        updateLastOpenedAt: updateLastOpenedAtMock,
      });

      // Mock de la mascota viva
      const originalPetState = usePetStore.getState();
      usePetStore.setState({
        ...originalPetState,
        pet: mockHappyPet,
      });

      // Ejecutar la acción de foreground simulando un trigger rápido de 5 segundos
      await handleAppForeground(5);

      // Debe haber actualizado el timestamp de apertura en el store
      expect(updateLastOpenedAtMock).toHaveBeenCalled();

      // Debe haber cancelado la alerta anterior y programado la nueva con el tiempo especificado
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(PET_INACTIVITY_NOTIFICATION_ID);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: PET_INACTIVITY_NOTIFICATION_ID,
          trigger: {
            type: 'timeInterval',
            seconds: 5,
            repeats: false,
          },
        })
      );
    });
  });
});
