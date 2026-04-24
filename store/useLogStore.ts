import { create } from 'zustand';
import { HabitLog } from '../types';
import { LogRepository } from '../storage/LogRepository';

interface LogStore {
  logs: HabitLog[];
  addLog: (log: HabitLog) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  loadLogs: () => Promise<void>;
  getLogsForDay: (date: string) => Promise<HabitLog[]>;
}

const logRepo = new LogRepository();

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  addLog: async (log) => {
    await logRepo.save(log);
    set((state) => ({ logs: [...state.logs.filter((l) => l.id !== log.id), log] }));
  },
  /**
   * Elimina un log de la DB y del estado local.
   * Llamar cuando el usuario desmarca un hábito para que
   * el historial muestre NONE en lugar de FAILED (X roja).
   */
  deleteLog: async (logId) => {
    await logRepo.deleteById(logId);
    set((state) => ({ logs: state.logs.filter((l) => l.id !== logId) }));
  },
  loadLogs: async () => {
    // Carga diferida: dependemos de getLogsForDay para consultas por día.
  },
  getLogsForDay: async (date: string) => {
    const dayLogs = await logRepo.getByDate(date);
    return dayLogs;
  },
}));

// Hydration al iniciar
useLogStore.getState().loadLogs();
