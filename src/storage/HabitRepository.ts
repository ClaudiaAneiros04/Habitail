import { Habit } from '../types';

// En Fase 1 esto conectará con SQLite.
// Por ahora es el esqueleto del contrato.
export interface IHabitRepository {
  get(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  save(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  archive(id: string): Promise<void>;
}

// Implementación en memoria para Fase 0 (se reemplaza en Fase 1 con SQLite)
export class InMemoryHabitRepository implements IHabitRepository {
  private habits: Habit[] = [];

  async get(): Promise<Habit[]> {
    return this.habits.filter((h) => h.activo);
  }

  async getById(id: string): Promise<Habit | null> {
    return this.habits.find((h) => h.id === id) ?? null;
  }

  async save(habit: Habit): Promise<void> {
    this.habits.push(habit);
  }

  async update(id: string, changes: Partial<Habit>): Promise<void> {
    this.habits = this.habits.map((h) => (h.id === id ? { ...h, ...changes } : h));
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }
}