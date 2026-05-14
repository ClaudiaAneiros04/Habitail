import * as SQLite from 'expo-sqlite';

/**
 * Promesa singleton de la base de datos persistida en globalThis.
 * Durante el desarrollo (HMR), los módulos se recargan pero globalThis persiste.
 * Esto previene que se abran múltiples conexiones al mismo archivo habitail.db,
 * lo cual lanzaría el error "Access Handles cannot be created..." en Web (OPFS).
 */
const globalDb = globalThis as any;

import { CREATE_TABLES_SQL } from '../db/schema';

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!globalDb._dbPromise) {
    globalDb._dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('habitail_v2.db');

      // Ejecutar PRAGMAs por separado para mayor estabilidad en Android
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;'); // Habilitar explícitamente FK

      // Ejecutar la creación del esquema unificado
      await db.execAsync(CREATE_TABLES_SQL);

      return db;
    })();
  }
  return globalDb._dbPromise;
};

/**
 * Alias de compatibilidad: llama a getDb() para forzar la inicialización
 * del esquema. Se puede invocar desde _layout.tsx como "calentamiento"
 * antes de que las pantallas intenten leer datos.
 */
export const initDb = (): Promise<SQLite.SQLiteDatabase> => getDb();
