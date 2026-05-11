import * as SQLite from 'expo-sqlite';

/**
 * Promesa singleton de la base de datos persistida en globalThis.
 * Durante el desarrollo (HMR), los módulos se recargan pero globalThis persiste.
 * Esto previene que se abran múltiples conexiones al mismo archivo habitail.db,
 * lo cual lanzaría el error "Access Handles cannot be created..." en Web (OPFS).
 */
const globalDb = globalThis as any;

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!globalDb._dbPromise) {
    globalDb._dbPromise = (async () => {
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
          onboardingCompleted INTEGER NOT NULL DEFAULT 0,
          lastPenaltyAppliedDate TEXT
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

        CREATE TABLE IF NOT EXISTS user_badges (
          userId TEXT NOT NULL,
          badgeId TEXT NOT NULL,
          PRIMARY KEY (userId, badgeId),
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);

        -- Índice para consultas globales (heatmap/stats por userId sin habitId concreto).
        -- Sin este índice, getHeatmapGlobal y getGlobalStatsByPeriod harían full scan
        -- de toda la tabla habit_logs para localizar los registros de un usuario.
        CREATE INDEX IF NOT EXISTS idx_habit_logs_user_fecha ON habit_logs (userId, fecha);
      `);

      // Migración manual segura para añadir la columna en instalaciones existentes
      try {
        await db.execAsync("ALTER TABLE users ADD COLUMN lastPenaltyAppliedDate TEXT;");
      } catch (e) {
        // Ignorar el error si la columna ya existe
      }

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
