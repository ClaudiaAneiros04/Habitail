import * as SQLite from 'expo-sqlite';

/**
 * Promesa singleton de la base de datos.
 * Solo se abre UNA conexión para toda la vida de la app.
 * Esto previene el error de web "Multiple Access Handles" de expo-sqlite,
 * ya que el worker OPFS de SQLite no admite más de una conexión simultánea.
 */
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Devuelve la conexión única a la base de datos, inicializando
 * el esquema (CREATE TABLE IF NOT EXISTS) la primera vez que se llama.
 *
 * Al ser una promesa cacheada, todas las llamadas simultáneas comparten
 * la misma apertura y esperan a que el esquema esté listo antes de operar.
 */
export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('habitail.db');
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

        DROP TABLE IF EXISTS pets;
        CREATE TABLE IF NOT EXISTS pets (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          vida INTEGER NOT NULL DEFAULT 100,
          nivel INTEGER NOT NULL DEFAULT 1,
          xp INTEGER NOT NULL DEFAULT 0,
          xpParaSiguienteNivel INTEGER NOT NULL DEFAULT 100,
          estadoActual TEXT NOT NULL,
          skinEquipada TEXT NOT NULL,
          accesorios TEXT NOT NULL,
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

        CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);
      `);
      
      // MIGRATION: Add inventario column if it doesn't exist
      try {
        await db.execAsync(`ALTER TABLE users ADD COLUMN inventario TEXT;`);
      } catch (e) {
        // Ignorar si la columna ya existe
      }

      return db;
    })();
  }
  return _dbPromise;
};

/**
 * Alias de compatibilidad: llama a getDb() para forzar la inicialización
 * del esquema. Se puede invocar desde _layout.tsx como "calentamiento"
 * antes de que las pantallas intenten leer datos.
 */
export const initDb = (): Promise<SQLite.SQLiteDatabase> => getDb();
