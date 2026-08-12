import * as SQLite from 'expo-sqlite';
import { Migration } from './types';
import { TABLE_NAMES } from '../schema';

/**
 * Migración v4: Añade la tabla habit_schedule_history para trackear cambios en la configuración de días/frecuencia.
 */
export const migrationV4: Migration = {
  version: 4,
  name: 'habit_schedule_history',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    // Crear tabla habit_schedule_history
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} (
        id TEXT PRIMARY KEY NOT NULL,
        habitId TEXT NOT NULL,
        frecuencia TEXT NOT NULL,
        diasSemana TEXT NOT NULL,
        validFrom TEXT NOT NULL,
        validUntil TEXT,
        FOREIGN KEY (habitId) REFERENCES ${TABLE_NAMES.HABITS} (id) ON DELETE CASCADE
      );
    `);

    // Crear índice para consultas rápidas por habitId
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_habit_schedule_history_habitId ON ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} (habitId);
    `);
    
    // Migrar los datos existentes: Para cada hábito actual, crear un registro inicial que abarque desde su fecha de inicio
    await db.execAsync(`
      INSERT INTO ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} (id, habitId, frecuencia, diasSemana, validFrom, validUntil)
      SELECT 
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) as id,
        id as habitId,
        frecuencia,
        diasSemana,
        fechaInicio as validFrom,
        NULL as validUntil
      FROM ${TABLE_NAMES.HABITS};
    `);
  },
};
