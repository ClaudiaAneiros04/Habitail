import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Habit, Frequency, Priority, VerificationType } from '../types';
import { useHabitStore } from '../store/useHabitStore';
import { useUserStore } from '../store/useUserStore';
import { habitLibrary, PredefinedHabit } from '../data/habitLibrary';

/**
 * Clave utilizada en AsyncStorage para almacenar el estado de finalización del onboarding.
 */
export const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

/**
 * Interfaz para las opciones de enrutamiento conceptual del RootNavigator.
 */
export interface OnboardingRoutes {
  onboarding: string;
  mainApp: string;
}

/**
 * Rutas por defecto definidas para el enrutador conceptual.
 */
export const DEFAULT_ROUTES: OnboardingRoutes = {
  onboarding: '/onboarding',
  mainApp: '/(tabs)',
};

/**
 * Genera un identificador único con formato UUID v4.
 * Implementación limpia y segura compatible con entornos React Native.
 * 
 * @returns {string} Un string UUID v4 autogenerado.
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Recupera el estado actual del onboarding desde AsyncStorage.
 * 
 * @returns {Promise<boolean>} Promesa que se resuelve con true si el onboarding
 * ya fue completado con anterioridad, o false en caso contrario.
 */
export const getOnboardingStatus = async (): Promise<boolean> => {
  try {
    const status = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return status === 'true';
  } catch (error) {
    console.error('[OnboardingService] Error al obtener el estado de onboarding:', error);
    return false;
  }
};

/**
 * Guarda el estado del onboarding en AsyncStorage y lo sincroniza con el almacén
 * de datos globales del usuario (UserStore / SQLite).
 * 
 * @param {boolean} completed - El estado de finalización a guardar.
 * @returns {Promise<void>} Promesa vacía que se resuelve al completar la persistencia.
 */
export const setOnboardingStatus = async (completed: boolean): Promise<void> => {
  try {
    // 1. Guardar en AsyncStorage
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, completed ? 'true' : 'false');
    
    // 2. Sincronizar en memoria con useUserStore y base de datos local
    const userStore = useUserStore.getState();
    if (userStore.user) {
      await userStore.updateUser({ onboardingCompleted: completed });
    }
    
    console.log(`[OnboardingService] Estado de onboarding completado guardado exitosamente como: ${completed}`);
  } catch (error) {
    console.error('[OnboardingService] Error al guardar el estado de onboarding:', error);
    throw new Error('No se pudo guardar el estado de finalización del onboarding.');
  }
};

/**
 * Determina a qué ruta del enrutador debe redirigirse el usuario 
 * en función del flag de finalización del onboarding.
 * 
 * @param {boolean} onboardingCompleted - Flag que indica si el onboarding ya se completó.
 * @param {OnboardingRoutes} [customRoutes] - Opciones de ruta personalizadas (opcional).
 * @returns {string} El path o nombre de la ruta a la cual redirigir.
 */
export const determineInitialRoute = (
  onboardingCompleted: boolean,
  customRoutes?: Partial<OnboardingRoutes>
): string => {
  const routes = { ...DEFAULT_ROUTES, ...customRoutes };
  if (!onboardingCompleted) {
    return routes.onboarding;
  }
  return routes.mainApp;
};

/**
 * Lógica principal del Onboarding:
 * 1. Filtra la librería de hábitos sugeridos (habitLibrary) según las categorías de interés elegidas por el usuario.
 * 2. Mapea y complementa los datos para instanciar hábitos completos fuertemente tipados.
 * 3. Los crea automáticamente en el almacén de hábitos del usuario (Zustand) persistiéndolos en SQLite/AsyncStorage.
 * 4. Cambia el flag onboardingCompleted a true en AsyncStorage y el UserStore.
 * 
 * @param {Category[]} selectedCategories - Colección de categorías (SALUD, DEPORTE, etc.) seleccionadas por el usuario.
 * @param {string} [userId='default-user'] - ID del usuario activo para vincular la pertenencia de los hábitos.
 * @returns {Promise<void>} Promesa que se resuelve con éxito una vez creados los hábitos y guardado el flag.
 */
export const completeOnboarding = async (
  selectedCategories: Category[],
  userId: string = 'default-user'
): Promise<void> => {
  try {
    // Validar parámetros de entrada
    if (!selectedCategories || selectedCategories.length === 0) {
      console.warn('[OnboardingService] El usuario finalizó el onboarding sin seleccionar categorías. No se auto-crearán hábitos.');
    } else {
      console.log(`[OnboardingService] Procesando onboarding. Categorías seleccionadas: ${selectedCategories.join(', ')}`);
      
      // 1. Filtrar la librería predefinida (habitLibrary) por categorías de interés
      const filteredLibraryHabits = habitLibrary.filter((predefinedHabit) =>
        selectedCategories.includes(predefinedHabit.categoria as Category)
      );

      console.log(`[OnboardingService] Se encontraron ${filteredLibraryHabits.length} hábitos en la librería para las categorías seleccionadas.`);

      // 2. Mapear e instanciar cada hábito predefinido en la base de datos de usuario
      const habitStore = useHabitStore.getState();
      
      for (const libraryHabit of filteredLibraryHabits) {
        const newHabit: Habit = {
          id: generateUUID(),
          userId,
          nombre: libraryHabit.nombre,
          descripcion: libraryHabit.descripcion,
          categoria: libraryHabit.categoria,
          icono: libraryHabit.icono,
          colorHex: libraryHabit.colorHex,
          frecuencia: libraryHabit.frecuencia,
          // Por defecto, se configuran todos los días de la semana activos para los hábitos iniciales del onboarding
          diasSemana: [1, 2, 3, 4, 5, 6, 7],
          // Establecer hora de recordatorio sugerida por defecto a las 9:00 AM para mayor retención
          horaRecordatorio: '09:00',
          tipoVerificacion: VerificationType.BOOLEAN,
          nivelPrioridad: libraryHabit.nivelPrioridad,
          fechaInicio: new Date().toISOString(),
          activo: true,
        };

        // Agregar al store (esto guarda en SQLite e infla el estado global de forma reactiva)
        await habitStore.addHabit(newHabit);
        console.log(`[OnboardingService] Hábito "${newHabit.nombre}" auto-creado y guardado correctamente.`);
      }
    }

    // 3. Registrar la finalización exitosa del onboarding en AsyncStorage y UserStore
    await setOnboardingStatus(true);
    console.log('[OnboardingService] Onboarding completado con éxito.');
  } catch (error) {
    console.error('[OnboardingService] Error crítico durante la finalización del onboarding:', error);
    throw new Error('No se pudo procesar la finalización del onboarding ni guardar las preferencias de hábitos.');
  }
};
