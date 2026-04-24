import { HabitLog } from '../types';
import { getDb } from './database';

export interface ILogRepository {
  save(log: HabitLog): Promise<void>;
  deleteById(id: string): Promise<void>;
  getByHabit(habitId: string): Promise<HabitLog[]>;
  getByDate(fecha: string): Promise<HabitLog[]>;
  getLogsForRange(habitId: string, fromDate: string, toDate: string): Promise<HabitLog[]>;
}

export class LogRepository implements ILogRepository {
  /**
   * Convierte una fila raw de SQLite al modelo tipado HabitLog.
   * IMPORTANTE: expo-sqlite en web (wa-sqlite/WASM) puede devolver
   * columnas INTEGER como strings ("0"/"1"). Boolean("0") === true en JS
   * porque es un string no vacío, lo que invertiría el estado de 'completado'.
   * Se usa Number() para normalizar cualquier tipo (0, 1, "0", "1", true, false)
   * antes de la comparación estricta.
   */
  private mapRowToLog(row: any): HabitLog {
    return {
      ...row,
      completado: Number(row.completado) === 1,
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
        log.completado === true ? 1 : 0, // Cast explícito: evita que valores truthy no-boolean se guarden como 1
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

  /**
   * Elimina un log por su ID.
   * Se usa cuando el usuario desmarca un hábito: la semántica correcta es
   * "sin registro" (NONE), no "incumplido" (FAILED). Si guardáramos un log
   * con completado=false, el historial mostraría una X roja incorrectamente.
   */
  async deleteById(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM habit_logs WHERE id = ?', [id]);
  }

  async getByDate(fecha: string): Promise<HabitLog[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>('SELECT * FROM habit_logs WHERE fecha = ?', [fecha]);
    return rows.map(this.mapRowToLog);
  }

  /**
   * Obtiene todos los registros (logs) de un hábito dentro de un rango de fechas.
   * Es fundamental que 'fromDate' y 'toDate' se proporcionen en un formato de texto 
   * consistente y ordenable léxicamente, como ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss.sssZ).
   * Utilizar formatos ISO asegura que operadores de comparación (>= y <=) en SQLite
   * funcionen correctamente de forma alfanumérica.
   * 
   * @param habitId - El ID único del hábito (UUID).
   * @param fromDate - Límite inferior del rango de fechas (ISO 8601 string).
   * @param toDate - Límite superior del rango de fechas (ISO 8601 string).
   * @returns Un array de HabitLog ordenado cronológicamente según la fecha.
   */
  async getLogsForRange(habitId: string, fromDate: string, toDate: string): Promise<HabitLog[]> {
    const db = await getDb();
    
    // Esta consulta es altamente eficiente gracias al índice compuesto: 
    // CREATE INDEX idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha).
    // SQLite filtrará en tiempo logarítmico el habitId, luego el rango de 'fecha', 
    // y extraerá los registros en orden (ORDER BY fecha ASC) utilizando el propio índice B-Tree,
    // evitando una operación de ordenamiento en memoria.
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM habit_logs WHERE habitId = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha ASC', 
      [habitId, fromDate, toDate]
    );
    
    // Mapea la base de datos cruda al modelo tipado resolviendo booleanos y otros casteos
    return rows.map(this.mapRowToLog);
  }
}
