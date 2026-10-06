import { getDb, initDb } from '../database';
import { UserRepository } from '../UserRepository';
import { PetRepository } from '../PetRepository';
import { HabitRepository } from '../HabitRepository';
import { LogRepository } from '../LogRepository';
import { runMigrations } from '../../db/migrator';
import { User, Pet, Habit, HabitLog, PetState } from '../../types';

describe('Repository Regression Tests', () => {
  let userRepo: UserRepository;
  let petRepo: PetRepository;
  let habitRepo: HabitRepository;
  let logRepo: LogRepository;
  let db: any;

  beforeEach(async () => {
    // 1. Limpiar e inicializar la BD
    db = await getDb();
    // Simulate drop tables to ensure clean state
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS habit_logs;
      DROP TABLE IF EXISTS habit_schedule_history;
      DROP TABLE IF EXISTS habits;
      DROP TABLE IF EXISTS pets;
      DROP TABLE IF EXISTS user_badges;
      DROP TABLE IF EXISTS user_interests;
      DROP TABLE IF EXISTS users;
      PRAGMA foreign_keys = ON;
    `);
    await initDb(); // Corre las migraciones v1 a v5

    userRepo = new UserRepository();
    petRepo = new PetRepository();
    habitRepo = new HabitRepository();
    logRepo = new LogRepository();
  });

  afterEach(async () => {
    // clean up or close if needed
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

    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H1', categoria: 'C1', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026', activo: true };
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
    const user: User = { id: 'u1', username: 'U', fechaRegistro: '2026', puntos: 0, onboardingCompleted: true };
    await userRepo.create(user);
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026', activo: true };
    await habitRepo.create(habit);

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
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026', activo: true };
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
    
    const habit: Habit = { id: 'h1', userId: 'u1', nombre: 'H', categoria: 'C', icono: 'I', colorHex: '#000', frecuencia: 'DAILY', diasSemana: [1], tipoVerificacion: 'BOOLEAN', nivelPrioridad: 'NORMAL', fechaInicio: '2026', activo: true };
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
});
