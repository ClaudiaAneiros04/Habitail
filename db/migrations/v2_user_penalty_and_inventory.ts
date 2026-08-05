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
 * Migración v2: Agrega de forma segura e idempotente las columnas
 * 'lastPenaltyAppliedDate' e 'inventario' a la tabla 'users'.
 */
export const migrationV2: Migration = {
  version: 2,
  name: 'add_user_penalty_and_inventory',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    // Comprobar qué columnas existen ya en la tabla users
    const columns = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${TABLE_NAMES.USERS});`);
    const existingColumnNames = new Set(columns.map((col) => col.name.toLowerCase()));

    if (!existingColumnNames.has('lastpenaltyapplieddate')) {
      await db.execAsync(`ALTER TABLE ${TABLE_NAMES.USERS} ADD COLUMN lastPenaltyAppliedDate TEXT;`);
    }

    if (!existingColumnNames.has('inventario')) {
      await db.execAsync(`ALTER TABLE ${TABLE_NAMES.USERS} ADD COLUMN inventario TEXT;`);
    }
  },
};
