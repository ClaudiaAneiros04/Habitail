import { create } from 'zustand';
import { HabitLog } from '../types';
import { LogRepository } from '../storage/LogRepository';
import { toLogicalDate, getLogicalToday } from '../utils/dateUtils';
import { CacheInvalidationService } from '../services/cacheInvalidationService';

interface LogStore {
  /** Caché reactivo de logs de días consultados recientemente. No representa todo el historial histórico. */
  logs: HabitLog[];
  lastUpdate: number;
  addLog: (log: HabitLog) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  /**
   * Refresca los logs del día en el caché reactivo (por defecto, la fecha de hoy).
   * Garantiza que loadLogs realice una carga real y no sea un no-op ficticio.
   */
  loadLogs: (date?: string, userId?: string) => Promise<void>;
  getLogsForDay: (date: string, userId?: string) => Promise<HabitLog[]>;
}

const logRepo = new LogRepository();

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  lastUpdate: 0,

  addLog: async (log) => {
    await logRepo.upsert(log);
    set((state) => ({
      logs: [...state.logs.filter((l) => l.id !== log.id), log],
      lastUpdate: Date.now(),
    }));
    CacheInvalidationService.invalidateHabitCaches(log.habitId, log.userId);
  },

  /**
   * Elimina un log de la DB y del estado local.
   * Llamar cuando el usuario desmarca un hábito para que
   * el historial muestre NONE en lugar de FAILED (X roja).
   */
  deleteLog: async (logId) => {
    const existingLog = get().logs.find((l) => l.id === logId);
    await logRepo.deleteById(logId);
    set((state) => ({
      logs: state.logs.filter((l) => l.id !== logId),
      lastUpdate: Date.now(),
    }));
    CacheInvalidationService.invalidateHabitCaches(existingLog?.habitId, existingLog?.userId);
  },

  loadLogs: async (date?: string, userId?: string) => {
    const targetDate = date ? toLogicalDate(date) : getLogicalToday();
    await get().getLogsForDay(targetDate, userId);
  },

  getLogsForDay: async (date: string, userId?: string) => {
    const targetDate = toLogicalDate(date);
    const dayLogs = await logRepo.getByDate(targetDate, userId);

    set((state) => {
      // Elimina del caché TODOS los registros previamente cacheados de esa fecha (y usuario si aplica)
      // para evitar que sobrevivan en memoria logs eliminados externamente de la DB.
      const otherLogs = state.logs.filter(
        (l) => !(l.fecha === targetDate && (!userId || l.userId === userId))
      );
      return {
        logs: [...otherLogs, ...dayLogs],
        lastUpdate: Date.now(),
      };
    });

    return dayLogs;
  },
}));
