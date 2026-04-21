import { HabitLog } from '../types';
import { getDb } from './database';

export interface ILogRepository {
  save(log: HabitLog): Promise<void>;
  getByHabit(habitId: string): Promise<HabitLog[]>;
  getByDate(fecha: string): Promise<HabitLog[]>;
  getLogsForRange(habitId: string, fromDate: string, toDate: string): Promise<HabitLog[]>;
}

export class LogRepository implements ILogRepository {
  private mapRowToLog(row: any): HabitLog {
    return {
      ...row,
      completado: Boolean(row.completado),
    };
  }

  async save(log: HabitLog): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO habit_logs 
      (id, habitId, userId, fecha, completado, valor, nota, timestampRegistro) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.habitId,
        log.userId,
        log.fecha,
        log.completado ? 1 : 0,
        log.valor !== undefined ? log.valor : null,
        log.nota || null,
        log.timestampRegistro
      ]
    );
  }

  async getByHabit(habitId: string): Promise<HabitLog[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM habit_logs WHERE habitId = ?', [habitId]);
    return rows.map(this.mapRowToLog);
  }

  async getByDate(fecha: string): Promise<HabitLog[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM habit_logs WHERE fecha = ?', [fecha]);
    return rows.map(this.mapRowToLog);
  }

  async getLogsForRange(habitId: string, fromDate: string, toDate: string): Promise<HabitLog[]> {
    const db = await getDb();
    // Query optimized by fetching between two dates. Ideal for range views.
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM habit_logs WHERE habitId = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha ASC', 
      [habitId, fromDate, toDate]
    );
    return rows.map(this.mapRowToLog);
  }
}
