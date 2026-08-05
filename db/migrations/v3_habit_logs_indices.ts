import * as SQLite from 'expo-sqlite';
import { TABLE_NAMES } from '../schema';
import { Migration } from './types';

/**
 * Migración v3: Agrega índices compuestos optimizados para habit_logs
 * cubriendo consultas por hábito/completado y usuario/completado.
 */
export const migrationV3: Migration = {
  version: 3,
  name: 'add_habit_logs_composite_indices',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_completado_fecha 
      ON ${TABLE_NAMES.HABIT_LOGS} (habitId, completado, fecha);

      CREATE INDEX IF NOT EXISTS idx_habit_logs_user_completado_fecha 
      ON ${TABLE_NAMES.HABIT_LOGS} (userId, completado, fecha);
    `);
  },
};
