import * as SQLite from 'expo-sqlite';
import { Migration } from './types';

export const migrationV5: Migration = {
  version: 5,
  name: 'habit_logs_unique_constraint',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    // 1. Manejar de forma segura posibles duplicados históricos,
    // considerando que las fechas pueden venir en formato ISO/timestamp (con hora)
    // o ya normalizadas (YYYY-MM-DD). Al normalizar a substr(fecha, 1, 10), dos registros
    // del mismo hábito en el mismo día colisionarían al crear el índice único o al normalizar.
    // Prioridad determinista para conservar información relevante:
    // 1) completado = 1 (si el usuario completó el hábito ese día, conservamos el cumplimiento)
    // 2) timestampRegistro DESC (el registro más reciente)
    // 3) id DESC (desempate determinista)
    await db.execAsync(`
      WITH RankedLogs AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY habitId, CASE 
            WHEN length(fecha) >= 10 THEN substr(fecha, 1, 10) 
            ELSE fecha 
          END
          ORDER BY completado DESC, timestampRegistro DESC, id DESC
        ) as rn
        FROM habit_logs
      )
      DELETE FROM habit_logs 
      WHERE id IN (
        SELECT id FROM RankedLogs WHERE rn > 1
      );
    `);

    // 2. Drop del índice no único antiguo (si existe) y creación del nuevo UNIQUE
    await db.execAsync(`
      DROP INDEX IF EXISTS idx_habit_logs_habit_fecha;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);
    `);
  },
};
