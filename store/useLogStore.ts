import { create } from 'zustand';
import { HabitLog } from '../types';
import { LogRepository } from '../storage/LogRepository';
import { useStatsStore } from './useStatsStore';
import { useHeatmapStore } from './useHeatmapStore';

interface LogStore {
  logs: HabitLog[];
  lastUpdate: number;
  addLog: (log: HabitLog) => Promise<void>;
  deleteLog: (logId: string) => Promise<void>;
  loadLogs: () => Promise<void>;
  getLogsForDay: (date: string) => Promise<HabitLog[]>;
}

const logRepo = new LogRepository();

export const useLogStore = create<LogStore>((set, get) => ({
  logs: [],
  lastUpdate: 0,
  addLog: async (log) => {
    await logRepo.save(log);
    set((state) => ({ 
      logs: [...state.logs.filter((l) => l.id !== log.id), log],
      lastUpdate: Date.now()
    }));
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();
  },
  /**
   * Elimina un log de la DB y del estado local.
   * Llamar cuando el usuario desmarca un hábito para que
   * el historial muestre NONE en lugar de FAILED (X roja).
   */
  deleteLog: async (logId) => {
    await logRepo.deleteById(logId);
    set((state) => ({ 
      logs: state.logs.filter((l) => l.id !== logId),
      lastUpdate: Date.now()
    }));
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();
  },
  loadLogs: async () => {
    // Carga diferida: dependemos de getLogsForDay para consultas por día.
  },
  getLogsForDay: async (date: string) => {
    const dayLogs = await logRepo.getByDate(date);
    set((state) => {
      const dayLogIds = new Set(dayLogs.map((l) => l.id));
      const otherLogs = state.logs.filter((l) => !dayLogIds.has(l.id));
      return { logs: [...otherLogs, ...dayLogs] };
    });
    return dayLogs;
  },
}));

// Hydration al iniciar
useLogStore.getState().loadLogs();
