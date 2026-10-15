import { getDb, initDb } from '../database';
import { UserRepository } from '../UserRepository';
import { PetRepository } from '../PetRepository';
import { HabitRepository } from '../HabitRepository';
import { LogRepository } from '../LogRepository';
import { runMigrations } from '../../db/migrator';
import { User, Pet, Habit, HabitLog, PetState } from '../../types';
import { DatabaseSync } from 'node:sqlite';

class RealSqliteTestAdapter {
  private rawDb: DatabaseSync;

  constructor() {
    this.rawDb = new DatabaseSync(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    this.rawDb.exec(source);
  }

  async runAsync(source: string, params: unknown[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const stmt = this.rawDb.prepare(source);
    const result = stmt.run(...(params as any[]));
    return {
      lastInsertRowId: Number(result.lastInsertRowid ?? 0),
      changes: Number(result.changes ?? 0),
    };
  }

  async getFirstAsync<T>(source: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.rawDb.prepare(source);
    const row = stmt.get(...(params as any[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T>(source: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.rawDb.prepare(source);
    const rows = stmt.all(...(params as any[]));
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

  asExpoDb(): any {
    return this;
  }

  close(): void {
    this.rawDb.close();
  }
}

describe('Repository Regression Tests', () => {
  let userRepo: UserRepository;
  let petRepo: PetRepository;
  let habitRepo: HabitRepository;
  let logRepo: LogRepository;
  let db: any;
  let testAdapter: RealSqliteTestAdapter;

  beforeEach(async () => {
    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    await runMigrations(db); // Corre las migraciones v1 a v6

    userRepo = new UserRepository();
    petRepo = new PetRepository();
    habitRepo = new HabitRepository();
    logRepo = new LogRepository();
  });

  afterEach(async () => {
    testAdapter.close();
    delete (globalThis as any)._dbPromise;
  });

  it('Modificar el nombre del usuario conserva todos los hijos', async () => {
    // crear usuario + mascota + hábitos + logs + insignias
    const user: User = {
      id: 'u1', username: 'TestUser', fechaRegistro: new Date().toISOString(), puntos: 10, onboardingCompleted: true
    };
    await userRepo.create(user);
    await userRepo.addBadges('u1', ['b1', 'b2']);

    const pet: Pet = {
      id: 'p1', userId: 'u1', vida: 100, nivel: 1, xp: 0, xpParaSiguienteNivel: 100, estadoActual: PetState.HAPPY, skinEquipada: 's1', accesorios: []
    };
    await petRepo.create(pet);

    const habit: Habit = {
      id: 'h1', userId: 'u1', nombre: 'TestHabit', categoria: 'General', icono: 'icon', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1,2,3], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: new Date().toISOString(), activo: true
    };
    await habitRepo.create(habit);

    const log: HabitLog = {
      id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-10-06', completado: true, timestampRegistro: new Date().toISOString()
    };
    await logRepo.upsert(log);

    // Act
    await userRepo.update('u1', { username: 'NewName' });

    // Assert
    const updatedUser = await userRepo.getByUserId('u1');
    expect(updatedUser?.username).toBe('NewName');
    
    // Check children
    const petCheck = await petRepo.getByUserId('u1');
    expect(petCheck).not.toBeNull();
    
    const habitCheck = await habitRepo.getById('h1');
    expect(habitCheck).not.toBeNull();

    const logCheck = await logRepo.getByDate('2026-10-06', 'u1');
    expect(logCheck.length).toBe(1);
  });

  it('Modificar un hábito conserva todos sus logs y archivar un hábito conserva logs históricos', async () => {
    const user: User = { id: 'u1', username: 'U', fechaRegistro: '2026', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);

    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H1', categoria: 'C1', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026-10-15', activo: true };
    await habitRepo.create(habit);

    const log: HabitLog = { id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-10-06', completado: true, timestampRegistro: '2026' };
    await logRepo.upsert(log);

    // Modificar un hábito
    await habitRepo.update('h1', { nombre: 'H2' });
    const logCheck1 = await logRepo.getByHabit('h1');
    expect(logCheck1.length).toBe(1);

    // Archivar un hábito
    await habitRepo.archive('h1');
    const habitCheck = await habitRepo.getById('h1');
    expect(habitCheck?.activo).toBe(false);

    const logCheck2 = await logRepo.getByHabit('h1');
    expect(logCheck2.length).toBe(1); // logs históricos siguen existiendo
  });

  it('Cambiar frecuencia comprueba que el historial anterior permanece', async () => {
    const user: User = { id: 'u1', username: 'U', fechaRegistro: '2026-10-14', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026-10-14', activo: true };
    await habitRepo.create(habit, { allowHistorical: true });

    // Manually ensure the active interval started on a previous day so today's update closes it and opens a new interval
    await db.runAsync('UPDATE habit_schedule_history SET validFrom = ? WHERE habitId = ?', ['2026-10-14', 'h1']);

    let h = await habitRepo.getById('h1');
    expect(h?.scheduleHistory?.length).toBe(1);

    // Update frequency
    await habitRepo.update('h1', { frecuencia: 'WEEKLY', diasSemana: [2,3] });
    
    h = await habitRepo.getById('h1');
    expect(h?.scheduleHistory?.length).toBe(2);
  });

  it('Intentar insertar dos logs para el mismo hábito y fecha no crea duplicados', async () => {
    const user: User = { id: 'u1', username: 'U', fechaRegistro: '2026', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026-10-15', activo: true };
    await habitRepo.create(habit);

    const log1: HabitLog = { id: 'l1', habitId: 'h1', userId: 'u1', fecha: '2026-10-06', completado: true, timestampRegistro: '2026-10-06T10:00:00Z' };
    await logRepo.upsert(log1);

    const log2: HabitLog = { id: 'l2', habitId: 'h1', userId: 'u1', fecha: '2026-10-06', completado: false, timestampRegistro: '2026-10-06T11:00:00Z' };
    
    try {
      await logRepo.upsert(log2); // Should throw unique constraint error or upsert silently depending on the query
    } catch(e) {
      // Ignored
    }

    // Now let's check logs manually in DB
    const rows = await db.getAllAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', '2026-10-06']);
    expect(rows.length).toBe(1);
  });

  it('Simular un fallo en una operación compuesta y comprobar que la transacción hace rollback', async () => {
    const user: User = { id: 'u1', username: 'U', fechaRegistro: '2026', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026-10-15', activo: true };
    await habitRepo.create(habit);

    // To simulate a failure we modify the db method temporarily
    const originalWithTransactionAsync = db.withTransactionAsync;
    let failed = false;
    db.withTransactionAsync = async (cb: any) => {
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        await cb();
        throw new Error('Simulated failure');
      } catch (error) {
        await db.execAsync('ROLLBACK;');
        failed = true;
        throw error;
      }
    };

    try {
      await habitRepo.update('h1', { nombre: 'WillFail' });
    } catch (e) {
      // Expected failure
    }

    expect(failed).toBe(true);

    // Restore
    db.withTransactionAsync = originalWithTransactionAsync;

    const h = await habitRepo.getById('h1');
    expect(h?.nombre).toBe('H'); // Unchanged
    expect(h?.scheduleHistory?.length).toBe(1); // Unchanged
  });

  it('UserRepository persiste y recupera lastOpenedAt correctamente en SQLite', async () => {
    const timestamp = 1700000000000;
    const user: User = {
      id: 'u-opened',
      username: 'OpenedUser',
      fechaRegistro: '2026-01-01',
      puntos: 50,
      onboardingCompleted: true,
      lastOpenedAt: timestamp,
    };

    await userRepo.create(user);
    const retrieved = await userRepo.getByUserId('u-opened');
    expect(retrieved?.lastOpenedAt).toBe(timestamp);

    const newTimestamp = timestamp + 100000;
    await userRepo.update('u-opened', { lastOpenedAt: newTimestamp });
    const updated = await userRepo.getByUserId('u-opened');
    expect(updated?.lastOpenedAt).toBe(newTimestamp);
  });

  it('HabitRepository y LogRepository leen correctamente valores booleanos almacenados como 0, 1, "0" y "1"', async () => {
    const rawDb = (db as any).rawDb;

    // 1. Insertar usuario de prueba
    await userRepo.create({
      id: 'u-bool',
      username: 'BoolUser',
      fechaRegistro: '2026-01-01',
      puntos: 10,
      onboardingCompleted: true,
    });

    // 2. Insertar hábitos con valores como string "0" y "1" directamente en SQLite para simular driver web / migraciones
    rawDb.exec(`
      INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
      VALUES ('h-inactive-str', 'u-bool', 'Inactivo String', 'SALUD', 'heart', '#fff', 'DAILY', '[0,1,2,3,4,5,6]', 'BOOLEAN', 'NORMAL', '2026-01-01', '0');

      INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
      VALUES ('h-active-str', 'u-bool', 'Activo String', 'SALUD', 'heart', '#fff', 'DAILY', '[0,1,2,3,4,5,6]', 'BOOLEAN', 'NORMAL', '2026-01-01', '1');

      INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil, activo)
      VALUES ('sh-1', 'h-inactive-str', 'DAILY', '[0,1,2,3,4,5,6]', '2026-01-01', NULL, '0');

      INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil, activo)
      VALUES ('sh-2', 'h-active-str', 'DAILY', '[0,1,2,3,4,5,6]', '2026-01-01', NULL, '1');

      INSERT INTO habit_logs (id, habitId, userId, fecha, completado, timestampRegistro)
      VALUES ('l-uncompleted-str', 'h-active-str', 'u-bool', '2026-01-02', '0', '2026-01-02T10:00:00Z');

      INSERT INTO habit_logs (id, habitId, userId, fecha, completado, timestampRegistro)
      VALUES ('l-completed-str', 'h-active-str', 'u-bool', '2026-01-03', '1', '2026-01-03T10:00:00Z');
    `);

    // Recuperar mediante repositorios tipados
    const inactiveHabit = await habitRepo.getById('h-inactive-str');
    const activeHabit = await habitRepo.getById('h-active-str');

    expect(inactiveHabit?.activo).toBe(false);
    expect(inactiveHabit?.scheduleHistory?.[0]?.activo).toBe(false);

    expect(activeHabit?.activo).toBe(true);
    expect(activeHabit?.scheduleHistory?.[0]?.activo).toBe(true);

    const logs = await logRepo.getByHabit('h-active-str');
    const uncompletedLog = logs.find((l) => l.id === 'l-uncompleted-str');
    const completedLog = logs.find((l) => l.id === 'l-completed-str');

    expect(uncompletedLog?.completado).toBe(false);
    expect(completedLog?.completado).toBe(true);
  });

  it('Archivar y reactivar hábitos preserva y alterna correctamente el estado activo sin corromper el historial', async () => {
    const user: User = { id: 'u-toggle', username: 'Toggle', fechaRegistro: '2026-01-01', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);

    const habit: Habit = {
      id: 'h-toggle',
      userId: 'u-toggle',
      nombre: 'Toggle Habit',
      categoria: 'SALUD',
      icono: 'heart',
      colorHex: '#000',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: 'BOOLEAN',
      nivelPrioridad: 'NORMAL',
      fechaInicio: '2026-10-15',
      activo: true,
    };
    await habitRepo.create(habit);

    let h = await habitRepo.getById('h-toggle');
    expect(h?.activo).toBe(true);

    // Archivar
    await habitRepo.archive('h-toggle');
    h = await habitRepo.getById('h-toggle');
    expect(h?.activo).toBe(false);
    const activeHistoryArchive = h?.scheduleHistory?.find((s) => s.validUntil === null);
    expect(activeHistoryArchive?.activo).toBe(false);

    // Reactivar
    await habitRepo.update('h-toggle', { activo: true });
    h = await habitRepo.getById('h-toggle');
    expect(h?.activo).toBe(true);
    const activeHistoryReactivate = h?.scheduleHistory?.find((s) => s.validUntil === null);
    expect(activeHistoryReactivate?.activo).toBe(true);

    // Volver a archivar
    await habitRepo.update('h-toggle', { activo: false });
    h = await habitRepo.getById('h-toggle');
    expect(h?.activo).toBe(false);
    const activeHistoryArchive2 = h?.scheduleHistory?.find((s) => s.validUntil === null);
    expect(activeHistoryArchive2?.activo).toBe(false);
  });
});
