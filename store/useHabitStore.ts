import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../types';
import { HabitRepository } from '../storage/HabitRepository';
import { 
  scheduleHabitReminder, 
  cancelHabitReminder, 
  cancelAllHabitReminders, 
  rescheduleAllHabitNotifications, 
  hasNotificationPermissionSilently 
} from '../notifications/notificationService';
import { toLogicalDate, getLogicalToday, compareLogicalDates } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';
import { CacheInvalidationService } from '../services/cacheInvalidationService';
import { parseSqliteBoolean } from '../utils/booleanUtils';
import { useUserStore } from './useUserStore';
import { useLogStore } from './useLogStore';

export const habitRepo = new HabitRepository();
export const HABIT_MIGRATION_KEY = '@habit_storage_migrated';
export const LEGACY_HABIT_STORAGE_KEY = 'habit-storage';
export const USER_NOTIFICATIONS_PREF_KEY = '@habitail_user_notifications_enabled';

interface HabitState {
  habits: Habit[];
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  loadNotificationPreference: () => Promise<boolean>;
  addHabit: (habitData: Omit<Habit, 'id'> & { id?: string }) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  loadHabits: (userId?: string, repository?: HabitRepository) => Promise<void>;
}

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  notificationsEnabled: true,

  loadNotificationPreference: async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_NOTIFICATIONS_PREF_KEY);
      if (stored !== null) {
        const isEnabled = stored === 'true';
        set({ notificationsEnabled: isEnabled });
        return isEnabled;
      }
    } catch (error) {
      console.warn('[HabitStore] Error al cargar preferencia de notificaciones:', error);
    }
    return get().notificationsEnabled;
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    set({ notificationsEnabled: enabled });
    try {
      await AsyncStorage.setItem(USER_NOTIFICATIONS_PREF_KEY, String(enabled));
    } catch (error) {
      console.warn('[HabitStore] Error al guardar preferencia de notificaciones:', error);
    }

    if (!enabled) {
      // Si el usuario desactiva las notificaciones, cancelamos todos los recordatorios de hábitos
      // de forma limpia sin importar el estado de permisos del SO
      await cancelAllHabitReminders();
    } else {
      // Si el usuario las activa, reprogramamos si el SO tiene permisos otorgados
      const hasPermission = await hasNotificationPermissionSilently();
      if (hasPermission) {
        await rescheduleAllHabitNotifications(get().habits);
      }
    }
  },

  addHabit: async (habitData) => {
    const today = getLogicalToday();
    const habitStartDate = toLogicalDate(habitData.fechaInicio || today);

    // Regla 1 de Dominio: ningún hábito nuevo puede crearse con una fecha de inicio anterior al día actual
    if (compareLogicalDates(habitStartDate, today) < 0) {
      throw new Error(`Cannot create habit with a start date earlier than today: ${habitStartDate} < ${today}`);
    }

    const newId = habitData.id || generateUUID();
    const targetUserId = habitData.userId || useUserStore.getState().user?.id || 'default-user';

    const newHabit: Habit = {
      ...habitData,
      id: newId,
      userId: targetUserId,
      fechaInicio: habitStartDate,
      fechaFin: habitData.fechaFin ? toLogicalDate(habitData.fechaFin) : undefined,
    };

    await habitRepo.create(newHabit);
    // Hidratar la entidad completa generada en SQLite, incluyendo su scheduleHistory
    const persistedHabit = await habitRepo.getById(newId);

    set((state) => ({
      habits: [...state.habits.filter((h) => h.id !== newId), persistedHabit || newHabit],
    }));

    // Invalida cachés (crear un hábito modifica el denominador de estadísticas y heatmap)
    CacheInvalidationService.invalidateHabitCaches(newId, targetUserId);

    // Programar recordatorio si está activo, tiene hora de recordatorio y las notificaciones están habilitadas
    const reminderTime = newHabit.horaRecordatorio || (newHabit as any).reminderTime;
    if (get().notificationsEnabled && newHabit.activo && reminderTime) {
      await scheduleHabitReminder(persistedHabit || newHabit);
    }
  },

  updateHabit: async (id: string, updates: Partial<Habit>) => {
    const existing = get().habits.find(h => h.id === id);
    if (existing && updates.fechaInicio) {
      const newStartDate = toLogicalDate(updates.fechaInicio);
      const originalStartDate = toLogicalDate(existing.fechaInicio);
      // Regla de Dominio: cuando se edita un hábito existente, no debe poder cambiarse
      // su fecha de inicio a una fecha anterior a la original para evitar generar cumplimientos retroactivos.
      if (compareLogicalDates(newStartDate, originalStartDate) < 0) {
        throw new Error(`Cannot change habit start date to an earlier date than original: ${newStartDate} < ${originalStartDate}`);
      }
    }

    await habitRepo.update(id, updates);
    // Hidratar la entidad completa desde SQLite asegurando que contenga scheduleHistory actualizado
    const updatedFromDb = await habitRepo.getById(id);
    if (!updatedFromDb) return;

    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? updatedFromDb : h)),
    }));

    // Invalida cachés de estadísticas y heatmap (editar frecuencia, días, fechas o reactivar)
    CacheInvalidationService.invalidateHabitCaches(id, updatedFromDb.userId);

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
    CacheInvalidationService.invalidateHabitCaches(id, archivedFromDb.userId);

    if (get().notificationsEnabled) {
      await cancelHabitReminder(id);
    }
  },

  removeHabit: async (id: string) => {
    const habitToDelete = get().habits.find(h => h.id === id);
    const habitUserId = habitToDelete?.userId;

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
    CacheInvalidationService.invalidateHabitCaches(id, habitUserId);
  },

  loadHabits: async (userId?: string, repository: HabitRepository = habitRepo) => {
    try {
      const targetUserId = userId || useUserStore.getState().user?.id || 'default-user';

      // 1. Cargar preferencia persistente de notificaciones del usuario
      await get().loadNotificationPreference();

      // 2. Ejecutar proceso de migración seguro desde AsyncStorage a SQLite si procede
      await migrateLegacyHabits(targetUserId, repository);

      // 3. Cargar hábitos completamente hidratados desde SQLite para el usuario
      const dbHabits = await repository.get(targetUserId);

      set({ habits: dbHabits });
    } catch (error) {
      console.error('[HabitStore] Error al cargar hábitos:', error);
    }
  },
}));

let migrationInProgressPromise: Promise<{ migratedCount: number; success: boolean }> | null = null;

/**
 * Ejecuta la migración segura desde AsyncStorage a SQLite:
 * 1. Comprueba si la migración ya se completó previamente.
 * 2. Si no hay datos antiguos o es una instalación nueva, marca como completada sin borrar nada.
 * 3. Si hay datos, los deserializa y sanitiza conservando IDs originales, usuario y todos los campos.
 * 4. Inserta/actualiza todos los hábitos en una única transacción SQLite atómica.
 * 5. Verifica que todos los hábitos existen en SQLite antes de completar.
 * 6. Solo si la verificación es exitosa, marca como completada y remueve habit-storage de AsyncStorage.
 * 7. Si falla cualquier hábito o paso, NO elimina AsyncStorage y la transacción de SQLite se revierte.
 */
export const migrateLegacyHabits = async (
  targetUserId: string,
  repo: HabitRepository = habitRepo
): Promise<{ migratedCount: number; success: boolean }> => {
  if (migrationInProgressPromise) {
    return migrationInProgressPromise;
  }

  migrationInProgressPromise = (async () => {
    try {
      // Comprobar si ya se realizó la migración one-shot previamente
      const migrationDone = await AsyncStorage.getItem(HABIT_MIGRATION_KEY);
      if (migrationDone === 'true') {
        return { migratedCount: 0, success: true };
      }

      const legacyData = await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY);
      if (!legacyData) {
        // Instalación nueva o sin información previa en AsyncStorage:
        // Se marca como migrada de forma segura sin eliminar nada
        await AsyncStorage.setItem(HABIT_MIGRATION_KEY, 'true');
        return { migratedCount: 0, success: true };
      }

      let rawHabits: any[] = [];
      try {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed)) {
          rawHabits = parsed;
        } else if (parsed && Array.isArray(parsed?.state?.habits)) {
          rawHabits = parsed.state.habits;
        }
      } catch (parseError) {
        console.error('[HabitMigration] Error crítico al deserializar JSON de habit-storage:', parseError);
        // Garantía absoluta: NO marcar migración y NO eliminar habit-storage para evitar pérdida permanente
        return { migratedCount: 0, success: false };
      }

      if (!Array.isArray(rawHabits) || rawHabits.length === 0) {
        // Datos heredados presentes pero vacíos: marcar como completado y limpiar clave obsoleta
        await AsyncStorage.setItem(HABIT_MIGRATION_KEY, 'true');
        await AsyncStorage.removeItem(LEGACY_HABIT_STORAGE_KEY);
        return { migratedCount: 0, success: true };
      }

      // Sanitizar conservando identificadores originales, usuario y todos los campos
      const sanitizedHabits: Habit[] = rawHabits.map((h: any) => ({
        id: h.id || generateUUID(),
        userId: h.userId || targetUserId,
        nombre: h.nombre || h.name || 'Hábito sin nombre',
        descripcion: h.descripcion !== undefined ? h.descripcion : (h.description !== undefined ? h.description : undefined),
        categoria: h.categoria || h.category || 'General',
        icono: h.icono || h.icon || 'leaf-outline',
        colorHex: h.colorHex || h.color || '#4CAF50',
        frecuencia: h.frecuencia || h.frequency || 'DAILY',
        diasSemana: Array.isArray(h.diasSemana)
          ? h.diasSemana
          : (Array.isArray(h.daysOfWeek) ? h.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]),
        horaRecordatorio: h.horaRecordatorio || h.reminderTime || undefined,
        tipoVerificacion: h.tipoVerificacion || h.verificationType || 'BOOLEAN',
        nivelPrioridad: h.nivelPrioridad || h.priority || 'NORMAL',
        fechaInicio: toLogicalDate(h.fechaInicio || h.startDate || getLogicalToday()),
        fechaFin: (h.fechaFin || h.endDate) ? toLogicalDate(h.fechaFin || h.endDate) : undefined,
        activo: h.activo !== undefined
          ? parseSqliteBoolean(h.activo)
          : (h.active !== undefined ? parseSqliteBoolean(h.active) : true),
        // Preservar propiedades adicionales si existían
        name: h.name || h.nombre || undefined,
        reminderTime: h.reminderTime || h.horaRecordatorio || undefined,
        completedDays: Array.isArray(h.completedDays) ? h.completedDays : undefined,
      }));

      // 1. Ejecutar la migración atómica en una única transacción SQLite (upsert idempotente)
      await repo.upsertMany(sanitizedHabits);

      // 2. Verificación estricta posterior: confirmar que todos los IDs existen en SQLite
      const habitIds = sanitizedHabits.map((h) => h.id);
      const isVerified = await repo.verifyHabitsExist(habitIds);

      if (!isVerified) {
        throw new Error(
          `[HabitMigration] Verificación fallida: no todos los ${sanitizedHabits.length} hábitos fueron confirmados en SQLite.`
        );
      }

      // 3. Solo cuando la verificación es 100% exitosa:
      // Se marca la migración como completada y se elimina habit-storage de AsyncStorage
      await AsyncStorage.setItem(HABIT_MIGRATION_KEY, 'true');
      await AsyncStorage.removeItem(LEGACY_HABIT_STORAGE_KEY);

      return { migratedCount: sanitizedHabits.length, success: true };
    } catch (migrationError) {
      console.error('[HabitMigration] Error durante la migración de hábitos desde AsyncStorage a SQLite:', migrationError);
      // Garantía absoluta: NUNCA se elimina habit-storage ni se marca migrationDone si falló algún paso
      return { migratedCount: 0, success: false };
    } finally {
      migrationInProgressPromise = null;
    }
  })();

  return migrationInProgressPromise;
};
