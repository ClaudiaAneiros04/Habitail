import { useHabitStore } from '../useHabitStore';
import { Habit } from '../../types';

// Mock de AsyncStorage para aislar el store de advertencias de dependencias externas en las pruebas
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

describe('useHabitStore', () => {
  beforeEach(() => {
    // Restablecer el estado antes de cada test para no arrastrar datos
    useHabitStore.setState({ habits: [] });
  });

  it('debería añadir un hábito correctamente y asignarle un UUID v4', async () => {
    // Preparamos los datos base del hábito (sin ID)
    const habitData: Omit<Habit, 'id'> = {
      userId: 'user-123',
      nombre: 'Leer 20 páginas',
      categoria: 'APRENDIZAJE',
      icono: 'book',
      colorHex: '#FFA500',
      frecuencia: 'DAILY',
      diasSemana: [1, 2, 3, 4, 5],
      horaRecordatorio: '2026-04-16T20:00:00.000Z',
      nivelPrioridad: 'NORMAL',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-10-15',
      activo: true,
    };

    // Añadimos el hábito mediante la función expuesta en el store
    await useHabitStore.getState().addHabit(habitData);

    // Obtenemos el estado actualizado
    const state = useHabitStore.getState();
    const habits = state.habits;

    // Aserciones
    expect(habits).toHaveLength(1);
    
    const savedHabit = habits[0];
    
    // Verificar los datos guardados
    expect(savedHabit.nombre).toBe('Leer 20 páginas');
    expect(savedHabit.frecuencia).toBe('DAILY');
    expect(savedHabit.nivelPrioridad).toBe('NORMAL');
    
    // Verificar que se asignó un ID con formato UUID v4
    expect(savedHabit.id).toBeDefined();
    expect(typeof savedHabit.id).toBe('string');
    expect(savedHabit.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  describe('Preferencia de notificaciones del usuario', () => {
    it('setNotificationsEnabled(false) persiste en AsyncStorage y desactiva en el estado', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      
      await useHabitStore.getState().setNotificationsEnabled(false);

      expect(useHabitStore.getState().notificationsEnabled).toBe(false);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@habitail_user_notifications_enabled',
        'false'
      );
    });

    it('loadNotificationPreference recupera correctamente la preferencia guardada en AsyncStorage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce('false');

      const result = await useHabitStore.getState().loadNotificationPreference();

      expect(result).toBe(false);
      expect(useHabitStore.getState().notificationsEnabled).toBe(false);
    });

    it('loadNotificationPreference preserva el valor por defecto si no hay nada guardado', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      useHabitStore.setState({ notificationsEnabled: true });

      const result = await useHabitStore.getState().loadNotificationPreference();

      expect(result).toBe(true);
      expect(useHabitStore.getState().notificationsEnabled).toBe(true);
    });
  });
});

