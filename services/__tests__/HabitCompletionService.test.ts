import { HabitCompletionService } from '../HabitCompletionService';
import { runMigrations } from '../../db/migrator';
import { DatabaseSync } from 'node:sqlite';
import { Priority, Category, Frequency, VerificationType, PetState } from '../../types';

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

describe('HabitCompletionService', () => {
  let testAdapter: RealSqliteTestAdapter;
  let db: any;
  let service: HabitCompletionService;

  const mockDateToday = '2026-05-22'; // Viernes (day 5)

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(`${mockDateToday}T12:00:00Z`));

    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    // Ejecuta las migraciones completas (v1 hasta v7)
    await runMigrations(db);

    // Habilitar foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Insertar datos de prueba base: Usuario, Mascota y Hábitos
    await db.runAsync(
      `INSERT INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['u1', 'TestUser', 'test@test.com', null, '2026-01-01T00:00:00Z', 100, 1]
    );

    await db.runAsync(
      `INSERT INTO pets (id, userId, vida, nivel, xp, xpParaSiguienteNivel, estadoActual, skinEquipada, accesorios)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p1', 'u1', 50, 1, 0, 100, PetState.CONFUSED, 'default-cat', '[]']
    );

    // Hábito 1: ESSENTIAL, DAILY
    await db.runAsync(
      `INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['h1', 'u1', 'Hábito Esencial', Category.SALUD, 'heart', '#ff0000', Frequency.DAILY, JSON.stringify([0, 1, 2, 3, 4, 5, 6]), VerificationType.BOOLEAN, Priority.ESSENTIAL, '2026-01-01', 1]
    );

    // Hábito 2: NORMAL, WEEKLY (solo Lunes, Miércoles, Viernes = 1, 3, 5)
    await db.runAsync(
      `INSERT INTO habits (id, userId, nombre, categoria, icono, colorHex, frecuencia, diasSemana, tipoVerificacion, nivelPrioridad, fechaInicio, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['h-weekly', 'u1', 'Hábito Semanal', Category.DEPORTE, 'run', '#00ff00', Frequency.WEEKLY, JSON.stringify([1, 3, 5]), VerificationType.BOOLEAN, Priority.NORMAL, '2026-01-01', 1]
    );

    service = new HabitCompletionService();
  });

  afterEach(() => {
    testAdapter.close();
    delete (globalThis as any)._dbPromise;
    jest.useRealTimers();
  });

  describe('Validaciones de Dominio y Precondiciones', () => {
    test('falla si el usuario no existe', async () => {
      await expect(
        service.completeHabit({
          userId: 'non-existent-user',
          habitId: 'h1',
          logicalDate: mockDateToday,
        })
      ).rejects.toThrow('User not found: non-existent-user');
    });

    test('falla si el hábito no existe', async () => {
      await expect(
        service.completeHabit({
          userId: 'u1',
          habitId: 'non-existent-habit',
          logicalDate: mockDateToday,
        })
      ).rejects.toThrow('Habit not found: non-existent-habit');
    });

    test('falla si el hábito no pertenece al usuario', async () => {
      // Crear otro usuario
      await db.runAsync(
        `INSERT INTO users (id, username, fechaRegistro, puntos, onboardingCompleted) VALUES (?, ?, ?, ?, ?)`,
        ['u2', 'OtherUser', '2026-01-01T00:00:00Z', 0, 1]
      );

      await expect(
        service.completeHabit({
          userId: 'u2',
          habitId: 'h1',
          logicalDate: mockDateToday,
        })
      ).rejects.toThrow('Habit h1 does not belong to user u2');
    });

    test('completar en el futuro está prohibido y lanza error', async () => {
      // Mañana: 2026-05-23
      await expect(
        service.completeHabit({
          userId: 'u1',
          habitId: 'h1',
          logicalDate: '2026-05-23',
        })
      ).rejects.toThrow('Cannot complete habit for a future date: 2026-05-23');
    });

    test('desmarcar en el futuro está prohibido y lanza error', async () => {
      await expect(
        service.uncompleteHabit({
          userId: 'u1',
          habitId: 'h1',
          logicalDate: '2026-05-23',
        })
      ).rejects.toThrow('Cannot uncomplete habit for a future date: 2026-05-23');
    });

    test('completar en un día no programado está prohibido y lanza error', async () => {
      // 2026-05-21 fue Jueves (día 4). h-weekly solo está programado para [1, 3, 5] (L, M, V)
      await expect(
        service.completeHabit({
          userId: 'u1',
          habitId: 'h-weekly',
          logicalDate: '2026-05-21',
        })
      ).rejects.toThrow('Habit h-weekly is not scheduled on date 2026-05-21');
    });
  });

  describe('Check-In de Hoy vs Pasado (Anti-exploit)', () => {
    test('check-in de HOY suma salud a la mascota y puntos al usuario', async () => {
      const result = await service.completeHabit({
        userId: 'u1',
        habitId: 'h1',
        logicalDate: mockDateToday,
        source: 'UI',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyCompleted).toBe(false);
      expect(result.healthDelta).toBe(20); // ESSENTIAL
      expect(result.pointsDelta).toBe(20); // ESSENTIAL
      expect(result.newHealth).toBe(70);   // 50 + 20
      expect(result.newPoints).toBe(120);  // 100 + 20

      // Verificar persistencia en SQLite
      const pet = await db.getFirstAsync('SELECT * FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(70);
      expect(pet.estadoActual).toBe(PetState.CHEERING);

      const user = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', ['u1']);
      expect(user.puntos).toBe(120);

      const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(log).not.toBeNull();
      expect(log.completado).toBe(1);

      const event = await db.getFirstAsync('SELECT * FROM gamification_events WHERE eventKey = ?', [result.eventKey]);
      expect(event).not.toBeNull();
      expect(event.healthDelta).toBe(20);
      expect(event.pointsDelta).toBe(20);
      expect(event.isReverted).toBe(0);
    });

    test('IRREVERSIBILIDAD: si la mascota está en vida 0 (ABSENT), un check-in positivo no le devuelve vida', async () => {
      // Forzar mascota a estado terminal (vida = 0, ABSENT)
      await db.runAsync('UPDATE pets SET vida = 0, estadoActual = ? WHERE id = ?', [PetState.ABSENT, 'p1']);

      const result = await service.completeHabit({
        userId: 'u1',
        habitId: 'h1', // Hábito ESSENTIAL (+20)
        logicalDate: mockDateToday,
        source: 'UI',
      });

      expect(result.success).toBe(true);

      // La mascota en SQLite debe permanecer estrictamente en vida = 0 y ABSENT
      const pet = await db.getFirstAsync('SELECT * FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(0);
      expect(pet.estadoActual).toBe(PetState.ABSENT);

      // Puntos sí se otorgan al usuario aunque la mascota haya partido
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(user.puntos).toBe(120);
    });

    test('corrección de una FECHA PASADA: crea log pero NO cura ni concede puntos retroactivos', async () => {
      // 2026-05-20 fue Miércoles (programado para h-weekly y h1)
      const pastDate = '2026-05-20';

      const result = await service.completeHabit({
        userId: 'u1',
        habitId: 'h1',
        logicalDate: pastDate,
        source: 'UI',
      });

      expect(result.success).toBe(true);
      expect(result.isHistorical).toBe(true);
      expect(result.healthDelta).toBe(0);
      expect(result.pointsDelta).toBe(0);

      // La mascota y los puntos se mantienen intactos
      const pet = await db.getFirstAsync('SELECT * FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(50);

      const user = await db.getFirstAsync('SELECT * FROM users WHERE id = ?', ['u1']);
      expect(user.puntos).toBe(100);

      // Pero el log sí se creó en SQLite para estadísticas e historial
      const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', pastDate]);
      expect(log).not.toBeNull();
      expect(log.completado).toBe(1);

      // Evento registrado con deltas 0
      const event = await db.getFirstAsync('SELECT * FROM gamification_events WHERE eventKey = ?', [result.eventKey]);
      expect(event.healthDelta).toBe(0);
      expect(event.pointsDelta).toBe(0);
    });
  });

  describe('Ciclo Completar / Desmarcar / Recompletar y Toggling', () => {
    test('completar, desmarcar y volver a completar restaura exactamente la recompensa sin duplicar', async () => {
      // 1. Completar hoy
      const r1 = await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(r1.healthDelta).toBe(20);
      expect(r1.pointsDelta).toBe(20);
      let pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      let user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);

      // 2. Desmarcar
      const r2 = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(r2.healthDeltaReverted).toBe(20);
      expect(r2.pointsDeltaReverted).toBe(20);
      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(50);
      expect(user.puntos).toBe(100);

      const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(log).toBeNull();

      const event = await db.getFirstAsync('SELECT * FROM gamification_events WHERE eventKey = ?', [r1.eventKey]);
      expect(event.isReverted).toBe(1);

      // 3. Volver a completar hoy: restaura la recompensa
      const r3 = await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(r3.healthDelta).toBe(20);
      expect(r3.pointsDelta).toBe(20);
      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);
    });

    test('alternar checkbox 20 veces nunca genera puntos ni vida extra', async () => {
      // 1 vez completado inicial
      await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });

      // 20 alternancias de desmarcar y volver a marcar
      for (let i = 0; i < 20; i++) {
        await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
        await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      }

      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);

      // El resultado final debe ser EXACTAMENTE el valor de 1 sola completitud (50+20=70, 100+20=120)
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);

      // Y exactamente 1 fila en habit_logs y 1 en gamification_events
      const logRows = await db.getAllAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(logRows).toHaveLength(1);

      const eventRows = await db.getAllAsync('SELECT * FROM gamification_events WHERE habitId = ? AND logicalDate = ?', ['h1', mockDateToday]);
      expect(eventRows).toHaveLength(1);
    });

    test('prioridad modificada entre completar y desmarcar: revierte el delta original, NO la nueva prioridad', async () => {
      // 1. Completar hábito como ESSENTIAL (+20 salud, +20 puntos)
      await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });

      let pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      let user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);

      // 2. Modificar la prioridad del hábito a FLEXIBLE (que otorgaría solo +5 salud, +5 puntos)
      await db.runAsync('UPDATE habits SET nivelPrioridad = ? WHERE id = ?', [Priority.FLEXIBLE, 'h1']);

      // 3. Desmarcar: debe buscar en el ledger y revertir 20 (el delta otorgado), NO 5
      const uncompleteRes = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(uncompleteRes.healthDeltaReverted).toBe(20);
      expect(uncompleteRes.pointsDeltaReverted).toBe(20);

      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(50); // Exactamente vuelto a la vida inicial
      expect(user.puntos).toBe(100); // Exactamente vuelto a los puntos iniciales
    });
  });

  describe('Concurrencia e Idempotencia', () => {
    test('dos llamadas simultáneas a completeHabit resultan en exactamente 1 log y 1 recompensa', async () => {
      const [r1, r2] = await Promise.all([
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday, source: 'UI' }),
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday, source: 'UI' }),
      ]);

      // Una se aplicó y la otra fue detectada como alreadyCompleted
      const applied = [r1, r2].filter((r) => !r.alreadyCompleted);
      const redundant = [r1, r2].filter((r) => r.alreadyCompleted);

      expect(applied).toHaveLength(1);
      expect(redundant).toHaveLength(1);

      // Base de datos tiene exactamente 1 log
      const logs = await db.getAllAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(logs).toHaveLength(1);

      // Recompensas aplicadas solo una vez
      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);
    });

    test('10 llamadas simultáneas a completeHabit resultan en exactamente 1 log y 1 recompensa', async () => {
      const promises = Array.from({ length: 10 }, (_, index) =>
        service.completeHabit({
          userId: 'u1',
          habitId: 'h1',
          logicalDate: mockDateToday,
          source: `CALL_${index}`,
        })
      );

      const results = await Promise.all(promises);

      const applied = results.filter((r) => !r.alreadyCompleted);
      const duplicates = results.filter((r) => r.alreadyCompleted);

      expect(applied).toHaveLength(1);
      expect(duplicates).toHaveLength(9);

      // 1 log en DB
      const logs = await db.getAllAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(logs).toHaveLength(1);

      // 1 sola recompensa
      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(pet.vida).toBe(70);
      expect(user.puntos).toBe(120);
    });

    test('completar desde UI + acción de notificación simultáneamente resulta en 1 log y 1 recompensa', async () => {
      const [uiRes, notifRes] = await Promise.all([
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday, source: 'UI' }),
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday, source: 'NOTIFICATION' }),
      ]);

      const appliedCount = [uiRes, notifRes].filter((r) => !r.alreadyCompleted).length;
      expect(appliedCount).toBe(1);

      const logs = await db.getAllAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(logs).toHaveLength(1);

      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(70);
    });

    test('completar y desmarcar simultáneamente no corrompe el estado y limpia los bloqueos', async () => {
      // Lanzamos completar y desmarcar en paralelo
      const [compRes, uncompRes] = await Promise.all([
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
      ]);

      expect(compRes.success).toBe(true);
      expect(uncompRes.success).toBe(true);

      // Dado que se ejecutaron secuencialmente bajo el mismo cerrojo:
      // Si completeHabit fue primero: completó (+20) y uncompleteHabit desmarcó (-20). Estado final: desmarcado.
      // Si uncompleteHabit fue primero: no hizo nada (alreadyUncompleted) y completeHabit marcó (+20).
      // En cualquiera de los dos casos, el estado de DB debe ser coherente.
      const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);

      if (log && log.completado === 1) {
        expect(pet.vida).toBe(70);
        expect(user.puntos).toBe(120);
      } else {
        expect(log).toBeNull();
        expect(pet.vida).toBe(50);
        expect(user.puntos).toBe(100);
      }

      // El mapa de mutexes debe estar completamente limpio
      expect((service as any).mutexes.size).toBe(0);
    });

    test('operaciones sobre hábitos distintos se ejecutan independientemente y limpian sus bloqueos', async () => {
      const [res1, resWeekly] = await Promise.all([
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.completeHabit({ userId: 'u1', habitId: 'h-weekly', logicalDate: mockDateToday }),
      ]);

      expect(res1.success).toBe(true);
      expect(res1.alreadyCompleted).toBe(false);
      expect(resWeekly.success).toBe(true);
      expect(resWeekly.alreadyCompleted).toBe(false);

      const logs = await db.getAllAsync('SELECT * FROM habit_logs WHERE fecha = ?', [mockDateToday]);
      expect(logs).toHaveLength(2);

      // El mapa no debe acumular entradas
      expect((service as any).mutexes.size).toBe(0);
    });

    test('error durante una operación no bloquea futuras operaciones y limpia el Map', async () => {
      // Simular un error en la primera operación pasando un usuario inexistente
      await expect(
        service.completeHabit({ userId: 'non-existent', habitId: 'h1', logicalDate: mockDateToday })
      ).rejects.toThrow('User not found: non-existent');

      // Comprobar que el Map limpió la entrada a pesar del error
      expect((service as any).mutexes.size).toBe(0);

      // Nueva operación sobre el mismo hábito después del error debe completarse exitosamente
      const recoveryRes = await service.completeHabit({
        userId: 'u1',
        habitId: 'h1',
        logicalDate: mockDateToday,
      });

      expect(recoveryRes.success).toBe(true);
      expect(recoveryRes.alreadyCompleted).toBe(false);
      expect((service as any).mutexes.size).toBe(0);
    });

    test('el Map de mutexes no acumula entradas innecesarias tras ráfaga secuencial y concurrente', async () => {
      // Ráfaga concurrente de 5 operaciones sobre el mismo hábito
      await Promise.all([
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
        service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday }),
      ]);

      expect((service as any).mutexes.size).toBe(0);
    });
  });

  describe('Crash Safety y Rollback por error de DB', () => {
    test('rollback por error de DB no deja log sin puntos ni vida sin log', async () => {
      // Simular fallo en SQLite durante la transacción interceptando runAsync
      const originalRunAsync = db.runAsync.bind(db);
      let runCount = 0;

      db.runAsync = async (sql: string, params: unknown[] = []) => {
        // Dejar pasar la primera inserción en habit_logs y fallar en el UPDATE de pets
        if (sql.includes('UPDATE pets SET vida')) {
          throw new Error('SIMULATED_DATABASE_IO_CRASH');
        }
        return originalRunAsync(sql, params);
      };

      await expect(
        service.completeHabit({
          userId: 'u1',
          habitId: 'h1',
          logicalDate: mockDateToday,
        })
      ).rejects.toThrow('SIMULATED_DATABASE_IO_CRASH');

      // Restaurar runAsync
      db.runAsync = originalRunAsync;

      // Verificar que el rollback fue completo:
      // NO hay log huérfano en habit_logs
      const log = await db.getFirstAsync('SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?', ['h1', mockDateToday]);
      expect(log).toBeNull();

      // La vida no se modificó
      const pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(50);

      // Los puntos no se modificaron
      const user = await db.getFirstAsync('SELECT puntos FROM users WHERE id = ?', ['u1']);
      expect(user.puntos).toBe(100);

      // El evento no se guardó
      const event = await db.getFirstAsync('SELECT * FROM gamification_events WHERE eventKey = ?', [`completion:h1:${mockDateToday}`]);
      expect(event).toBeNull();
    });
  });

  describe('Pruebas Específicas de Recompensas de Salud y Reversión', () => {
    test('Salud 30 y recompensa +20: alcanza 50 HP y al desmarcar vuelve a 30 HP', async () => {
      await db.runAsync('UPDATE pets SET vida = 30, estadoActual = ? WHERE id = ?', [PetState.CONFUSED, 'p1']);

      const compRes = await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(compRes.healthDelta).toBe(20);
      expect(compRes.appliedHealthDelta).toBe(20);
      expect(compRes.newHealth).toBe(50);

      let pet = await db.getFirstAsync('SELECT vida, estadoActual FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(50);
      expect(pet.estadoActual).toBe(PetState.CONFUSED);

      const uncompRes = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(uncompRes.appliedHealthDeltaReverted).toBe(20);
      expect(uncompRes.newHealth).toBe(30);

      pet = await db.getFirstAsync('SELECT vida, estadoActual FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(30);
    });

    test('Salud 95 y recompensa +20: alcanza tope de 100 HP, registra appliedHealthDelta=5 y al desmarcar vuelve exactamente a 95 HP', async () => {
      // Caso clave reportado por el usuario:
      // Salud 95 + 20 -> tope 100. Al desmarcar, debe volver a 95 y NO a 80.
      await db.runAsync('UPDATE pets SET vida = 95, estadoActual = ? WHERE id = ?', [PetState.HAPPY, 'p1']);

      const compRes = await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(compRes.healthDelta).toBe(20); // Recompensa teórica
      expect(compRes.appliedHealthDelta).toBe(5); // Incremento efectivamente aplicado
      expect(compRes.newHealth).toBe(100);

      let pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(100);

      const event = await db.getFirstAsync('SELECT * FROM gamification_events WHERE eventKey = ?', [compRes.eventKey]);
      expect(event.healthDelta).toBe(20);
      expect(event.appliedHealthDelta).toBe(5);

      // Desmarcar hábito
      const uncompRes = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(uncompRes.healthDeltaReverted).toBe(20);
      expect(uncompRes.appliedHealthDeltaReverted).toBe(5);
      expect(uncompRes.newHealth).toBe(95);

      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(95); // Vuelve exactamente a 95
    });

    test('Salud 100 y recompensa +20: se mantiene en 100 HP, appliedHealthDelta=0 y al desmarcar queda en 100 HP', async () => {
      await db.runAsync('UPDATE pets SET vida = 100, estadoActual = ? WHERE id = ?', [PetState.HAPPY, 'p1']);

      const compRes = await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(compRes.healthDelta).toBe(20);
      expect(compRes.appliedHealthDelta).toBe(0);
      expect(compRes.newHealth).toBe(100);

      let pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(100);

      const uncompRes = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(uncompRes.appliedHealthDeltaReverted).toBe(0);
      expect(uncompRes.newHealth).toBe(100);

      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(100);
    });

    test('Desmarcar un hábito después de que la salud haya cambiado por otra operación intermedia respeta el clamp y el delta aplicado', async () => {
      // 1. Salud inicial: 90
      await db.runAsync('UPDATE pets SET vida = 90, estadoActual = ? WHERE id = ?', [PetState.HAPPY, 'p1']);

      // 2. Completar hábito ESSENTIAL (+20) -> sube a 100, appliedHealthDelta = 10
      await service.completeHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      let pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(100);

      // 3. Otra operación intermedia modifica la vida (por ejemplo una penalización o daño resta 20 -> vida queda en 80)
      await db.runAsync('UPDATE pets SET vida = 80 WHERE id = ?', ['p1']);

      // 4. Se desmarca el hábito original: debe restar exactamente el incremento aplicado (+10), dejando la salud en 70 (80 - 10)
      const uncompRes = await service.uncompleteHabit({ userId: 'u1', habitId: 'h1', logicalDate: mockDateToday });
      expect(uncompRes.appliedHealthDeltaReverted).toBe(10);
      expect(uncompRes.newHealth).toBe(70);

      pet = await db.getFirstAsync('SELECT vida FROM pets WHERE id = ?', ['p1']);
      expect(pet.vida).toBe(70);
    });
  });
});
