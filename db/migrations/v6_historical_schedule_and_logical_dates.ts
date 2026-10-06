import * as SQLite from 'expo-sqlite';
import { Migration } from './types';
import { TABLE_NAMES } from '../schema';

/**
 * Migración v6: Soporte para historial completo con estado activo/archivado
 * y normalización estricta a LogicalDate (YYYY-MM-DD).
 */
export const migrationV6: Migration = {
  version: 6,
  name: 'historical_schedule_and_logical_dates',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    // 1. Añadir columna 'activo' a habit_schedule_history si no existe
    const tableInfo = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${TABLE_NAMES.HABIT_SCHEDULE_HISTORY});`
    );
    const hasActivoColumn = tableInfo.some((col) => col.name === 'activo');

    if (!hasActivoColumn) {
      await db.execAsync(`
        ALTER TABLE ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} 
        ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;
      `);
    }

    // 2. Normalizar todas las fechas a formato estricto LogicalDate (YYYY-MM-DD)
    await db.execAsync(`
      UPDATE ${TABLE_NAMES.HABITS} 
      SET fechaInicio = substr(fechaInicio, 1, 10) 
      WHERE length(fechaInicio) > 10;

      UPDATE ${TABLE_NAMES.HABITS} 
      SET fechaFin = substr(fechaFin, 1, 10) 
      WHERE fechaFin IS NOT NULL AND length(fechaFin) > 10;

      UPDATE ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} 
      SET validFrom = substr(validFrom, 1, 10) 
      WHERE length(validFrom) > 10;

      UPDATE ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} 
      SET validUntil = substr(validUntil, 1, 10) 
      WHERE validUntil IS NOT NULL AND length(validUntil) > 10;

      UPDATE ${TABLE_NAMES.HABIT_LOGS} 
      SET fecha = substr(fecha, 1, 10) 
      WHERE length(fecha) > 10;

      UPDATE ${TABLE_NAMES.USERS} 
      SET lastPenaltyAppliedDate = substr(lastPenaltyAppliedDate, 1, 10) 
      WHERE lastPenaltyAppliedDate IS NOT NULL AND length(lastPenaltyAppliedDate) > 10;
    `);

    // 3. Backfill de hábitos existentes:
    // a) Hábitos que no tengan ninguna entrada en habit_schedule_history
    await db.execAsync(`
      INSERT INTO ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY} (id, habitId, frecuencia, diasSemana, validFrom, validUntil, activo)
      SELECT 
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) as id,
        id as habitId,
        frecuencia,
        diasSemana,
        fechaInicio as validFrom,
        fechaFin as validUntil,
        activo
      FROM ${TABLE_NAMES.HABITS}
      WHERE id NOT IN (SELECT DISTINCT habitId FROM ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY});
    `);

    // b) Para hábitos archivados actualmente (habits.activo = 0), sincronizar su registro abierto
    await db.execAsync(`
      UPDATE ${TABLE_NAMES.HABIT_SCHEDULE_HISTORY}
      SET activo = 0
      WHERE habitId IN (SELECT id FROM ${TABLE_NAMES.HABITS} WHERE activo = 0)
        AND validUntil IS NULL;
    `);
  },
};
