import { DatabaseSync } from 'node:sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMigrations } from '../../db/migrator';
import { UserRepository } from '../../storage/UserRepository';
import { PetRepository } from '../../storage/PetRepository';
import { HabitRepository } from '../../storage/HabitRepository';
import { LogRepository } from '../../storage/LogRepository';
import { HabitCompletionService } from '../HabitCompletionService';
import { useUserStore } from '../../store/useUserStore';
import { useHabitStore } from '../../store/useHabitStore';
import { usePetStore } from '../../store/usePetStore';
import { useLogStore } from '../../store/useLogStore';
import { Habit, HabitLog, Pet, PetState, Priority, User, VerificationType } from '../../types';
import { toLogicalDate, getLogicalToday } from '../../utils/dateUtils';
import { getHabitsExpectedOnDate } from '../../utils/frequencyEngine';

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

describe('Gestión de fechas de hábitos y protección de salud de mascota (10 Casos)', () => {
  let testAdapter: RealSqliteTestAdapter;
  let db: any;
  let userRepo: UserRepository;
  let petRepo: PetRepository;
  let habitRepo: HabitRepository;
  let logRepo: LogRepository;
  let completionService: HabitCompletionService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    await runMigrations(db);

    userRepo = new UserRepository();
    petRepo = new PetRepository();
    habitRepo = new HabitRepository();
    logRepo = new LogRepository();
    completionService = new HabitCompletionService();

    useUserStore.setState({ user: null });
    useHabitStore.setState({ habits: [] });
    usePetStore.setState({ pet: null });
    useLogStore.setState({ logs: [] });
  });

  afterEach(() => {
    testAdapter.close();
    delete (globalThis as any)._dbPromise;
  });

  // Caso 1. Primera instalación: usuario registrado el 15/10/2026. Intentar crear hábito con inicio el 14/10/2026 -> Rechazada.
  it('Caso 1: Primera instalación - Rechazar crear un hábito con fecha de inicio anterior al día actual', async () => {
    await userRepo.create({
      id: 'user-case-1',
      username: 'Usuario Caso 1',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 0,
      onboardingCompleted: true,
    });
    await useUserStore.getState().loadUser('user-case-1');

    // Intento 1: llamada directa al store
    await expect(
      useHabitStore.getState().addHabit({
        userId: 'user-case-1',
        nombre: 'Hábito Pasado Store',
        categoria: 'SALUD',
        icono: 'water',
        colorHex: '#00BCD4',
        frecuencia: 'DAILY',
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        tipoVerificacion: VerificationType.BOOLEAN,
        nivelPrioridad: Priority.NORMAL,
        fechaInicio: '2026-10-14',
        activo: true,
      })
    ).rejects.toThrow();

    // Intento 2: llamada directa al repositorio SQLite
    await expect(
      habitRepo.create({
        id: 'habit-case-1-repo',
        userId: 'user-case-1',
        nombre: 'Hábito Pasado Repo',
        categoria: 'SALUD',
        icono: 'water',
        colorHex: '#00BCD4',
        frecuencia: 'DAILY',
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        tipoVerificacion: VerificationType.BOOLEAN,
        nivelPrioridad: Priority.NORMAL,
        fechaInicio: '2026-10-14',
        activo: true,
      })
    ).rejects.toThrow();

    // Comprobamos que no se persistió
    const habitsInDb = await habitRepo.get('user-case-1');
    expect(habitsInDb).toHaveLength(0);
  });

  // Caso 2. Creación correcta: fecha de registro 15/10/2026. Crear hábito con inicio 15/10/2026 -> Permitida.
  it('Caso 2: Creación correcta - Permitir crear hábito con inicio en la fecha actual', async () => {
    await userRepo.create({
      id: 'user-case-2',
      username: 'Usuario Caso 2',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 0,
      onboardingCompleted: true,
    });
    await useUserStore.getState().loadUser('user-case-2');

    await useHabitStore.getState().addHabit({
      userId: 'user-case-2',
      nombre: 'Hábito Correcto Hoy',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4CAF50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    const habits = useHabitStore.getState().habits;
    expect(habits).toHaveLength(1);
    expect(habits[0].fechaInicio).toBe('2026-10-15');

    const inDb = await habitRepo.getById(habits[0].id);
    expect(inDb).not.toBeNull();
    expect(inDb?.nombre).toBe('Hábito Correcto Hoy');
  });

  // Caso 3. Completar un día anterior al registro: fecha registro 15/10/2026. Intentar completar el 10/10/2026 -> Rechazada sin modificar salud o puntos.
  it('Caso 3: Completar un día anterior al registro - Rechazado sin alterar salud ni puntos', async () => {
    await userRepo.create({
      id: 'user-case-3',
      username: 'Usuario Caso 3',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 50,
      onboardingCompleted: true,
    });
    await petRepo.create({
      id: 'pet-case-3',
      userId: 'user-case-3',
      vida: 80,
      nivel: 1,
      xp: 0,
      xpParaSiguienteNivel: 100,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'default',
      accesorios: [],
    });
    // Hábito creado hoy
    await habitRepo.create({
      id: 'habit-case-3',
      userId: 'user-case-3',
      nombre: 'Hábito Caso 3',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4CAF50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    await expect(
      completionService.completeHabit({
        userId: 'user-case-3',
        habitId: 'habit-case-3',
        logicalDate: '2026-10-10',
      })
    ).rejects.toThrow();

    // Verificar que los puntos y la salud no cambiaron
    const userAfter = await userRepo.getByUserId('user-case-3');
    const petAfter = await petRepo.getByUserId('user-case-3');
    expect(userAfter?.puntos).toBe(50);
    expect(petAfter?.vida).toBe(80);

    // Verificar que no se insertó log
    const logs = await logRepo.getByDate('2026-10-10', 'user-case-3');
    expect(logs).toHaveLength(0);
  });

  // Caso 4. Desmarcar un día anterior al registro: fecha registro 15/10/2026. Intentar desmarcar el 10/10/2026 -> Rechazada sin modificar salud o puntos.
  it('Caso 4: Desmarcar un día anterior al registro - Rechazado sin alterar salud ni puntos', async () => {
    await userRepo.create({
      id: 'user-case-4',
      username: 'Usuario Caso 4',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 100,
      onboardingCompleted: true,
    });
    await petRepo.create({
      id: 'pet-case-4',
      userId: 'user-case-4',
      vida: 90,
      nivel: 1,
      xp: 0,
      xpParaSiguienteNivel: 100,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'default',
      accesorios: [],
    });
    await habitRepo.create({
      id: 'habit-case-4',
      userId: 'user-case-4',
      nombre: 'Hábito Caso 4',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4CAF50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    await expect(
      completionService.uncompleteHabit({
        userId: 'user-case-4',
        habitId: 'habit-case-4',
        logicalDate: '2026-10-10',
      })
    ).rejects.toThrow();

    const userAfter = await userRepo.getByUserId('user-case-4');
    const petAfter = await petRepo.getByUserId('user-case-4');
    expect(userAfter?.puntos).toBe(100);
    expect(petAfter?.vida).toBe(90);
  });

  // Caso 5. Hábito creado posteriormente: fecha de registro 15/10/2026. Hábito creado 20/10/2026 -> No se generan incumplimientos ni penalizaciones anteriores al 20/10/2026.
  it('Caso 5: Hábito creado posteriormente - No genera incumplimientos ni penalizaciones antes de su fechaInicio', async () => {
    await userRepo.create({
      id: 'user-case-5',
      username: 'Usuario Caso 5',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 0,
      onboardingCompleted: true,
    });
    await petRepo.create({
      id: 'pet-case-5',
      userId: 'user-case-5',
      vida: 100,
      nivel: 1,
      xp: 0,
      xpParaSiguienteNivel: 100,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'default',
      accesorios: [],
    });
    // Hábito creado con fechaInicio 2026-10-20 (fecha futura permitida para programar)
    await habitRepo.create({
      id: 'habit-case-5',
      userId: 'user-case-5',
      nombre: 'Hábito del 20',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4CAF50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-20',
      activo: true,
    });

    const habitInDb = await habitRepo.getById('habit-case-5');
    expect(habitInDb).not.toBeNull();

    // Verificar que en fecha 2026-10-18 (antes de fechaInicio 2026-10-20), el hábito NO se considera programado ni esperado
    const habitsExpectedBeforeStart = getHabitsExpectedOnDate([habitInDb!], '2026-10-18');
    expect(habitsExpectedBeforeStart).toHaveLength(0);

    // Tampoco computa como hábito incumplido
    const missedBeforeStart = await logRepo.getMissedHabitsForDate('2026-10-18', habitsExpectedBeforeStart);
    expect(missedBeforeStart).toHaveLength(0);

    // En cambio, en su fechaInicio 2026-10-20, sí está programado
    const habitsExpectedOnStart = getHabitsExpectedOnDate([habitInDb!], '2026-10-20');
    expect(habitsExpectedOnStart).toHaveLength(1);

    const petAfter = await petRepo.getByUserId('user-case-5');
    expect(petAfter?.vida).toBe(100); // Mascota mantiene 100 de vida intacta
  });

  // Caso 6. Reinicio de la aplicación: registrar el 15/10/2026. Reabrir el 18/10/2026 -> fechaRegistro sigue siendo 15/10/2026.
  it('Caso 6: Reinicio de la aplicación - fechaRegistro es inmutable y no se sobrescribe al recargar', async () => {
    const originalRegistration = '2026-10-15T08:30:00.000Z';
    await userRepo.create({
      id: 'user-case-6',
      username: 'Usuario Caso 6',
      fechaRegistro: originalRegistration,
      puntos: 10,
      onboardingCompleted: true,
    });

    // Simular cierre de la aplicación
    useUserStore.setState({ user: null });

    // Simular reapertura el 18/10/2026
    await useUserStore.getState().loadUser('user-case-6');
    const userLoaded = useUserStore.getState().user;

    expect(userLoaded?.fechaRegistro).toBe(originalRegistration);

    // Asegurar que llamar a loadUser nuevamente o actualizar datos de sesión no muta fechaRegistro
    await userRepo.update('user-case-6', { lastOpenedAt: 1792310400000 });
    const inDb = await userRepo.getByUserId('user-case-6');
    expect(inDb?.fechaRegistro).toBe(originalRegistration);
    expect(inDb?.lastOpenedAt).toBe(1792310400000);
  });

  // Caso 7. Edición de hábitos: crear un hábito el 15/10/2026 e intentar modificar su fecha de inicio al 10/10/2026 -> Rechazada.
  it('Caso 7: Edición de hábitos - Rechazar modificar fecha de inicio a una fecha anterior a la original', async () => {
    await userRepo.create({
      id: 'user-case-7',
      username: 'Usuario Caso 7',
      fechaRegistro: '2026-10-15T09:00:00.000Z',
      puntos: 0,
      onboardingCompleted: true,
    });
    await useUserStore.getState().loadUser('user-case-7');

    await useHabitStore.getState().addHabit({
      userId: 'user-case-7',
      nombre: 'Hábito Edición',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4CAF50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });
    const habit = useHabitStore.getState().habits[0];

    // Intento 1: llamada a updateHabit en el store retrocediendo fecha
    await expect(
      useHabitStore.getState().updateHabit(habit.id, {
        fechaInicio: '2026-10-10',
      })
    ).rejects.toThrow();

    // Intento 2: llamada a update en HabitRepository retrocediendo fecha
    await expect(
      habitRepo.update(habit.id, {
        fechaInicio: '2026-10-10',
      })
    ).rejects.toThrow();

    // Edición de otros campos (nombre, color) debe funcionar perfectamente
    await useHabitStore.getState().updateHabit(habit.id, {
      nombre: 'Hábito Renombrado Exitosamente',
      colorHex: '#E91E63',
    });
    const updated = useHabitStore.getState().habits.find((h) => h.id === habit.id);
    expect(updated?.nombre).toBe('Hábito Renombrado Exitosamente');
    expect(updated?.colorHex).toBe('#E91E63');
    expect(updated?.fechaInicio).toBe('2026-10-15'); // Permanece intacta
  });

  // Caso 8. Historial existente: actualizar con BD que contiene hábitos y registros anteriores -> Conservar datos sin penalizaciones incorrectas.
  it('Caso 8: Historial existente - Conservar datos históricos sin eliminaciones ni corrupciones', async () => {
    await userRepo.create({
      id: 'legacy-user',
      username: 'Usuario Antiguo',
      fechaRegistro: '2026-01-01T00:00:00.000Z',
      puntos: 300,
      onboardingCompleted: true,
    });
    await petRepo.create({
      id: 'legacy-pet',
      userId: 'legacy-user',
      vida: 95,
      nivel: 3,
      xp: 40,
      xpParaSiguienteNivel: 300,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'default',
      accesorios: [],
    });
    // Insertar hábito histórico preexistente con allowHistorical: true
    await habitRepo.create(
      {
        id: 'legacy-habit-1',
        userId: 'legacy-user',
        nombre: 'Hábito Histórico',
        categoria: 'SALUD',
        icono: 'water',
        colorHex: '#2196F3',
        frecuencia: 'DAILY',
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        tipoVerificacion: VerificationType.BOOLEAN,
        nivelPrioridad: Priority.NORMAL,
        fechaInicio: '2026-01-01',
        activo: true,
      },
      { allowHistorical: true }
    );
    await logRepo.upsert({
      id: 'legacy-log-1',
      habitId: 'legacy-habit-1',
      userId: 'legacy-user',
      fecha: '2026-01-02',
      completado: true,
      timestampRegistro: '2026-01-02T10:00:00.000Z',
    });

    // Rehidratar store
    await useUserStore.getState().loadUser('legacy-user');
    await useHabitStore.getState().loadHabits();

    const storedHabits = useHabitStore.getState().habits;
    expect(storedHabits).toHaveLength(1);
    expect(storedHabits[0].id).toBe('legacy-habit-1');
    expect(storedHabits[0].fechaInicio).toBe('2026-01-01');

    const pet = await petRepo.getByUserId('legacy-user');
    expect(pet?.vida).toBe(95);
    expect(useUserStore.getState().user?.puntos).toBe(300);
  });

  // Caso 9. Cambio de día: pasar de 23:59 a 00:00 -> Restricciones respetan la fecha lógica local.
  it('Caso 9: Cambio de día - Validación respeta la fecha lógica local independientemente del desfase UTC', async () => {
    // Verificamos que toLogicalDate convierte strings ISO locales y UTC congruentemente
    const lateNightISO = '2026-10-15T23:59:59.000Z';
    const midnightISO = '2026-10-16T00:00:01.000Z';

    const dateBefore = toLogicalDate(lateNightISO);
    const dateAfter = toLogicalDate(midnightISO);

    expect(dateBefore).toBe('2026-10-15');
    expect(dateAfter).toBe('2026-10-16');

    // getLogicalToday retorna un formato YYYY-MM-DD
    const today = getLogicalToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Caso 10. Protección de la mascota: múltiples intentos de completar y desmarcar fechas anteriores al registro -> Salud y puntos intactos.
  it('Caso 10: Protección de la mascota - Intentos repetidos sobre fechas inválidas no alteran salud ni puntos ni crean ledger', async () => {
    await userRepo.create({
      id: 'user-case-10',
      username: 'Usuario Caso 10',
      fechaRegistro: '2026-10-15T12:00:00.000Z',
      puntos: 150,
      onboardingCompleted: true,
    });
    await petRepo.create({
      id: 'pet-case-10',
      userId: 'user-case-10',
      vida: 70,
      nivel: 2,
      xp: 20,
      xpParaSiguienteNivel: 200,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'default',
      accesorios: [],
    });
    await habitRepo.create({
      id: 'habit-case-10',
      userId: 'user-case-10',
      nombre: 'Hábito Seguro',
      categoria: 'SALUD',
      icono: 'water',
      colorHex: '#00BCD4',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    const invalidDates = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];

    for (const d of invalidDates) {
      // Intentar completar repetidamente
      await expect(
        completionService.completeHabit({
          userId: 'user-case-10',
          habitId: 'habit-case-10',
          logicalDate: d,
        })
      ).rejects.toThrow();
      // Intentar desmarcar repetidamente
      await expect(
        completionService.uncompleteHabit({
          userId: 'user-case-10',
          habitId: 'habit-case-10',
          logicalDate: d,
        })
      ).rejects.toThrow();
    }

    // Verificar salud y puntos finales
    const petAfter = await petRepo.getByUserId('user-case-10');
    const userAfter = await userRepo.getByUserId('user-case-10');
    expect(petAfter?.vida).toBe(70);
    expect(userAfter?.puntos).toBe(150);

    // Verificar que no existen registros de gamificación por estas operaciones rechazadas
    const ledgerEvents = await db.getAllAsync(
      'SELECT * FROM gamification_events WHERE userId = ?',
      ['user-case-10']
    );
    expect(ledgerEvents).toHaveLength(0);
  });
});
