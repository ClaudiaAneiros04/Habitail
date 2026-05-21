import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';
import { HabitRepository } from '../storage/HabitRepository';
import { scheduleHabitReminder, cancelHabitReminder } from '../notifications/notificationService';

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

    // Programar recordatorio si está activo y tiene hora de recordatorio
    const reminderTime = newHabit.horaRecordatorio || (newHabit as any).reminderTime;
    if (newHabit.activo && reminderTime) {
      await scheduleHabitReminder(newHabit);
    }
  },

  updateHabit: async (id: string, updates: Partial<Habit>) => {
    await habitRepo.update(id, updates);
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }));
    saveToStorage(get().habits);

    // Programar/actualizar o cancelar recordatorio
    const updatedHabit = get().habits.find((h) => h.id === id);
    if (updatedHabit) {
      const reminderTime = updatedHabit.horaRecordatorio || (updatedHabit as any).reminderTime;
      if (updatedHabit.activo && reminderTime) {
        await scheduleHabitReminder(updatedHabit);
      } else {
        await cancelHabitReminder(id);
      }
    }
  },

  archiveHabit: async (id: string) => {
    await habitRepo.archive(id);
    set((state) => ({
      habits: state.habits.map((h) =>
        h.id === id ? { ...h, activo: false } : h
      ),
    }));
    saveToStorage(get().habits);

    // Cancelar recordatorio programado al archivar
    await cancelHabitReminder(id);
  },

  removeHabit: async (id: string) => {
    // Nota: El repo debería tener un delete, pero si no, usamos update activo: false
    // Para borrar físicamente de SQLite si el repo no lo tiene (añadir si necesario)
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));
    saveToStorage(get().habits);

    // Cancelar recordatorio programado al remover
    await cancelHabitReminder(id);
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
            const rawHabits = parsed.state.habits;
            
            // Sanitizar los hábitos para asegurar que cumplen las restricciones NOT NULL de SQLite
            const sanitizedHabits = rawHabits.map((h: any) => ({
              id: h.id || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              }),
              userId: h.userId || 'default-user',
              nombre: h.nombre || 'Hábito sin nombre',
              descripcion: h.descripcion || null,
              categoria: h.categoria || 'General',
              icono: h.icono || 'leaf-outline',
              colorHex: h.colorHex || '#4CAF50',
              frecuencia: h.frecuencia || 'DAILY',
              diasSemana: Array.isArray(h.diasSemana) ? h.diasSemana : [0, 1, 2, 3, 4, 5, 6],
              horaRecordatorio: h.horaRecordatorio || null,
              tipoVerificacion: h.tipoVerificacion || 'BOOLEAN',
              nivelPrioridad: h.nivelPrioridad || 'NORMAL',
              fechaInicio: h.fechaInicio || new Date().toISOString(),
              fechaFin: h.fechaFin || null,
              activo: h.activo !== undefined ? Boolean(h.activo) : true,
            }));

            set({ habits: sanitizedHabits });

            // Guardar en SQLite de forma segura con try-catch individual por hábito
            for (const h of sanitizedHabits) {
              try {
                await habitRepo.save(h);
              } catch (dbError) {
                console.error(`[HabitStore] Error al guardar hábito migrado ${h.id} en SQLite:`, dbError);
              }
            }

            // Sincronizar los hábitos sanitizados de vuelta a AsyncStorage
            await saveToStorage(sanitizedHabits);
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
