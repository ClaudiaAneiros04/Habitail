import { HabitLog } from '../db/schema';
import { getDb } from './database';

export interface ILogRepository {
  save(log: HabitLog): Promise<void>;
  getByHabit(habitId: string): Promise<HabitLog[]>;
  getByDate(fecha: string): Promise<HabitLog[]>;
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
      (id, habitId, userId, fecha, completado, nota, timestampRegistro) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.habitId,
        log.userId,
        log.fecha,
        log.completado ? 1 : 0,
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
}
