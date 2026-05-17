import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOnboardingStatus, setOnboardingStatus, determineInitialRoute, completeOnboarding } from '../onboardingService';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { Category, Frequency, Priority, VerificationType } from '../../types';

// Mock de AsyncStorage para evitar llamadas nativas en entorno de tests
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn(),
}));

describe('OnboardingService - Pruebas Unitarias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Inicializar el estado de los stores simulados antes de cada prueba
    useHabitStore.setState({ habits: [] });
    useUserStore.setState({
      user: {
        id: 'default-user',
        username: 'Usuario',
        fechaRegistro: new Date().toISOString(),
        puntos: 0,
        onboardingCompleted: false,
      },
      updateUser: jest.fn().mockImplementation(async (updates) => {
        const currentUser = useUserStore.getState().user;
        if (currentUser) {
          useUserStore.setState({ user: { ...currentUser, ...updates } });
        }
      })
    } as any);
  });

  describe('getOnboardingStatus - Lectura de Estado', () => {
    test('Debe devolver false si AsyncStorage devuelve null (caso primer inicio)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const status = await getOnboardingStatus();
      expect(status).toBe(false);
    });

    test('Debe devolver true si AsyncStorage contiene el valor "true"', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');
      const status = await getOnboardingStatus();
      expect(status).toBe(true);
    });

    test('Debe devolver false si AsyncStorage contiene el valor "false"', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');
      const status = await getOnboardingStatus();
      expect(status).toBe(false);
    });
  });

  describe('setOnboardingStatus - Escritura y Sincronización', () => {
    test('Debe persistir en AsyncStorage y actualizar el estado en useUserStore concurrentemente', async () => {
      await setOnboardingStatus(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_completed', 'true');
      
      const user = useUserStore.getState().user;
      expect(user?.onboardingCompleted).toBe(true);
    });
  });

  describe('determineInitialRoute - Control de Flujo del Enrutador', () => {
    test('Debe redirigir al flujo de onboarding si el flag completed es false', () => {
      const route = determineInitialRoute(false);
      expect(route).toBe('/onboarding');
    });

    test('Debe saltar directo a la aplicación principal (tabs) si el flag completed es true', () => {
      const route = determineInitialRoute(true);
      expect(route).toBe('/(tabs)');
    });

    test('Debe admitir y respetar mapeos de rutas personalizadas', () => {
      const custom = { onboarding: '/welcome-slides', mainApp: '/dashboard' };
      
      expect(determineInitialRoute(false, custom)).toBe('/welcome-slides');
      expect(determineInitialRoute(true, custom)).toBe('/dashboard');
    });
  });

  describe('completeOnboarding - Selección y Autocreación de Hábitos', () => {
    test('Debe filtrar la librería de hábitos predefinidos, crearlos automáticamente en el store y marcar onboardingCompleted como true', async () => {
      // Mock de addHabit del store
      const addHabitMock = jest.fn().mockImplementation(async (habit) => {
        const currentHabits = useHabitStore.getState().habits;
        useHabitStore.setState({ habits: [...currentHabits, habit] });
      });
      
      const originalStore = useHabitStore.getState();
      useHabitStore.setState({ ...originalStore, addHabit: addHabitMock });

      // Ejecutar con categorías seleccionadas
      const selectedCategories = [Category.SALUD, Category.APRENDIZAJE];
      await completeOnboarding(selectedCategories, 'default-user');

      // Verificar que se añadieron hábitos
      expect(addHabitMock).toHaveBeenCalled();
      
      const createdHabits = useHabitStore.getState().habits;
      expect(createdHabits.length).toBeGreaterThan(0);
      
      // Comprobar propiedades de los hábitos auto-creados
      createdHabits.forEach(habit => {
        // La categoría del hábito debe estar dentro de las seleccionadas
        expect(selectedCategories).toContain(habit.categoria);
        // Debe poseer id único tipo UUID y pertenecer al usuario correcto
        expect(habit.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(habit.userId).toBe('default-user');
        expect(habit.activo).toBe(true);
        expect(habit.diasSemana).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(habit.tipoVerificacion).toBe(VerificationType.BOOLEAN);
      });

      // El flag en AsyncStorage debe marcarse como "true"
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@onboarding_completed', 'true');
      
      // El flag en useUserStore debe actualizarse a true
      expect(useUserStore.getState().user?.onboardingCompleted).toBe(true);
    });
  });
});
