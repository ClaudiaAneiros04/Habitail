import { create } from 'zustand';
import { HabitLog } from '../types';
import { LogRepository } from '../storage/LogRepository';

interface LogStore {
  logs: HabitLog[];
  addLog: (log: HabitLog) => Promise<void>;
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
  loadLogs: async () => {
    // Para simplificar, podríamos cargar todo, o depender de getLogsForDay.
    // Depende del uso en la app, cargaremos todo si es necesario, o nada inicial.
  },
  getLogsForDay: async (date: string) => {
    const dayLogs = await logRepo.getByDate(date);
    return dayLogs;
  },
}));

// Hydration al iniciar
useLogStore.getState().loadLogs();
