import * as SQLite from 'expo-sqlite';
import { TABLE_NAMES } from '../schema';
import { Migration } from './types';

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Migración v9: Agrega la columna 'appliedHealthDelta' a la tabla 'gamification_events'
 * para diferenciar la recompensa teórica (healthDelta) del incremento de salud efectivamente
 * aplicado a la mascota teniendo en cuenta el límite superior (clamp en 100) y el estado terminal.
 */
export const migrationV9: Migration = {
  version: 9,
  name: 'add_applied_health_delta_to_gamification_events',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    const columns = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${TABLE_NAMES.GAMIFICATION_EVENTS});`);
    const existingColumnNames = new Set(columns.map((col) => col.name.toLowerCase()));

    if (!existingColumnNames.has('appliedhealthdelta')) {
      // Agregar la columna con valor por defecto igual a healthDelta para retrocompatibilidad
      await db.execAsync(
        `ALTER TABLE ${TABLE_NAMES.GAMIFICATION_EVENTS} ADD COLUMN appliedHealthDelta INTEGER;`
      );
      // Para filas existentes donde appliedHealthDelta es NULL, inicializarlo con healthDelta
      await db.execAsync(
        `UPDATE ${TABLE_NAMES.GAMIFICATION_EVENTS} SET appliedHealthDelta = healthDelta WHERE appliedHealthDelta IS NULL;`
      );
    }
  },
};
