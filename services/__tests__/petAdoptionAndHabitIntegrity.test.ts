import { HabitCompletionService } from '../HabitCompletionService';
import { PetService } from '../petService';
import { Priority, Category, Frequency, VerificationType, PetState } from '../../types';
import { runMigrations } from '../../db/migrator';
import { DatabaseSync } from 'node:sqlite';
import { getLogicalToday, addLogicalDays } from '../../utils/dateUtils';
import { usePetStore } from '../../store/usePetStore';
import { useLogStore } from '../../store/useLogStore';
import { useUserStore } from '../../store/useUserStore';

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

  private txMutex: Promise<void> = Promise.resolve();

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const prevTx = this.txMutex;
    let releaseTx: () => void = () => {};
    this.txMutex = new Promise<void>((resolve) => {
      releaseTx = resolve;
    });

    await prevTx;
    try {
      this.rawDb.exec('BEGIN TRANSACTION;');
      try {
        await task();
        this.rawDb.exec('COMMIT;');
      } catch (error) {
        this.rawDb.exec('ROLLBACK;');
        throw error;
      }
    } finally {
      releaseTx();
    }
  }

  asExpoDb(): any {
    return this;
  }

  close(): void {
    this.rawDb.close();
  }
}

describe('Pet Adoption & Habit Integrity Suite (12 Scenarios)', () => {
  let testAdapter: RealSqliteTestAdapter;
  let db: any;
  let completionService: HabitCompletionService;
  let petService: PetService;

  const mockDateToday = '2026-05-22';
  const yesterday = addLogicalDays(mockDateToday, -1);
  const userId = 'u_test_adoption';

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${mockDateToday}T12:00:00Z`));

    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    await runMigrations(db);
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Setup base user
    await db.runAsync(
      `INSERT INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'Test User', null, null, yesterday, 100, 1]
    );

    // Setup base habits
    await db.runAsync(
      `INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['h_essential', userId, 'Hábito Esencial', Category.SALUD, 'heart', '#FF0000', Frequency.DAILY, JSON.stringify([0,1,2,3,4,5,6]), VerificationType.BOOLEAN, Priority.ESSENTIAL, yesterday, 1]
    );

    await db.runAsync(
      `INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['h_normal', userId, 'Hábito Normal', Category.DEPORTE, 'walk', '#00FF00', Frequency.DAILY, JSON.stringify([0,1,2,3,4,5,6]), VerificationType.BOOLEAN, Priority.NORMAL, yesterday, 1]
    );

    completionService = new HabitCompletionService();
    petService = new PetService();

    usePetStore.setState({ pet: null });
    useLogStore.setState({ logs: [], lastUpdate: 0 });
    useUserStore.setState({ user: null });
  });

  afterEach(() => {
    testAdapter.close();
    jest.useRealTimers();
  });

  // Escenario 1: Crear una mascota y comenzar con 100 puntos de vida.
  test('Escenario 1: Crear una mascota y comenzar con 100 puntos de vida', async () => {
    const pet = await petService.getPet(userId);
    expect(pet.vida).toBe(100);
    expect(pet.estadoActual).toBe(PetState.HAPPY);
    expect(pet.lifecycle).toBe(1);

    const row = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(row.vida).toBe(100);
    expect(row.estadoActual).toBe(PetState.HAPPY);
    expect(row.lifecycle).toBe(1);
  });

  // Escenario 2: Completar un hábito cuando la salud está al 100 %.
  test('Escenario 2: Completar un hábito cuando la salud está al 100 % se registra correctamente y appliedHealthDelta es 0', async () => {
    await petService.getPet(userId);

    const result = await completionService.completeHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });

    expect(result.success).toBe(true);
    expect(result.healthDelta).toBe(20);
    expect(result.appliedHealthDelta).toBe(0);
    expect(result.newHealth).toBe(100);

    const pet = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(pet.vida).toBe(100);

    const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h_essential', mockDateToday]);
    expect(log).not.toBeNull();
    expect(log.completado).toBe(1);
  });

  // Escenario 3: Desmarcar ese mismo hábito y comprobar que no se resta una recompensa de salud que nunca llegó a aplicarse.
  test('Escenario 3: Desmarcar ese hábito no reduce salud por debajo de 100', async () => {
    await petService.getPet(userId);
    await completionService.completeHabit({ userId, habitId: 'h_essential', logicalDate: mockDateToday });

    const uncomp = await completionService.uncompleteHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });

    expect(uncomp.success).toBe(true);
    expect(uncomp.appliedHealthDeltaReverted).toBe(0);
    expect(uncomp.newHealth).toBe(100);

    const pet = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(pet.vida).toBe(100);
  });

  // Escenario 4: Reducir la salud de una mascota hasta 0.
  test('Escenario 4: Reducir la salud de una mascota hasta 0 y verificar estado ABSENT', async () => {
    const pet = await petService.getPet(userId);
    await petService.applyHealthChange(pet.id, -100, userId);

    const deadPet = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(deadPet.vida).toBe(0);
    expect(deadPet.estadoActual).toBe(PetState.ABSENT);
  });

  // Escenarios 5 y 6: Recuperar o adoptar una nueva mascota -> Comprobar que la nueva mascota comienza con 100 puntos y sincroniza Zustand y SQLite.
  test('Escenarios 5 y 6: Adoptar nueva mascota tras partir inicia con 100 HP, estado HAPPY y nuevo lifecycle', async () => {
    const pet = await petService.getPet(userId);
    await petService.applyHealthChange(pet.id, -100, userId);

    usePetStore.setState({ pet: await petService.getPet(userId) });
    await usePetStore.getState().adoptNewPet();
    const newPetInStore = usePetStore.getState().pet;

    expect(newPetInStore).not.toBeNull();
    expect(newPetInStore!.vida).toBe(100);
    expect(newPetInStore!.estadoActual).toBe(PetState.HAPPY);
    expect(newPetInStore!.lifecycle).toBe(2);

    const petInDb = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(petInDb.vida).toBe(100);
    expect(petInDb.estadoActual).toBe(PetState.HAPPY);
    expect(petInDb.lifecycle).toBe(2);
  });

  // Escenarios 7 y 8: Marcar un hábito después de recuperar la mascota y desmarcarlo en el primer intento.
  test('Escenarios 7 y 8: Marcar hábito tras recuperación y desmarcarlo registra desde el primer intento', async () => {
    // Pet 1 muere
    const pet1 = await petService.getPet(userId);
    await petService.applyHealthChange(pet1.id, -100, userId);

    // Adopta Pet 2
    await petService.adoptNewPet(userId);

    // Marcar hábito
    const markRes = await completionService.completeHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });
    expect(markRes.success).toBe(true);
    expect(markRes.alreadyCompleted).toBe(false);

    // Desmarcar hábito: se registra en el primer intento
    const unmarkRes = await completionService.uncompleteHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });
    expect(unmarkRes.success).toBe(true);
    expect(unmarkRes.alreadyUncompleted).toBe(false);

    const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h_essential', mockDateToday]);
    expect(log).toBeNull();
  });

  // Escenario 9: Repetir varias veces las operaciones y comprobar que no aparecen recompensas ilimitadas ni penalizaciones indebidas.
  test('Escenario 9: Toggling repetido (marcar y desmarcar 10 veces) mantiene la salud estable y previene exploits', async () => {
    const pet1 = await petService.getPet(userId);
    await petService.applyHealthChange(pet1.id, -100, userId);
    await petService.adoptNewPet(userId);

    // Reducir salud a 80 para probar que subir y bajar es consistente
    const pet2 = await petService.getPet(userId);
    await petService.applyHealthChange(pet2.id, -20, userId);

    let pet = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(pet.vida).toBe(80);

    for (let i = 0; i < 10; i++) {
      const comp = await completionService.completeHabit({ userId, habitId: 'h_essential', logicalDate: mockDateToday });
      expect(comp.newHealth).toBe(100);

      const uncomp = await completionService.uncompleteHabit({ userId, habitId: 'h_essential', logicalDate: mockDateToday });
      expect(uncomp.newHealth).toBe(80);
    }

    pet = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(pet.vida).toBe(80);
  });

  // Escenario 10: Desmarcar un hábito que estaba completado antes de recuperar la mascota y comprobar que no afecta indebidamente a su nueva salud.
  test('Escenario 10: Desmarcar hábito completado antes de la adopción no resta salud a la nueva mascota', async () => {
    // 1. Mascota 1 completa un hábito hoy
    const pet1 = await petService.getPet(userId);
    // Mascota 1 estaba en 70 de vida, completa y sube a 90 (+20 aplicado)
    await petService.applyHealthChange(pet1.id, -30, userId);
    const compBefore = await completionService.completeHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });
    expect(compBefore.appliedHealthDelta).toBe(20);

    // 2. Mascota 1 sufre penalizaciones y muere (vida = 0)
    await petService.applyHealthChange(pet1.id, -100, userId);
    const deadPet = await petService.getPet(userId);
    expect(deadPet.vida).toBe(0);

    // 3. Usuario adopta una nueva mascota (Mascota 2) que comienza con 100 HP
    const pet2 = await petService.adoptNewPet(userId);
    expect(pet2.vida).toBe(100);
    expect(pet2.lifecycle).toBe(2);

    // 4. El usuario desmarca el hábito que completó bajo la Mascota 1
    const uncompleteResult = await completionService.uncompleteHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: mockDateToday,
    });

    expect(uncompleteResult.success).toBe(true);
    // Crucial: appliedHealthDeltaReverted debe ser 0 para la nueva mascota
    expect(uncompleteResult.appliedHealthDeltaReverted).toBe(0);
    expect(uncompleteResult.newHealth).toBe(100);

    // Comprobamos en base de datos que la nueva mascota sigue al 100 % de vida
    const freshPet2 = await db.getFirstAsync('SELECT * FROM pets WHERE userId = ?', [userId]);
    expect(freshPet2.vida).toBe(100);
    expect(freshPet2.estadoActual).toBe(PetState.HAPPY);

    // Y el log se eliminó correctamente
    const oldLog = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h_essential', mockDateToday]);
    expect(oldLog).toBeNull();
  });

  // Escenario 11: Reiniciar Habitail y comprobar que la información sigue siendo correcta (persistencia SQLite e hidratación).
  test('Escenario 11: Persistencia tras reinicio recupera la salud de 100, lifecycle y estado desde SQLite', async () => {
    const pet1 = await petService.getPet(userId);
    await petService.applyHealthChange(pet1.id, -100, userId);
    await petService.adoptNewPet(userId);

    // Simular reinicio de la app reseteando stores en memoria
    usePetStore.setState({ pet: null });
    await usePetStore.getState().loadPet(userId);

    const reloadedPet = usePetStore.getState().pet;
    expect(reloadedPet).not.toBeNull();
    expect(reloadedPet!.vida).toBe(100);
    expect(reloadedPet!.estadoActual).toBe(PetState.HAPPY);
    expect(reloadedPet!.lifecycle).toBe(2);
  });

  // Escenario 12: Comprobar que los puntos, las estadísticas y el historial de hábitos no se pierden al recuperar la mascota.
  test('Escenario 12: Puntos, historial de hábitos y estadísticas del usuario se conservan íntegramente tras adoptar nueva mascota', async () => {
    // Mascota 1 completa h_normal en el día de hoy (para ganar puntos) y ayer (historial previo)
    await petService.getPet(userId);
    await completionService.completeHabit({
      userId,
      habitId: 'h_normal',
      logicalDate: mockDateToday,
    });

    await completionService.completeHabit({
      userId,
      habitId: 'h_essential',
      logicalDate: yesterday,
    });

    const userBefore = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', [userId]);
    const pointsBefore = userBefore.puntos;
    expect(pointsBefore).toBeGreaterThan(100);

    // Mascota 1 muere y se adopta nueva
    const pet1 = await petService.getPet(userId);
    await petService.applyHealthChange(pet1.id, -100, userId);
    await petService.adoptNewPet(userId);

    // Comprobar que el usuario no perdió sus puntos
    const userAfter = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', [userId]);
    expect(userAfter.puntos).toBe(pointsBefore);

    // Comprobar que el log de cumplimiento histórico de ayer sigue existiendo
    const logHistory = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h_essential', yesterday]);
    expect(logHistory).not.toBeNull();
    expect(logHistory.completado).toBe(1);

    // Comprobar que el log de hoy también sigue existiendo
    const logToday = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h_normal', mockDateToday]);
    expect(logToday).not.toBeNull();
    expect(logToday.completado).toBe(1);

    // Comprobar que los hábitos siguen activos
    const habits = await db.getAllAsync('SELECT * FROM habits WHERE userId = ?', [userId]);
    expect(habits.length).toBe(2);
  });
});
