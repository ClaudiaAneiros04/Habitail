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
import { PetState } from '../../types';

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

// Mock de AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

describe('InactivityService - Pruebas Unitarias y de Integración', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPetMotivationMessage - Mensajería Ajustada a Pérdida Irreversible', () => {
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

    test('Debe devolver mensaje de ALERTA DEFINITIVA advirtiendo de pérdida irreversible para Triste (Vida: 15)', () => {
      const msg = getPetMotivationMessage(mockSadPet);
      expect(msg.title).toContain('ALERTA DEFINITIVA');
      expect(msg.body).toContain('se marchará para siempre');
      expect(msg.body).toContain('15 HP');
    });

    test('Debe reflejar la marcha definitiva irreversible para mascota Ausente (Vida: 0)', () => {
      const msg = getPetMotivationMessage(mockAbsentPet);
      expect(msg.title).toContain('partido definitivamente');
      expect(msg.body).toContain('se ha marchado para siempre');
      expect(msg.body).toContain('definitiva');
    });
  });

  describe('scheduleInactivityReminder - Programación con Control de Estado', () => {
    test('RESTRICCIÓN ESTRICTA: No debe programar notificación si la vida de la mascota es 0 (Ausente)', async () => {
      usePetStore.setState({ pet: mockAbsentPet });

      await scheduleInactivityReminder();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(PET_INACTIVITY_NOTIFICATION_ID);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    test('Debe programar la notificación de inactividad si la mascota está viva (Vida > 0)', async () => {
      usePetStore.setState({ pet: mockHappyPet });

      await scheduleInactivityReminder(10);

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

  describe('handleAppForeground - Reglas de Inactividad (48h y 72h)', () => {
    const baseTime = 1700000000000;

    const setupUserAndPet = (lastOpenedAt: number, petOverrides = {}) => {
      const mockUser = {
        id: 'user-1',
        username: 'Test User',
        fechaRegistro: '2026-01-01T00:00:00.000Z',
        puntos: 100,
        onboardingCompleted: true,
        lastOpenedAt,
      };

      const mockPet = {
        ...mockHappyPet,
        vida: 80,
        estadoActual: PetState.HAPPY,
        ...petOverrides,
      };

      const updateLastOpenedAtMock = jest.fn().mockImplementation(async () => {
        useUserStore.setState({
          user: { ...mockUser, lastOpenedAt: baseTime },
        });
      });

      const updatePetMock = jest.fn().mockImplementation(async (updates) => {
        usePetStore.setState((prev) => ({
          pet: prev.pet ? { ...prev.pet, ...updates } : null,
        }));
      });

      useUserStore.setState({
        user: mockUser,
        updateLastOpenedAt: updateLastOpenedAtMock,
      });

      usePetStore.setState({
        pet: mockPet,
        updatePet: updatePetMock,
      });

      return { updateLastOpenedAtMock, updatePetMock };
    };

    test('1. 47h 59m inactivo -> No hay marcha ni penalización prolongada, vida permanece intacta', async () => {
      const elapsed = (47 * 60 + 59) * 60 * 1000; // 47h 59m
      const previousOpened = baseTime - elapsed;
      const { updatePetMock } = setupUserAndPet(previousOpened, { vida: 80 });

      await handleAppForeground(3600, baseTime);

      // No debe mutar la vida de la mascota
      expect(updatePetMock).not.toHaveBeenCalled();
      const pet = usePetStore.getState().pet;
      expect(pet?.vida).toBe(80);
      expect(pet?.estadoActual).toBe(PetState.HAPPY);

      // Programa recordatorio para el futuro
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    test('2. 48h inactivo -> Se emite recordatorio de retención; vida permanece intacta', async () => {
      const elapsed = 48 * 60 * 60 * 1000; // Exactamente 48h
      const previousOpened = baseTime - elapsed;
      const { updatePetMock } = setupUserAndPet(previousOpened, { vida: 80 });

      await handleAppForeground(3600, baseTime);

      // Vida permanece intacta (no se penaliza vida a las 48h)
      expect(updatePetMock).not.toHaveBeenCalled();
      expect(usePetStore.getState().pet?.vida).toBe(80);

      // Reprograma recordatorio
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    test('3. 71h 59m inactivo -> No aplica regla de 3 días (marcha terminal), vida permanece intacta', async () => {
      const elapsed = (71 * 60 + 59) * 60 * 1000; // 71h 59m
      const previousOpened = baseTime - elapsed;
      const { updatePetMock } = setupUserAndPet(previousOpened, { vida: 60 });

      await handleAppForeground(3600, baseTime);

      expect(updatePetMock).not.toHaveBeenCalled();
      expect(usePetStore.getState().pet?.vida).toBe(60);
    });

    test('4. 72h inactivo -> vida = 0 y transición inmediata e irreversible a ABSENT', async () => {
      const elapsed = 72 * 60 * 60 * 1000; // Exactamente 72h
      const previousOpened = baseTime - elapsed;
      const { updatePetMock } = setupUserAndPet(previousOpened, { vida: 80 });

      await handleAppForeground(3600, baseTime);

      // Debe transicionar a vida 0 y ABSENT
      expect(updatePetMock).toHaveBeenCalledWith({ vida: 0, estadoActual: PetState.ABSENT });
      const pet = usePetStore.getState().pet;
      expect(pet?.vida).toBe(0);
      expect(pet?.estadoActual).toBe(PetState.ABSENT);

      // Debe haber cancelado recordatorios futuros
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(PET_INACTIVITY_NOTIFICATION_ID);
    });

    test('5. Múltiples aperturas consecutivas tras >= 72h no duplican eventos ni mutan el estado ya terminal', async () => {
      const elapsed = 100 * 60 * 60 * 1000; // 100 horas de inactividad
      const previousOpened = baseTime - elapsed;
      // Mascota ya en vida 0
      const { updatePetMock } = setupUserAndPet(previousOpened, { vida: 0, estadoActual: PetState.ABSENT });

      await handleAppForeground(3600, baseTime);

      // No debe llamar a updatePet de daño si ya estaba en 0
      expect(updatePetMock).not.toHaveBeenCalled();
      expect(usePetStore.getState().pet?.vida).toBe(0);
      expect(usePetStore.getState().pet?.estadoActual).toBe(PetState.ABSENT);

      // No programa nuevas notificaciones
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
