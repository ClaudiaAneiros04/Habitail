import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';
import { HabitRepository } from '../storage/HabitRepository';

const habitRepo = new HabitRepository();

interface HabitState {
  habits: Habit[];
  addHabit: (habitData: Omit<Habit, 'id'> & { id?: string }) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  loadHabits: () => Promise<void>;
}

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],

  addHabit: async (habitData) => {
    const newId = habitData.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    const newHabit: Habit = {
      ...habitData,
      id: newId,
    };

    await habitRepo.save(newHabit);
    set((state) => ({
      habits: [...state.habits, newHabit],
    }));
    saveToStorage(get().habits);
  },

  updateHabit: async (id: string, updates: Partial<Habit>) => {
    await habitRepo.update(id, updates);
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
    saveToStorage(get().habits);
  },

  archiveHabit: async (id: string) => {
    await habitRepo.archive(id);
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, activo: false } : h
      ),
    }));
    saveToStorage(get().habits);
  },

  removeHabit: async (id: string) => {
    // Nota: El repo debería tener un delete, pero si no, usamos update activo: false
    // Para borrar físicamente de SQLite si el repo no lo tiene (añadir si necesario)
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));
    saveToStorage(get().habits);
  },

  loadHabits: async () => {
    try {
      const dbHabits = await habitRepo.get();
      if (dbHabits.length > 0) {
        set({ habits: dbHabits });
      } else {
        // Migración/Fallback: intentar cargar de AsyncStorage
        const data = await AsyncStorage.getItem('habit-storage');
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.state && parsed.state.habits) {
            const habits = parsed.state.habits;
            set({ habits });
            // Guardar en SQLite para el futuro
            for (const h of habits) {
              await habitRepo.save(h);
            }
          }
        }
      }
    } catch (error) {
      console.error('[HabitStore] Error al cargar hábitos:', error);
    }
  }
}));

const saveToStorage = async (habits: Habit[]) => {
  try {
    const data = JSON.stringify({ state: { habits } });
    await AsyncStorage.setItem('habit-storage', data);
  } catch (error) {
    console.error('[HabitStore] Error al guardar en almacenamiento:', error);
  }
};
