import { HabitLog } from '../types';
import { getDb } from './database';

/**
 * Resultado compacto que devuelven las queries de estadísticas.
 * Solo contadores — nunca filas individuales — para mantener el uso de memoria
 * O(1) independientemente del historial del usuario.
 */
export interface PeriodStats {
  /** Número de días con al menos un log completado dentro del periodo. */
  totalCompleted: number;
  /**
   * Número de días calendario dentro del periodo en que el hábito ya existía.
   * Se calcula en SQL para evitar iterar fechas en TypeScript.
   */
  totalDays: number;
}

export interface ILogRepository {
  save(log: HabitLog): Promise<void>;
  deleteById(id: string): Promise<void>;
  getByHabit(habitId: string): Promise<HabitLog[]>;
  getByDate(fecha: string): Promise<HabitLog[]>;
  getLogsForRange(habitId: string, fromDate: string, toDate: string): Promise<HabitLog[]>;
  /**
   * Devuelve estadísticas agregadas (sin filas individuales) para un hábito
   * en un rango de fechas. Ideal para alimentar useHabitStats.
   */
  getStatsByPeriod(habitId: string, fromDate: string, toDate: string): Promise<PeriodStats>;
  /**
   * Versión global: agrega estadísticas para TODOS los hábitos de un usuario
   * en el rango de fechas indicado.
   */
  getGlobalStatsByPeriod(userId: string, fromDate: string, toDate: string): Promise<PeriodStats>;
  /**
   * Devuelve una fila por cada día que tenga al menos un log para el hábito,
   * con el valor de celda para el heatmap (1 = incumplido, 2 = completado).
   * Los días sin logs no aparecen — se rellenan con 0 en TypeScript.
   */
  getHeatmapForHabit(habitId: string, fromDate: string, toDate: string): Promise<HeatmapRawRow[]>;
  /**
   * Versión global: devuelve una fila por día con el estado agregado de todos
   * los hábitos del usuario. Valor 2 solo si todos los logs del día completaron.
   */
  getHeatmapGlobal(userId: string, fromDate: string, toDate: string): Promise<HeatmapRawRow[]>;
}

/**
 * Fila cruda devuelta por las queries de heatmap.
 * Solo contiene días con al menos un log (value 1 o 2).
 * Los días sin logs se rellenan con 0 en mergeHeatmapData (utils/heatmapUtils.ts).
 *
 * value:
 *   1 → log existente con completado = false (incumplido explícito)
 *   2 → log existente con completado = true  (completado)
 *
 * NOTA SOBRE LA SEMÁNTICA ACTUAL:
 * La app elimina los logs al desmarcar (en lugar de ponerlos a completado=false).
 * En la práctica, value=1 solo aparecerá si se persisten logs con completado=false
 * desde otras rutas de código. El contrato sigue siendo correcto para ambos casos.
 */
export interface HeatmapRawRow {
  /** Fecha en formato YYYY-MM-DD, extraída con DATE() en SQLite. */
  date: string;
  /** 1 = al menos un log incumplido ese día; 2 = todos los logs completados. */
  value: number; // number en runtime (SQLite), se castea a 1|2 en heatmapUtils
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

  /**
   * Retorna estadísticas de cumplimiento para un hábito concreto en un rango de fechas,
   * ejecutando la agregación íntegramente en SQLite.
   *
   * Por qué en SQL y no en TS:
   * - Un usuario activo puede acumular >3.000 logs/año por hábito.
   * - Traerlos todos a memoria para contar con Array.filter sería O(N) en RAM y tiempo.
   * - SQLite aplica el filtro y el COUNT usando el índice compuesto
   *   idx_habit_logs_habit_fecha, resultando en O(log N) sin allocar objetos JS.
   *
   * Sobre totalDays:
   * - La columna se calcula como la diferencia de días entre fromDate y toDate + 1,
   *   lo que representa el «universo» de días posibles del periodo.
   * - Esto es deliberadamente simple: la pantalla de stats muestra la completionRate
   *   respecto a los días del periodo, no solo los días en que el hábito debía hacerse.
   *   Si se necesitara calcular vs días de frecuencia activa, habría que cruzar con la
   *   tabla habits y aplicar lógica de diasSemana — complejidad que se reserva para
   *   una futura versión.
   *
   * @param habitId  - UUID del hábito.
   * @param fromDate - Fecha inicial del periodo, formato ISO 8601 YYYY-MM-DD.
   * @param toDate   - Fecha final del periodo, formato ISO 8601 YYYY-MM-DD.
   */
  async getStatsByPeriod(habitId: string, fromDate: string, toDate: string): Promise<PeriodStats> {
    const db = await getDb();

    // COUNT(DISTINCT fecha) evita que múltiples logs en el mismo día inflen el contador.
    // completado = 1 usa el valor numérico persistido; el índice (habitId, fecha) cubre
    // tanto el filtro WHERE como el ORDER BY implícito del COUNT.
    const row = await db.getFirstAsync<{ totalCompleted: number; totalDays: number }>(
      `SELECT
         COUNT(DISTINCT CASE WHEN completado = 1 THEN fecha END) AS totalCompleted,
         (CAST(julianday(?) AS INTEGER) - CAST(julianday(?) AS INTEGER) + 1) AS totalDays
       FROM habit_logs
       WHERE habitId = ?
         AND fecha >= ?
         AND fecha <= ?`,
      [toDate, fromDate, habitId, fromDate, toDate]
    );

    return {
      totalCompleted: row?.totalCompleted ?? 0,
      totalDays: row?.totalDays ?? 0,
    };
  }

  /**
   * Versión global de getStatsByPeriod: agrega los logs de todos los hábitos
   * de un usuario en el rango indicado.
   *
   * Se usa cuando useHabitStats se llama sin habitId (vista resumen global).
   * COUNT(DISTINCT fecha || '|' || habitId) cuenta combinaciones únicas de
   * (día, hábito) para no inflar el total con hábitos distintos en el mismo día.
   *
   * totalDays en la vista global representa la ventana de días del periodo,
   * independiente del número de hábitos activos (igual que getStatsByPeriod).
   *
   * @param userId   - UUID del usuario.
   * @param fromDate - Fecha inicial, formato ISO 8601 YYYY-MM-DD.
   * @param toDate   - Fecha final, formato ISO 8601 YYYY-MM-DD.
   */
  async getGlobalStatsByPeriod(userId: string, fromDate: string, toDate: string): Promise<PeriodStats> {
    const db = await getDb();

    const row = await db.getFirstAsync<{ totalCompleted: number; totalDays: number }>(
      `SELECT
         COUNT(DISTINCT CASE WHEN completado = 1 THEN fecha || '|' || habitId END) AS totalCompleted,
         (CAST(julianday(?) AS INTEGER) - CAST(julianday(?) AS INTEGER) + 1) AS totalDays
       FROM habit_logs
       WHERE userId = ?
         AND fecha >= ?
         AND fecha <= ?`,
      [toDate, fromDate, userId, fromDate, toDate]
    );

    return {
      totalCompleted: row?.totalCompleted ?? 0,
      totalDays: row?.totalDays ?? 0,
    };
  }

  /**
   * Devuelve las filas del heatmap para un hábito concreto en la ventana indicada.
   *
   * Diseño SQL:
   * - DATE(fecha) agrupa correctamente sin importar si 'fecha' lleva hora/timezone
   *   (ej: '2026-05-03T00:00:00+02:00'). SQLite convierte a la fecha del día UTC.
   *   Ver LEARNING.md — Fase 4 / Heatmap — caso borde de zona horaria.
   * - MAX(completado): si hay varios logs el mismo día (edge case), un solo completado=1
   *   hace que el día sea valor 2. Prioriza el éxito sobre el fallo.
   * - Índice usado: idx_habit_logs_habit_fecha(habitId, fecha) — SQLite puede filtrar
   *   por habitId en O(log N); el GROUP BY DATE(fecha) escanea solo filas de ese hábito.
   *
   * @param habitId  - UUID del hábito.
   * @param fromDate - Límite inferior YYYY-MM-DD (inclusivo).
   * @param toDate   - Límite superior YYYY-MM-DD (inclusivo).
   */
  async getHeatmapForHabit(habitId: string, fromDate: string, toDate: string): Promise<HeatmapRawRow[]> {
    const db = await getDb();

    // DATE(fecha) en WHERE: agnóstico a la hora almacenada en el campo.
    // Comparar DATE() con YYYY-MM-DD string funciona correctamente en SQLite.
    // No se puede aprovechar el índice al 100% con DATE() en WHERE, pero el
    // filtro por habitId sí reduce el escaneo al subconjunto del hábito.
    const rows = await db.getAllAsync<HeatmapRawRow>(
      `SELECT
         DATE(fecha) AS date,
         CASE WHEN MAX(completado) = 1 THEN 2 ELSE 1 END AS value
       FROM habit_logs
       WHERE habitId = ?
         AND DATE(fecha) >= ?
         AND DATE(fecha) <= ?
       GROUP BY DATE(fecha)
       ORDER BY DATE(fecha) ASC`,
      [habitId, fromDate, toDate]
    );

    return rows;
  }

  /**
   * Devuelve las filas del heatmap global para un usuario en la ventana indicada.
   *
   * Lógica de valor:
   * - MIN(completado) = 1 → todos los logs del día tienen completado=1 → value 2.
   * - MIN(completado) = 0 → al menos un log tiene completado=0 → value 1.
   *
   * LIMITACIÓN CONOCIDA (documentada en LEARNING.md):
   * Esta query solo evalúa días que TIENEN logs. No puede detectar si un hábito
   * activo no fue registrado ese día (porque no existe fila que consultar).
   * Un día sin logs de ningún hábito simplemente no aparecerá en el resultado,
   * y será rellenado con value=0 en mergeHeatmapData.
   *
   * Índice auxiliar: idx_habit_logs_user_fecha(userId, fecha) — añadido en database.ts.
   * Sin él, esta query haría full scan de toda la tabla por userId.
   *
   * @param userId   - UUID del usuario.
   * @param fromDate - Límite inferior YYYY-MM-DD (inclusivo).
   * @param toDate   - Límite superior YYYY-MM-DD (inclusivo).
   */
  async getHeatmapGlobal(userId: string, fromDate: string, toDate: string): Promise<HeatmapRawRow[]> {
    const db = await getDb();

    const rows = await db.getAllAsync<HeatmapRawRow>(
      `SELECT
         DATE(fecha) AS date,
         CASE WHEN MIN(completado) = 1 THEN 2 ELSE 1 END AS value
       FROM habit_logs
       WHERE userId = ?
         AND DATE(fecha) >= ?
         AND DATE(fecha) <= ?
       GROUP BY DATE(fecha)
       ORDER BY DATE(fecha) ASC`,
      [userId, fromDate, toDate]
    );

    return rows;
  }
}
