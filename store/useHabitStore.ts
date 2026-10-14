import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';
import { HabitRepository } from '../storage/HabitRepository';
import { scheduleHabitReminder, cancelHabitReminder } from '../notifications/notificationService';
import { toLogicalDate, getLogicalToday } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';
import { CacheInvalidationService } from '../services/cacheInvalidationService';
import { useUserStore } from './useUserStore';
import { useLogStore } from './useLogStore';

const habitRepo = new HabitRepository();
const HABIT_MIGRATION_KEY = '@habit_storage_migrated';

interface HabitState {
  habits: Habit[];
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  addHabit: (habitData: Omit<Habit, 'id'> & { id?: string }) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  loadHabits: (userId?: string) => Promise<void>;
}

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  notificationsEnabled: true,

  setNotificationsEnabled: (enabled: boolean) => {
    set({ notificationsEnabled: enabled });
  },

  addHabit: async (habitData) => {
    const newId = habitData.id || generateUUID();
    const targetUserId = habitData.userId || useUserStore.getState().user?.id || 'default-user';

    const newHabit: Habit = {
      ...habitData,
      id: newId,
      userId: targetUserId,
      fechaInicio: toLogicalDate(habitData.fechaInicio || getLogicalToday()),
      fechaFin: habitData.fechaFin ? toLogicalDate(habitData.fechaFin) : undefined,
    };

    await habitRepo.create(newHabit);
    // Hidratar la entidad completa generada en SQLite, incluyendo su scheduleHistory
    const persistedHabit = await habitRepo.getById(newId);

    set((state) => ({
      habits: [...state.habits.filter((h) => h.id !== newId), persistedHabit || newHabit],
    }));

    // Invalida cachés (crear un hábito modifica el denominador de estadísticas y heatmap)
    CacheInvalidationService.invalidateHabitCaches(newId);

    // Programar recordatorio si está activo, tiene hora de recordatorio y las notificaciones están habilitadas
    const reminderTime = newHabit.horaRecordatorio || (newHabit as any).reminderTime;
    if (get().notificationsEnabled && newHabit.activo && reminderTime) {
      await scheduleHabitReminder(persistedHabit || newHabit);
    }
  },

  updateHabit: async (id: string, updates: Partial<Habit>) => {
    await habitRepo.update(id, updates);
    // Hidratar la entidad completa desde SQLite asegurando que contenga scheduleHistory actualizado
    const updatedFromDb = await habitRepo.getById(id);
    if (!updatedFromDb) return;

    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? updatedFromDb : h)),
    }));

    // Invalida cachés de estadísticas y heatmap (editar frecuencia, días, fechas o reactivar)
    CacheInvalidationService.invalidateHabitCaches(id);

    // Programar/actualizar o cancelar recordatorio si las notificaciones están habilitadas
    const reminderTime = updatedFromDb.horaRecordatorio || (updatedFromDb as any).reminderTime;
    if (get().notificationsEnabled && updatedFromDb.activo && reminderTime) {
      await scheduleHabitReminder(updatedFromDb);
    } else if (get().notificationsEnabled) {
      await cancelHabitReminder(id);
    }
  },

  archiveHabit: async (id: string) => {
    await habitRepo.archive(id);
    // Hidratar la entidad actualizada desde SQLite
    const archivedFromDb = await habitRepo.getById(id);
    if (!archivedFromDb) return;

    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? archivedFromDb : h)),
    }));

    // Invalida cachés de estadísticas y heatmap (archivar modifica el total de hábitos activos)
    CacheInvalidationService.invalidateHabitCaches(id);

    if (get().notificationsEnabled) {
      await cancelHabitReminder(id);
    }
  },

  removeHabit: async (id: string) => {
    await habitRepo.delete(id);
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));

    if (get().notificationsEnabled) {
      await cancelHabitReminder(id);
    }

    // Limpiar logs en memoria asociados al hábito eliminado
    useLogStore.setState((state) => ({
      logs: state.logs.filter((l) => l.habitId !== id),
      lastUpdate: Date.now(),
    }));

    // Invalida cachés de estadísticas y heatmap
    CacheInvalidationService.invalidateHabitCaches(id);
  },

  loadHabits: async (userId?: string) => {
    try {
      const targetUserId = userId || useUserStore.getState().user?.id || 'default-user';
      let dbHabits = await habitRepo.get(targetUserId);

      // Comprobar si ya se realizó la migración one-shot desde AsyncStorage
      const migrationDone = await AsyncStorage.getItem(HABIT_MIGRATION_KEY);

      if (!migrationDone && dbHabits.length === 0) {
        // Verificar que SQLite está realmente vacío antes de importar
        const allHabitsInDb = await habitRepo.get();
        if (allHabitsInDb.length === 0) {
          const legacyData = await AsyncStorage.getItem('habit-storage');
          if (legacyData) {
            try {
              const parsed = JSON.parse(legacyData);
              const rawHabits = parsed?.state?.habits;

              if (Array.isArray(rawHabits) && rawHabits.length > 0) {
                const sanitizedHabits: Habit[] = rawHabits.map((h: any) => ({
                  id: h.id || generateUUID(),
                  userId: h.userId || targetUserId,
                  nombre: h.nombre || 'Hábito sin nombre',
                  descripcion: h.descripcion || undefined,
                  categoria: h.categoria || 'General',
                  icono: h.icono || 'leaf-outline',
                  colorHex: h.colorHex || '#4CAF50',
                  frecuencia: h.frecuencia || 'DAILY',
                  diasSemana: Array.isArray(h.diasSemana) ? h.diasSemana : [0, 1, 2, 3, 4, 5, 6],
                  horaRecordatorio: h.horaRecordatorio || undefined,
                  tipoVerificacion: h.tipoVerificacion || 'BOOLEAN',
                  nivelPrioridad: h.nivelPrioridad || 'NORMAL',
                  fechaInicio: toLogicalDate(h.fechaInicio || getLogicalToday()),
                  fechaFin: h.fechaFin ? toLogicalDate(h.fechaFin) : undefined,
                  activo: h.activo !== undefined ? Boolean(h.activo) : true,
                }));

                for (const h of sanitizedHabits) {
                  try {
                    await habitRepo.upsert(h);
                  } catch (dbError) {
                    console.error(`[HabitStore] Error al guardar hábito migrado ${h.id} en SQLite:`, dbError);
                  }
                }

                // Recargar desde SQLite las entidades completamente hidratadas
                dbHabits = await habitRepo.get(targetUserId);
              }
            } catch (parseError) {
              console.error('[HabitStore] Error al procesar datos heredados de habit-storage:', parseError);
            }
          }
        }
        // Marcar la migración como realizada y descartar habit-storage de AsyncStorage
        await AsyncStorage.setItem(HABIT_MIGRATION_KEY, 'true');
        await AsyncStorage.removeItem('habit-storage');
      }

      set({ habits: dbHabits });
    } catch (error) {
      console.error('[HabitStore] Error al cargar hábitos:', error);
    }
  },
}));
