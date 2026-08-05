import * as SQLite from 'expo-sqlite';
import { Migration, migrations, LATEST_SCHEMA_VERSION } from './migrations';

interface UserVersionRow {
  user_version: number;
}

/**
 * Consulta la versión actual del esquema de la base de datos utilizando PRAGMA user_version.
 */
export const getDatabaseVersion = async (db: SQLite.SQLiteDatabase): Promise<number> => {
  const result = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version;');
  return result?.user_version ?? 0;
};

/**
 * Actualiza la versión del esquema en la base de datos mediante PRAGMA user_version.
 */
export const setDatabaseVersion = async (
  db: SQLite.SQLiteDatabase,
  version: number
): Promise<void> => {
  await db.execAsync(`PRAGMA user_version = ${version};`);
};

/**
 * Ejecuta una migración individual dentro de una transacción.
 * Si la migración tiene éxito, avanza la versión del esquema a la versión de la migración.
 * Si falla, la transacción revierte los cambios y lanza el error.
 */
export const executeMigration = async (
  db: SQLite.SQLiteDatabase,
  migration: Migration
): Promise<void> => {
  console.log(`[Migrator] Ejecutando migración v${migration.version}: ${migration.name}...`);

  const runWithVersionUpdate = async (): Promise<void> => {
    await migration.up(db);
    await setDatabaseVersion(db, migration.version);
  };

  if (typeof db.withTransactionAsync === 'function') {
    await db.withTransactionAsync(runWithVersionUpdate);
  } else {
    await db.execAsync('BEGIN TRANSACTION;');
    try {
      await runWithVersionUpdate();
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }

  console.log(`[Migrator] Migración v${migration.version} (${migration.name}) aplicada correctamente.`);
};

/**
 * Ejecuta todas las migraciones pendientes en orden secuencial.
 * Es idempotente: si la base de datos ya está en la versión más reciente, no realiza ninguna operación.
 */
export const runMigrations = async (
  db: SQLite.SQLiteDatabase,
  customMigrations: readonly Migration[] = migrations
): Promise<void> => {
  const currentVersion = await getDatabaseVersion(db);

  if (currentVersion >= LATEST_SCHEMA_VERSION && customMigrations === migrations) {
    return;
  }

  console.log(`[Migrator] Versión actual del esquema: ${currentVersion}. Versión objetivo: ${LATEST_SCHEMA_VERSION}.`);

  for (const migration of customMigrations) {
    if (currentVersion < migration.version) {
      await executeMigration(db, migration);
    }
  }

  const finalVersion = await getDatabaseVersion(db);
  console.log(`[Migrator] Base de datos sincronizada en versión de esquema: ${finalVersion}.`);
};
