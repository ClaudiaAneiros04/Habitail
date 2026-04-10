import { Habit } from '../types';
import { getDb } from './database';

export interface IHabitRepository {
  get(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  save(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  archive(id: string): Promise<void>;
}

export class HabitRepository implements IHabitRepository {
  private mapRowToHabit(row: any): Habit {
    return {
      ...row,
      diasSemana: JSON.parse(row.diasSemana),
      activo: Boolean(row.activo),
    };
  }

  async get(): Promise<Habit[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM habits');
    return rows.map(this.mapRowToHabit);
  }

  async getById(id: string): Promise<Habit | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM habits WHERE id = ?', [id]);
    return row ? this.mapRowToHabit(row) : null;
  }

  async save(habit: Habit): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO habits 
      (id, userId, nombre, descripcion, categoria, icono, colorHex, frecuencia, diasSemana, horaRecordatorio, tipoVerificacion, nivelPrioridad, fechaInicio, fechaFin, activo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        habit.id,
        habit.userId,
        habit.nombre,
        habit.descripcion || null,
        habit.categoria,
        habit.icono,
        habit.colorHex,
        habit.frecuencia,
        JSON.stringify(habit.diasSemana),
        habit.horaRecordatorio || null,
        habit.tipoVerificacion,
        habit.nivelPrioridad,
        habit.fechaInicio,
        habit.fechaFin || null,
        habit.activo ? 1 : 0
      ]
    );
  }

  async update(id: string, changes: Partial<Habit>): Promise<void> {
    const db = await getDb();
    const current = await this.getById(id);
    if (!current) return;
    
    // Updates the habit by merging fields and persisting again using INSERT OR REPLACE
    const updated = { ...current, ...changes };
    await this.save(updated);
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }
}
