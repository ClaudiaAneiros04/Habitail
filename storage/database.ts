import * as SQLite from 'expo-sqlite';

export const getDb = async () => {
  const db = await SQLite.openDatabaseAsync('habitail.db');
  return db;
};

export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      fechaRegistro TEXT NOT NULL,
      puntos INTEGER NOT NULL DEFAULT 0,
      onboardingCompleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      vida INTEGER NOT NULL DEFAULT 100,
      nivel INTEGER NOT NULL DEFAULT 1,
      skinActiva TEXT NOT NULL,
      skinsDesbloqueadas TEXT NOT NULL,
      accesorios TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habits (
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
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      habitId TEXT NOT NULL,
      userId TEXT NOT NULL,
      fecha TEXT NOT NULL,
      completado INTEGER NOT NULL,
      valor REAL,
      nota TEXT,
      timestampRegistro TEXT NOT NULL,
      FOREIGN KEY (habitId) REFERENCES habits (id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suggested_habits (
      id TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      icono TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      locale TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_interests (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      categoria TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );

    -- Índice compuesto para optimizar las consultas por rango de fechas para un hábito específico
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);
  `);
};
