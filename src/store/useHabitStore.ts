import { create } from 'zustand';
import { Habit } from '../types';

interface HabitStore {
  habits: Habit[];
  loadHabits: () => Promise<void>;
  addHabit: (habit: Habit) => Promise<void>;
  updateHabit: (id: string, changes: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
}

export const useHabitStore = create<HabitStore>((set) => ({
  habits: [],
  loadHabits: async () => {
    // TODO Fase 1: cargar desde HabitRepository
  },
  addHabit: async (habit) => {
    set((state) => ({ habits: [...state.habits, habit] }));
    // TODO Fase 1: persistir con HabitRepository
  },
  updateHabit: async (id, changes) => {
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, ...changes } : h)),
    }));
  },
  archiveHabit: async (id) => {
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, activo: false } : h)),
    }));
  },
  removeHabit: async (id) => {
    set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
  },
}));