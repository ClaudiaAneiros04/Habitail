import AsyncStorage from '@react-native-async-storage/async-storage';
import { HabitLog } from '../db/schema';

const LOGS_STORAGE_KEY = '@habitail_logs';

export interface ILogRepository {
  save(log: HabitLog): Promise<void>;
  getByHabit(habitId: string): Promise<HabitLog[]>;
  getByDate(fecha: string): Promise<HabitLog[]>;
}

export class LogRepository implements ILogRepository {
  private async getAll(): Promise<HabitLog[]> {
    try {
      const data = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LogRepository] Error in getAll():', error);
      return [];
    }
  }

  async save(log: HabitLog): Promise<void> {
    const logs = await this.getAll();
    const existingIndex = logs.findIndex(l => l.id === log.id);
    if(existingIndex >= 0) {
      logs[existingIndex] = log; // Update if exists
    } else {
      logs.push(log);
    }
    await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  }

  async getByHabit(habitId: string): Promise<HabitLog[]> {
    const logs = await this.getAll();
    return logs.filter(log => log.habitId === habitId);
  }

  async getByDate(fecha: string): Promise<HabitLog[]> {
    const logs = await this.getAll();
    return logs.filter(log => log.fecha === fecha);
  }
}
