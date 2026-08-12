import { Habit, HabitScheduleHistory } from '../types';
import { getDb } from './database';
import { HabitRow, HabitScheduleHistoryRow } from '../db/schema';
import * as SQLite from 'expo-sqlite';

export interface IHabitRepository {
  get(): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  save(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  archive(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class HabitRepository implements IHabitRepository {
  private mapRowToHabit(row: HabitRow): Habit {
    return {
      ...row,
      descripcion: row.descripcion || undefined,
      horaRecordatorio: row.horaRecordatorio || undefined,
      fechaFin: row.fechaFin || undefined,
      diasSemana: JSON.parse(row.diasSemana),
      activo: Boolean(row.activo),
    } as Habit;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async syncScheduleHistory(db: SQLite.SQLiteDatabase, habit: Habit): Promise<void> {
    const activeRow = await db.getFirstAsync<HabitScheduleHistoryRow>(
      'SELECT * FROM habit_schedule_history WHERE habitId = ? AND validUntil IS NULL',
      [habit.id]
    );

    const now = new Date().toISOString();

    if (!activeRow) {
      await db.runAsync(
        'INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil) VALUES (?, ?, ?, ?, ?, ?)',
        [this.generateUUID(), habit.id, habit.frecuencia, JSON.stringify(habit.diasSemana), habit.fechaInicio || now, null]
      );
    } else {
      if (activeRow.frecuencia !== habit.frecuencia || activeRow.diasSemana !== JSON.stringify(habit.diasSemana)) {
        await db.runAsync(
          'UPDATE habit_schedule_history SET validUntil = ? WHERE id = ?',
          [now, activeRow.id]
        );
        await db.runAsync(
          'INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil) VALUES (?, ?, ?, ?, ?, ?)',
          [this.generateUUID(), habit.id, habit.frecuencia, JSON.stringify(habit.diasSemana), now, null]
        );
      }
    }
  }

  async get(): Promise<Habit[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits');
    const historyRows = await db.getAllAsync<HabitScheduleHistoryRow>('SELECT * FROM habit_schedule_history ORDER BY validFrom ASC');
    
    const historyMap = new Map<string, HabitScheduleHistory[]>();
    for (const hr of historyRows) {
      if (!historyMap.has(hr.habitId)) {
        historyMap.set(hr.habitId, []);
      }
      historyMap.get(hr.habitId)!.push({
        ...hr,
        diasSemana: JSON.parse(hr.diasSemana)
      } as HabitScheduleHistory);
    }

    return rows.map(row => {
      const habit = this.mapRowToHabit(row);
      habit.scheduleHistory = historyMap.get(habit.id) || [];
      return habit;
    });
  }

  async getById(id: string): Promise<Habit | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [id]);
    if (!row) return null;
    
    const habit = this.mapRowToHabit(row);
    const historyRows = await db.getAllAsync<HabitScheduleHistoryRow>('SELECT * FROM habit_schedule_history WHERE habitId = ? ORDER BY validFrom ASC', [id]);
    habit.scheduleHistory = historyRows.map(hr => ({
      ...hr,
      diasSemana: JSON.parse(hr.diasSemana)
    } as HabitScheduleHistory));
    
    return habit;
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
    await this.syncScheduleHistory(db, habit);
  }

  async update(id: string, changes: Partial<Habit>): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    
    // Updates the habit by merging fields and persisting again using INSERT OR REPLACE
    const updated = { ...current, ...changes };
    await this.save(updated);
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  }
}
