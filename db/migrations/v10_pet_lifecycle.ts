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
 * Migración v10: Agrega la columna 'lifecycle' a la tabla 'pets'
 * para aislar los ciclos de vida de diferentes mascotas (adopciones/recuperaciones)
 * y asegurar que eventos y recompensas de una mascota anterior no alteren la salud de una nueva.
 */
export const migrationV10: Migration = {
  version: 10,
  name: 'add_lifecycle_to_pets',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    const columns = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${TABLE_NAMES.PETS});`);
    const existingColumnNames = new Set(columns.map((col) => col.name.toLowerCase()));

    if (!existingColumnNames.has('lifecycle')) {
      await db.execAsync(
        `ALTER TABLE ${TABLE_NAMES.PETS} ADD COLUMN lifecycle INTEGER NOT NULL DEFAULT 1;`
      );
    }
  },
};
