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
      name TEXT NOT NULL,
      email TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT NOT NULL,
      icono TEXT NOT NULL,
      color TEXT NOT NULL,
      frecuencia TEXT NOT NULL,
      diasSemana TEXT NOT NULL,
      horaRecordatorio TEXT,
      tipVerificacion TEXT NOT NULL,
      nivelPrioridad TEXT NOT NULL,
      fechaInicio TEXT NOT NULL,
      fechaFin TEXT,
      activo INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      habitId TEXT NOT NULL,
      userId TEXT NOT NULL,
      fecha TEXT NOT NULL,
      completado INTEGER NOT NULL,
      nota TEXT,
      timestampRegistro TEXT NOT NULL,
      FOREIGN KEY (habitId) REFERENCES habits (id) ON DELETE CASCADE
    );
  `);
};
