// db/schema.ts

/**
 * Contrato de Base de Datos - Habitail
 * 
 * Este archivo es la fuente de verdad única para la estructura de la base de datos SQLite.
 * Define tanto las sentencias DDL (CREATE TABLE) como los tipos que representan las filas 
 * tal cual se almacenan físicamente (Rows).
 */

export const TABLE_NAMES = {
  USERS: 'users',
  PETS: 'pets',
  HABITS: 'habits',
  HABIT_LOGS: 'habit_logs',
  SUGGESTED_HABITS: 'suggested_habits',
  USER_INTERESTS: 'user_interests',
  USER_BADGES: 'user_badges',
} as const;

export const CREATE_TABLES_SQL = `
  PRAGMA journal_mode = WAL;

  -- Usuarios
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USERS} (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    fechaRegistro TEXT NOT NULL,
    puntos INTEGER NOT NULL DEFAULT 0,
    onboardingCompleted INTEGER NOT NULL DEFAULT 0,
    lastPenaltyAppliedDate TEXT,
    inventario TEXT -- JSON Array de IDs
  );

  -- Mascota
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PETS} (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    vida INTEGER NOT NULL DEFAULT 100,
    nivel INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    xpParaSiguienteNivel INTEGER NOT NULL DEFAULT 100,
    estadoActual TEXT NOT NULL,
    skinEquipada TEXT NOT NULL,
    accesorios TEXT NOT NULL, -- JSON Array de strings
    FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
  );

  -- Hábitos
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.HABITS} (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL,
    icono TEXT NOT NULL,
    colorHex TEXT NOT NULL,
    frecuencia TEXT NOT NULL,
    diasSemana TEXT NOT NULL, -- JSON Array de números [0-6]
    horaRecordatorio TEXT,
    tipoVerificacion TEXT NOT NULL,
    nivelPrioridad TEXT NOT NULL,
    fechaInicio TEXT NOT NULL,
    fechaFin TEXT,
    activo INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
  );

  -- Historial de Hábitos (Logs)
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

  -- Hábitos Sugeridos (Catálogo)
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SUGGESTED_HABITS} (
    id TEXT PRIMARY KEY NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    icono TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    locale TEXT NOT NULL
  );

  -- Intereses del Usuario
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_INTERESTS} (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    categoria TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
  );

  -- Insignias / Logros del Usuario
  CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_BADGES} (
    userId TEXT NOT NULL,
    badgeId TEXT NOT NULL,
    PRIMARY KEY (userId, badgeId),
    FOREIGN KEY (userId) REFERENCES ${TABLE_NAMES.USERS} (id) ON DELETE CASCADE
  );

  -- Índices de Optimización
  CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON ${TABLE_NAMES.HABIT_LOGS} (habitId, fecha);
  CREATE INDEX IF NOT EXISTS idx_habit_logs_user_fecha ON ${TABLE_NAMES.HABIT_LOGS} (userId, fecha);
`;

/**
 * Tipos que representan las filas tal cual salen de SQLite.
 * Útiles para los Repositorios al mapear de Row a Domain Model.
 */

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  avatar: string | null;
  fechaRegistro: string;
  puntos: number;
  onboardingCompleted: number; // 0 o 1
  lastPenaltyAppliedDate: string | null;
  inventario: string | null; // JSON string
}

export interface PetRow {
  id: string;
  userId: string;
  vida: number;
  nivel: number;
  xp: number;
  xpParaSiguienteNivel: number;
  estadoActual: string;
  skinEquipada: string;
  accesorios: string; // JSON string
}

export interface HabitRow {
  id: string;
  userId: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  icono: string;
  colorHex: string;
  frecuencia: string;
  diasSemana: string; // JSON string
  horaRecordatorio: string | null;
  tipoVerificacion: string;
  nivelPrioridad: string;
  fechaInicio: string;
  fechaFin: string | null;
  activo: number; // 0 o 1
}

export interface HabitLogRow {
  id: string;
  habitId: string;
  userId: string;
  fecha: string;
  completado: number; // 0 o 1
  valor: number | null;
  nota: string | null;
  timestampRegistro: string;
}
