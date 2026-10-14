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
 * Migración v8: Agrega de forma segura e idempotente la columna
 * 'lastOpenedAt' a la tabla 'users' para persistir el timestamp
 * de apertura en SQLite como fuente única de verdad.
 */
export const migrationV8: Migration = {
  version: 8,
  name: 'add_user_last_opened_at',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    const columns = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${TABLE_NAMES.USERS});`);
    const existingColumnNames = new Set(columns.map((col) => col.name.toLowerCase()));

    if (!existingColumnNames.has('lastopenedat')) {
      await db.execAsync(`ALTER TABLE ${TABLE_NAMES.USERS} ADD COLUMN lastOpenedAt INTEGER;`);
    }
  },
};
