import * as SQLite from 'expo-sqlite';
import { Migration } from './types';

export const migrationV5: Migration = {
  version: 5,
  name: 'habit_logs_unique_constraint',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    // 1. Manejar de forma segura posibles duplicados históricos,
    // conservando de forma determinista el registro válido más reciente.
    // Usamos ROW_NUMBER() OVER (...) para quedarnos con el último.
    await db.execAsync(`
      WITH RankedLogs AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY habitId, fecha
          ORDER BY timestampRegistro DESC, id DESC
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
