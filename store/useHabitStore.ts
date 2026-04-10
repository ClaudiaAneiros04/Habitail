import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';

/**
 * Interface que define el estado y las acciones del store de hábitos.
 */
interface HabitState {
  /** Lista de todos los hábitos registrados */
  habits: Habit[];
  
  /**
   * Añade un nuevo hábito a la lista.
   * @param habit El objeto hábito completo a añadir.
   */
  addHabit: (habit: Habit) => void;
  
  /**
   * Actualiza campos específicos de un hábito existente.
   * @param id El identificador único del hábito.
   * @param updates Objeto con las propiedades a actualizar.
   */
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  
  /**
   * Archiva un hábito cambiando su estado 'activo' a false.
   * @param id El identificador único del hábito.
   */
  archiveHabit: (id: string) => void;
  
  /**
   * Elimina permanentemente un hábito de la lista.
   * @param id El identificador único del hábito.
   */
  removeHabit: (id: string) => void;
}

/**
 * Store de Zustand para la gestión de hábitos.
 * La persistencia se maneja manualmente para evitar errores de sintaxis en entornos Web.
 */
export const useHabitStore = create<HabitState>()((set, get) => ({
  // Estado inicial: array vacío de hábitos
  habits: [],

  /**
   * Acción: Añadir Hábito.
   */
  addHabit: (habit: Habit) => {
    set((state) => ({
      habits: [...state.habits, habit],
    }));
    saveToStorage(get().habits);
  },

  /**
   * Acción: Actualizar Hábito.
   */
  updateHabit: (id: string, updates: Partial<Habit>) => {
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
    saveToStorage(get().habits);
  },

  /**
   * Acción: Archivar Hábito.
   */
  archiveHabit: (id: string) => {
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, activo: false } : h
      ),
    }));
    saveToStorage(get().habits);
  },

  /**
   * Acción: Eliminar Hábito.
   */
  removeHabit: (id: string) => {
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));
    saveToStorage(get().habits);
  },
}));

/**
 * Función auxiliar para guardar datos en AsyncStorage de forma manual.
 */
const saveToStorage = async (habits: Habit[]) => {
  try {
    const data = JSON.stringify({ state: { habits } });
    await AsyncStorage.setItem('habit-storage', data);
  } catch (error) {
    console.error('[HabitStore] Error al guardar en almacenamiento:', error);
  }
};

/**
 * Función para cargar los datos manualmente (hidratación).
 * Llamar a esta función al iniciar la aplicación o en el componente raíz.
 */
export const loadHabitsFromStorage = async () => {
  try {
    const data = await AsyncStorage.getItem('habit-storage');
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.state && parsed.state.habits) {
        useHabitStore.setState({ habits: parsed.state.habits });
      }
    }
  } catch (error) {
    console.error('[HabitStore] Error al cargar desde almacenamiento:', error);
  }
};
