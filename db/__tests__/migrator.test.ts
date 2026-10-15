import * as SQLite from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';
import {
  getDatabaseVersion,
  setDatabaseVersion,
  executeMigration,
  runMigrations,
} from '../migrator';
import { migrations, LATEST_SCHEMA_VERSION, Migration } from '../migrations';
import { TABLE_NAMES } from '../schema';

/**
 * Adaptador de pruebas que implementa la interfaz de expo-sqlite utilizando node:sqlite
 * para ejecutar SQL real en memoria durante las pruebas unitarias.
 */
class RealSqliteTestAdapter {
  private rawDb: DatabaseSync;

  constructor() {
    this.rawDb = new DatabaseSync(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    this.rawDb.exec(source);
  }

  async getFirstAsync<T>(source: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.rawDb.prepare(source);
    const row = stmt.get(...(params as (string | number | bigint | Buffer | null)[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T>(source: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.rawDb.prepare(source);
    const rows = stmt.all(...(params as (string | number | bigint | Buffer | null)[]));
    return rows as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.rawDb.exec('BEGIN TRANSACTION;');
    try {
      await task();
      this.rawDb.exec('COMMIT;');
    } catch (error) {
      this.rawDb.exec('ROLLBACK;');
      throw error;
    }
  }

  asExpoDb(): SQLite.SQLiteDatabase {
    return this as unknown as SQLite.SQLiteDatabase;
  }

  close(): void {
    this.rawDb.close();
  }
}

describe('Sistema de Migraciones SQLite (Migrator)', () => {
  let testDb: RealSqliteTestAdapter;

  beforeEach(() => {
    testDb = new RealSqliteTestAdapter();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('Control de versión (PRAGMA user_version)', () => {
    test('una base de datos recién creada debe tener versión 0', async () => {
      const db = testDb.asExpoDb();
      const version = await getDatabaseVersion(db);
      expect(version).toBe(0);
    });

    test('debe poder actualizar la versión con setDatabaseVersion', async () => {
      const db = testDb.asExpoDb();
      await setDatabaseVersion(db, 5);
      const version = await getDatabaseVersion(db);
      expect(version).toBe(5);
    });
  });

  describe('Instalación nueva (versión 0 a última versión)', () => {
    test('debe aplicar secuencialmente todas las migraciones hasta LATEST_SCHEMA_VERSION', async () => {
      const db = testDb.asExpoDb();

      await runMigrations(db);

      const version = await getDatabaseVersion(db);
      expect(version).toBe(LATEST_SCHEMA_VERSION);

      // Verificar que todas las tablas existen
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
      );
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain(TABLE_NAMES.USERS);
      expect(tableNames).toContain(TABLE_NAMES.PETS);
      expect(tableNames).toContain(TABLE_NAMES.HABITS);
      expect(tableNames).toContain(TABLE_NAMES.HABIT_LOGS);
      expect(tableNames).toContain(TABLE_NAMES.SUGGESTED_HABITS);
      expect(tableNames).toContain(TABLE_NAMES.USER_INTERESTS);
      expect(tableNames).toContain(TABLE_NAMES.USER_BADGES);

      // Verificar que las columnas de v2 existen en users
      const userColumns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${TABLE_NAMES.USERS});`
      );
      const userColNames = userColumns.map((c) => c.name);
      expect(userColNames).toContain('lastPenaltyAppliedDate');
      expect(userColNames).toContain('inventario');

      // Verificar que los índices de v3 existen en habit_logs
      const indices = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index';"
      );
      const indexNames = indices.map((i) => i.name);
      expect(indexNames).toContain('idx_habit_logs_habit_completado_fecha');
      expect(indexNames).toContain('idx_habit_logs_user_completado_fecha');
    });
  });

  describe('Idempotencia', () => {
    test('no debe volver a ejecutar migraciones si la versión ya es la última', async () => {
      const db = testDb.asExpoDb();
      await runMigrations(db);
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      const spyUp = jest.fn();
      const dummyMigration: Migration = {
        version: 1,
        name: 'dummy_v1',
        up: spyUp,
      };

      await runMigrations(db, [dummyMigration]);
      expect(spyUp).not.toHaveBeenCalled();
    });
  });

  describe('Actualización desde instalación existente con datos previos', () => {
    test('debe preservar datos existentes en users, pets, habits y habit_logs al migrar desde versión 0', async () => {
      const db = testDb.asExpoDb();

      // Simular base de datos existente previa con versión 0 y datos ya insertados
      await db.execAsync(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY NOT NULL,
          username TEXT NOT NULL,
          email TEXT,
          avatar TEXT,
          fechaRegistro TEXT NOT NULL,
          puntos INTEGER NOT NULL DEFAULT 0,
          onboardingCompleted INTEGER NOT NULL DEFAULT 0,
          lastPenaltyAppliedDate TEXT,
          inventario TEXT
        );

        CREATE TABLE pets (
          id TEXT PRIMARY KEY NOT NULL,
          userId TEXT NOT NULL,
          vida INTEGER NOT NULL DEFAULT 100,
          nivel INTEGER NOT NULL DEFAULT 1,
          xp INTEGER NOT NULL DEFAULT 0,
          xpParaSiguienteNivel INTEGER NOT NULL DEFAULT 100,
          estadoActual TEXT NOT NULL,
          skinEquipada TEXT NOT NULL,
          accesorios TEXT NOT NULL
        );

        CREATE TABLE habits (
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
          activo INTEGER NOT NULL
        );

        CREATE TABLE habit_logs (
          id TEXT PRIMARY KEY NOT NULL,
          habitId TEXT NOT NULL,
          userId TEXT NOT NULL,
          fecha TEXT NOT NULL,
          completado INTEGER NOT NULL,
          valor REAL,
          nota TEXT,
          timestampRegistro TEXT NOT NULL
        );

        INSERT INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted, lastPenaltyAppliedDate, inventario)
        VALUES ('u1', 'Alex', 'alex@test.com', 'cat.png', '2026-01-01', 150, 1, '2026-04-01', '["hat"]');

        INSERT INTO pets (id, userId, vida, nivel, xp, xpParaSiguienteNivel, estadoActual, skinEquipada, accesorios)
        VALUES ('p1', 'u1', 85, 3, 40, 300, 'HAPPY', 'default', '["glasses"]');

        INSERT INTO habits (id, userId, nombre, descripcion, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
        VALUES ('h1', 'u1', 'Leer 20 mins', 'Libro actual', 'APRENDIZAJE', 'book', '#4CAF50', 'DAILY', '[]', 'BOOLEAN', 'NORMAL', '2026-01-01', 1);

        INSERT INTO habit_logs (id, habitId, userId, fecha, completado, timestampRegistro)
        VALUES ('l1', 'h1', 'u1', '2026-04-01', 1, '2026-04-01T10:00:00Z');
      `);

      // La versión inicial de una base previa no versionada es 0
      expect(await getDatabaseVersion(db)).toBe(0);

      // Ejecutar migraciones
      await runMigrations(db);

      // Comprobar que la versión avanzó a LATEST_SCHEMA_VERSION
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      // Comprobar que todos los datos existentes siguen intactos
      const user = await db.getFirstAsync<{ username: string; puntos: number; inventario: string }>(
        'SELECT username, puntos, inventario FROM users WHERE id = ?;',
        ['u1']
      );
      expect(user).toEqual({
        username: 'Alex',
        puntos: 150,
        inventario: '["hat"]',
      });

      const pet = await db.getFirstAsync<{ vida: number; nivel: number }>(
        'SELECT vida, nivel FROM pets WHERE id = ?;',
        ['p1']
      );
      expect(pet).toEqual({ vida: 85, nivel: 3 });

      const habit = await db.getFirstAsync<{ nombre: string }>(
        'SELECT nombre FROM habits WHERE id = ?;',
        ['h1']
      );
      expect(habit).toEqual({ nombre: 'Leer 20 mins' });

      const log = await db.getFirstAsync<{ habitId: string; completado: number }>(
        'SELECT habitId, completado FROM habit_logs WHERE id = ?;',
        ['l1']
      );
      expect(log).toEqual({ habitId: 'h1', completado: 1 });
    });

    test('debe agregar columnas faltantes en una base de datos antigua que no tenía inventario ni lastPenaltyAppliedDate', async () => {
      const db = testDb.asExpoDb();

      // Versión antigua donde users no tenía lastPenaltyAppliedDate ni inventario
      await db.execAsync(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY NOT NULL,
          username TEXT NOT NULL,
          email TEXT,
          avatar TEXT,
          fechaRegistro TEXT NOT NULL,
          puntos INTEGER NOT NULL DEFAULT 0,
          onboardingCompleted INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO users (id, username, fechaRegistro) VALUES ('old_user', 'Oldie', '2025-10-10');
      `);

      await runMigrations(db);

      // Verificar que las columnas fueron agregadas correctamente
      const userCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users);');
      const colNames = userCols.map((c) => c.name);
      expect(colNames).toContain('lastPenaltyAppliedDate');
      expect(colNames).toContain('inventario');

      // Verificar que el usuario antiguo sigue existiendo y sus nuevos campos son null
      const user = await db.getFirstAsync<{ username: string; inventario: string | null }>(
        'SELECT username, inventario FROM users WHERE id = ?;',
        ['old_user']
      );
      expect(user?.username).toBe('Oldie');
      expect(user?.inventario).toBeNull();
    });
  });

  describe('Migraciones v5 y v6 con resolución de duplicados y normalización de fechas', () => {
    test('Base de datos nueva: se crea directamente con todas las tablas e índices únicos', async () => {
      const db = testDb.asExpoDb();
      await runMigrations(db);
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      // Comprobar índice único
      const indexList = await db.getAllAsync<{ name: string; unique: number }>(
        "PRAGMA index_list('habit_logs');"
      );
      const uniqueIndex = indexList.find((idx) => idx.name === 'idx_habit_logs_habit_fecha');
      expect(uniqueIndex).toBeDefined();
      expect(uniqueIndex?.unique).toBe(1);
    });

    test('Base de datos actualizada desde v4: migra correctamente a v8 resolviendo duplicados de fecha con horas', async () => {
      const db = testDb.asExpoDb();
      // Aplicar hasta v4
      const v1ToV4 = migrations.filter((m) => m.version <= 4);
      await runMigrations(db, v1ToV4);
      expect(await getDatabaseVersion(db)).toBe(4);

      // Insertar datos previos con horas distintas en el mismo día para el mismo hábito
      await db.execAsync(`
        INSERT INTO users (id, username, fechaRegistro) VALUES ('u1', 'User 1', '2026-10-10');
        INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
        VALUES ('h1', 'u1', 'Hábito Test', 'SALUD', 'heart', '#FF0000', 'DAILY', '[]', 'BOOLEAN', 'NORMAL', '2026-10-01 08:00:00', 1);

        INSERT INTO habit_logs (id, habitId, userId, fecha, completado, valor, nota, timestampRegistro)
        VALUES 
          ('l1', 'h1', 'u1', '2026-10-14 09:30:00', 0, NULL, 'Mañana no completado', '2026-10-14T09:30:00Z'),
          ('l2', 'h1', 'u1', '2026-10-14 18:45:00', 1, NULL, 'Tarde completado', '2026-10-14T18:45:00Z');
      `);

      // Ejecutar migraciones restantes (v5 -> v8)
      await runMigrations(db);
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      // Comprobar que solo quedó un log para ese día, conservando el completado = 1
      const remainingLogs = await db.getAllAsync<{ id: string; fecha: string; completado: number; nota: string }>(
        'SELECT id, fecha, completado, nota FROM habit_logs WHERE habitId = ?;',
        ['h1']
      );
      expect(remainingLogs.length).toBe(1);
      expect(remainingLogs[0].id).toBe('l2');
      expect(remainingLogs[0].fecha).toBe('2026-10-14');
      expect(remainingLogs[0].completado).toBe(1);
      expect(remainingLogs[0].nota).toBe('Tarde completado');

      // Las fechas de habits también deben estar normalizadas a YYYY-MM-DD
      const habit = await db.getFirstAsync<{ fechaInicio: string }>('SELECT fechaInicio FROM habits WHERE id = ?;', ['h1']);
      expect(habit?.fechaInicio).toBe('2026-10-01');
    });

    test('Base de datos actualizada desde v5: ya tiene índice único pero registros con timestamp con hora colisionan en v6', async () => {
      const db = testDb.asExpoDb();
      // Simular base en versión 5
      const v1ToV5 = migrations.filter((m) => m.version <= 5);
      await runMigrations(db, v1ToV5);
      expect(await getDatabaseVersion(db)).toBe(5);

      // En v5, el índice único es ON (habitId, fecha).
      // Dos registros con diferente hora no violaban v5: '2026-10-14 09:30' != '2026-10-14 18:45'.
      await db.execAsync(`
        INSERT INTO users (id, username, fechaRegistro) VALUES ('u2', 'User 2', '2026-10-10');
        INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
        VALUES ('h2', 'u2', 'Hábito Test 2', 'SALUD', 'heart', '#FF0000', 'DAILY', '[]', 'BOOLEAN', 'NORMAL', '2026-10-01', 1);

        INSERT INTO habit_logs (id, habitId, userId, fecha, completado, valor, nota, timestampRegistro)
        VALUES 
          ('l3', 'h2', 'u2', '2026-10-14T09:30:00.000Z', 1, NULL, 'Registro mañana', '2026-10-14T09:30:00.000Z'),
          ('l4', 'h2', 'u2', '2026-10-14T18:45:00.000Z', 0, NULL, 'Registro tarde', '2026-10-14T18:45:00.000Z');
      `);

      // Ejecutar migraciones v6+
      await runMigrations(db);
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      // Comprobar que v6 deduplicó sin violar UNIQUE y preservó el registro completado = 1
      const logs = await db.getAllAsync<{ id: string; fecha: string; completado: number }>(
        'SELECT id, fecha, completado FROM habit_logs WHERE habitId = ?;',
        ['h2']
      );
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe('l3');
      expect(logs[0].fecha).toBe('2026-10-14');
      expect(logs[0].completado).toBe(1);
    });

    test('Base de datos sin duplicados: preserva todos los registros íntegros', async () => {
      const db = testDb.asExpoDb();
      const v1ToV4 = migrations.filter((m) => m.version <= 4);
      await runMigrations(db, v1ToV4);

      await db.execAsync(`
        INSERT INTO users (id, username, fechaRegistro) VALUES ('u3', 'User 3', '2026-10-10');
        INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
        VALUES ('h3', 'u3', 'Hábito 3', 'SALUD', 'heart', '#FF0000', 'DAILY', '[]', 'BOOLEAN', 'NORMAL', '2026-10-01', 1);

        INSERT INTO habit_logs (id, habitId, userId, fecha, completado, timestampRegistro)
        VALUES 
          ('d1', 'h3', 'u3', '2026-10-12 10:00:00', 1, '2026-10-12T10:00:00Z'),
          ('d2', 'h3', 'u3', '2026-10-13 11:00:00', 1, '2026-10-13T11:00:00Z'),
          ('d3', 'h3', 'u3', '2026-10-14 12:00:00', 0, '2026-10-14T12:00:00Z');
      `);

      await runMigrations(db);
      expect(await getDatabaseVersion(db)).toBe(LATEST_SCHEMA_VERSION);

      const logs = await db.getAllAsync<{ id: string; fecha: string }>(
        'SELECT id, fecha FROM habit_logs WHERE habitId = ? ORDER BY fecha ASC;',
        ['h3']
      );
      expect(logs.length).toBe(3);
      expect(logs.map((l) => l.fecha)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    });

    test('Base de datos donde un registro ya tenía YYYY-MM-DD y otro tenía ISO con hora del mismo día', async () => {
      const db = testDb.asExpoDb();
      const v1ToV5 = migrations.filter((m) => m.version <= 5);
      await runMigrations(db, v1ToV5);

      await db.execAsync(`
        INSERT INTO users (id, username, fechaRegistro) VALUES ('u4', 'User 4', '2026-10-10');
        INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
        VALUES ('h4', 'u4', 'Hábito 4', 'SALUD', 'heart', '#FF0000', 'DAILY', '[]', 'BOOLEAN', 'NORMAL', '2026-10-01', 1);

        INSERT INTO habit_logs (id, habitId, userId, fecha, completado, timestampRegistro)
        VALUES 
          ('norm1', 'h4', 'u4', '2026-10-14', 0, '2026-10-14T08:00:00Z'),
          ('iso1', 'h4', 'u4', '2026-10-14T20:00:00.000Z', 1, '2026-10-14T20:00:00Z');
      `);

      await runMigrations(db);

      const logs = await db.getAllAsync<{ id: string; fecha: string; completado: number }>(
        'SELECT id, fecha, completado FROM habit_logs WHERE habitId = ?;',
        ['h4']
      );
      expect(logs.length).toBe(1);
      // El completado=1 debe haber ganado sobre el completado=0
      expect(logs[0].id).toBe('iso1');
      expect(logs[0].fecha).toBe('2026-10-14');
      expect(logs[0].completado).toBe(1);
    });
  });

  describe('Manejo de errores y transaccionalidad', () => {
    test('si una migración falla, debe hacer rollback y no avanzar user_version', async () => {
      const db = testDb.asExpoDb();
      await setDatabaseVersion(db, 1);

      const failingMigration: Migration = {
        version: 2,
        name: 'failing_migration',
        up: async (database) => {
          await database.execAsync('CREATE TABLE temp_test (id INT);');
          throw new Error('Error simulado en migración v2');
        },
      };

      await expect(executeMigration(db, failingMigration)).rejects.toThrow(
        'Error simulado en migración v2'
      );

      // La versión debe mantenerse en 1
      const version = await getDatabaseVersion(db);
      expect(version).toBe(1);

      // La tabla creada antes del fallo debe haber sido revertida por el rollback
      const table = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_test';"
      );
      expect(table).toBeNull();
    });

    test('error durante la ejecución de la migración no deja la base de datos parcialmente actualizada', async () => {
      const db = testDb.asExpoDb();
      await runMigrations(db, migrations.filter((m) => m.version <= 4));
      expect(await getDatabaseVersion(db)).toBe(4);

      // Insertar un registro testigo
      await db.execAsync(`
        INSERT INTO users (id, username, fechaRegistro) VALUES ('u_err', 'User Error', '2026-10-10');
      `);

      const flawedMigration: Migration = {
        version: 5,
        name: 'flawed_v5',
        up: async (database) => {
          await database.execAsync("UPDATE users SET username = 'Modificado' WHERE id = 'u_err';");
          throw new Error('Fallo crítico en v5');
        },
      };

      await expect(runMigrations(db, [flawedMigration])).rejects.toThrow('Fallo crítico en v5');

      // Comprobar que la versión sigue en 4
      expect(await getDatabaseVersion(db)).toBe(4);

      // Comprobar que el UPDATE fue revertido por el rollback
      const user = await db.getFirstAsync<{ username: string }>('SELECT username FROM users WHERE id = ?;', ['u_err']);
      expect(user?.username).toBe('User Error');
    });
  });
});
