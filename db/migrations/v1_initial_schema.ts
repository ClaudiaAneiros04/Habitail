import * as SQLite from 'expo-sqlite';
import { TABLE_NAMES } from '../schema';
import { Migration } from './types';

/**
 * Migración v1: Creación del esquema base de datos de Habitail.
 * Define las tablas principales y los índices iniciales de fecha.
 */
export const migrationV1: Migration = {
  version: 1,
  name: 'initial_schema',
  up: async (db: SQLite.SQLiteDatabase): Promise<void> => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USERS} (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        email TEXT,
        avatar TEXT,
        fechaRegistro TEXT NOT NULL,
        puntos INTEGER NOT NULL DEFAULT 0,
        onboardingCompleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PETS} (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        vida INTEGER NOT NULL DEFAULT 100,
        nivel INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        xpParaSiguienteNivel INTEGER NOT NULL DEFAULT 100,
        estadoActual TEXT NOT NULL,
        skinEquipada TEXT NOT NULL,
        accesorios TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.HABITS} (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        categoria TEXT NOT NULL,
        icono TEXT NOT NULL,
        colorHex TEXT NOT NULL,
        frecuencia TEXT NOT NULL,
        diasSemana TEXT NOT NULL,
        horaRecordatorio TEXT,
        tipoVerificacion TEXT NOT NULL,
        nivelPrioridad TEXT NOT NULL,
        fechaInicio TEXT NOT NULL,
        fechaFin TEXT,
        activo INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.HABIT_LOGS} (
        id TEXT PRIMARY KEY NOT NULL,
        habitId TEXT NOT NULL,
        userId TEXT NOT NULL,
        fecha TEXT NOT NULL,
        completado INTEGER NOT NULL,
        valor REAL,
        nota TEXT,
        timestampRegistro TEXT NOT NULL,
        FOREIGN KEY (habitId) REFERENCES ${TABLE_NAMES.HABITS} (id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SUGGESTED_HABITS} (
        id TEXT PRIMARY KEY NOT NULL,
        nombre TEXT NOT NULL,
        categoria TEXT NOT NULL,
        icono TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        locale TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_INTERESTS} (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        categoria TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_BADGES} (
        userId TEXT NOT NULL,
        badgeId TEXT NOT NULL,
        PRIMARY KEY (userId, badgeId),
        FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON ${TABLE_NAMES.HABIT_LOGS} (habitId, fecha);
      CREATE INDEX IF NOT EXISTS idx_habit_logs_user_fecha ON ${TABLE_NAMES.HABIT_LOGS} (userId, fecha);
    `);
  },
};
