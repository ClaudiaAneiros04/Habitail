import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../db/schema';

const HABITS_STORAGE_KEY = '@habitail_habits';

export interface IHabitRepository {
  get(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  save(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  archive(id: string): Promise<void>;
}

export class HabitRepository implements IHabitRepository {
  async get(): Promise<Habit[]> {
    try {
      const data = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[HabitRepository] Error in get():', error);
      return [];
    }
  }

  async getById(id: string): Promise<Habit | null> {
    const habits = await this.get();
    return habits.find((h) => h.id === id) || null;
  }

  async save(habit: Habit): Promise<void> {
    const habits = await this.get();
    const existingIndex = habits.findIndex(h => h.id === habit.id);
    if(existingIndex >= 0) {
      habits[existingIndex] = habit; // Update if exists
    } else {
      habits.push(habit);
    }
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  }

  async update(id: string, changes: Partial<Habit>): Promise<void> {
    const habits = await this.get();
    const updated = habits.map((h) => 
      h.id === id ? { ...h, ...changes } : h
    );
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(updated));
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }
}
