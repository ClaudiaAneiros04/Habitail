import { DatabaseSync } from 'node:sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMigrations } from '../../db/migrator';
import { HabitRepository } from '../../storage/HabitRepository';
import {
  useHabitStore,
  HABIT_MIGRATION_KEY,
  LEGACY_HABIT_STORAGE_KEY,
  migrateLegacyHabits,
} from '../useHabitStore';
import { useUserStore } from '../useUserStore';
import { Habit } from '../../types';

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

describe('Sistema de Migración de Hábitos (AsyncStorage -> SQLite)', () => {
  let testAdapter: RealSqliteTestAdapter;
  let db: any;
  let habitRepo: HabitRepository;

  const createSampleHabit = (index: number, overrides: Partial<any> = {}) => ({
    id: `habit-legacy-${index}`,
    userId: 'user-migration-test',
    nombre: `Hábito Migrado #${index}`,
    descripcion: `Descripción del hábito legacy #${index}`,
    categoria: index % 2 === 0 ? 'SALUD' : 'PRODUCTIVIDAD',
    icono: index % 2 === 0 ? 'heart' : 'briefcase',
    colorHex: '#3b82f6',
    frecuencia: 'DAILY',
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    horaRecordatorio: `0${(index % 9) + 1}:00`,
    tipoVerificacion: 'BOOLEAN',
    nivelPrioridad: 'NORMAL',
    fechaInicio: '2026-01-01',
    fechaFin: undefined,
    activo: true,
    ...overrides,
  });

  beforeEach(async () => {
    await AsyncStorage.clear();

    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    await runMigrations(db);

    habitRepo = new HabitRepository();
    useHabitStore.setState({ habits: [] });
    useUserStore.setState({ user: null });
  });

  afterEach(async () => {
    testAdapter.close();
    delete (globalThis as any)._dbPromise;
  });

  it('Escenario 1: Migración de 20 hábitos completada correctamente con conservación de campos', async () => {
    // Generar 20 hábitos en el formato original de habit-storage en AsyncStorage
    const twentyHabits = Array.from({ length: 20 }, (_, i) => createSampleHabit(i + 1));
    await AsyncStorage.setItem(
      LEGACY_HABIT_STORAGE_KEY,
      JSON.stringify({
        state: { habits: twentyHabits },
        version: 0,
      })
    );

    // Ejecutar loadHabits
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    // 1. Verificar que los 20 hábitos están guardados en SQLite
    const inDb = await habitRepo.get('user-migration-test');
    expect(inDb).toHaveLength(20);

    // 2. Verificar que el store Zustand se hidrató con los 20 hábitos
    const inStore = useHabitStore.getState().habits;
    expect(inStore).toHaveLength(20);

    // 3. Verificar que se conservaron los identificadores y todos los campos
    for (let i = 0; i < 20; i++) {
      const original = twentyHabits[i];
      const saved = inDb.find((h) => h.id === original.id);
      expect(saved).toBeDefined();
      expect(saved!.nombre).toBe(original.nombre);
      expect(saved!.descripcion).toBe(original.descripcion);
      expect(saved!.categoria).toBe(original.categoria);
      expect(saved!.icono).toBe(original.icono);
      expect(saved!.colorHex).toBe(original.colorHex);
      expect(saved!.frecuencia).toBe(original.frecuencia);
      expect(saved!.diasSemana).toEqual(original.diasSemana);
      expect(saved!.horaRecordatorio).toBe(original.horaRecordatorio);
      expect(saved!.tipoVerificacion).toBe(original.tipoVerificacion);
      expect(saved!.nivelPrioridad).toBe(original.nivelPrioridad);
      expect(saved!.fechaInicio).toBe(original.fechaInicio);
      expect(saved!.activo).toBe(true);
      expect(saved!.userId).toBe('user-migration-test');
      expect(saved!.scheduleHistory).toBeDefined();
      expect(saved!.scheduleHistory!.length).toBeGreaterThanOrEqual(1);
    }

    // 4. Verificar que se marcó la migración como completada
    const migrationFlag = await AsyncStorage.getItem(HABIT_MIGRATION_KEY);
    expect(migrationFlag).toBe('true');

    // 5. Verificar que habit-storage fue removido de AsyncStorage
    const legacyAfter = await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY);
    expect(legacyAfter).toBeNull();
  });

  it('Escenario 2: Error al migrar el hábito número 10 -> Transacción atómica rollback y NO se borra AsyncStorage', async () => {
    const twentyHabits = Array.from({ length: 20 }, (_, i) => createSampleHabit(i + 1));
    const legacyPayload = JSON.stringify({
      state: { habits: twentyHabits },
      version: 0,
    });
    await AsyncStorage.setItem(LEGACY_HABIT_STORAGE_KEY, legacyPayload);

    // Espiamos upsertMany o simulamos fallo en el hábito 10
    const originalUpsertMany = habitRepo.upsertMany!.bind(habitRepo);
    jest.spyOn(habitRepo, 'upsertMany').mockImplementation(async (habits: Habit[]) => {
      // Usar la transacción real pero provocar un error en el elemento 10
      await db.withTransactionAsync(async () => {
        let count = 0;
        for (const habit of habits) {
          count++;
          if (count === 10) {
            throw new Error('Fallo simulado en SQLite al insertar hábito #10');
          }
          await (habitRepo as any).upsertHabitInternal(db, habit);
        }
      });
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Intentamos cargar hábitos
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    // 1. La transacción en SQLite se revirtió: debe haber 0 hábitos en SQLite
    const inDbAfterError = await habitRepo.get('user-migration-test');
    expect(inDbAfterError).toHaveLength(0);

    // 2. AsyncStorage NO debe haber eliminado habit-storage (Garantía contra pérdida de datos)
    const legacyStillExists = await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY);
    expect(legacyStillExists).toBe(legacyPayload);

    // 3. NO debe estar marcado como completado
    const migrationFlag = await AsyncStorage.getItem(HABIT_MIGRATION_KEY);
    expect(migrationFlag).toBeNull();

    // 4. El error debe haberse registrado claramente
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    (habitRepo.upsertMany as jest.Mock).mockRestore();
  });

  it('Escenario 3: Reintento después de un error -> Éxito total sin duplicados ni pérdidas', async () => {
    const twentyHabits = Array.from({ length: 20 }, (_, i) => createSampleHabit(i + 1));
    const legacyPayload = JSON.stringify({
      state: { habits: twentyHabits },
      version: 0,
    });
    await AsyncStorage.setItem(LEGACY_HABIT_STORAGE_KEY, legacyPayload);

    // Paso 1: Primer intento falla en el hábito 10
    let failedOnce = false;
    jest.spyOn(habitRepo, 'upsertMany').mockImplementation(async (habits: Habit[]) => {
      if (!failedOnce) {
        failedOnce = true;
        await db.withTransactionAsync(async () => {
          let count = 0;
          for (const habit of habits) {
            count++;
            if (count === 10) {
              throw new Error('Error de conexión transitorio en hábito #10');
            }
            await (habitRepo as any).upsertHabitInternal(db, habit);
          }
        });
      } else {
        // Segundo intento: comportamiento normal
        await db.withTransactionAsync(async () => {
          for (const habit of habits) {
            await (habitRepo as any).upsertHabitInternal(db, habit);
          }
        });
      }
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Primer intento (falla)
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);
    expect(await habitRepo.get('user-migration-test')).toHaveLength(0);
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).not.toBeNull();
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBeNull();

    // Paso 2: Reintento (por ejemplo, el usuario reabre la app o se reintenta)
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    // Comprobaciones del reintento exitoso
    const inDb = await habitRepo.get('user-migration-test');
    expect(inDb).toHaveLength(20);
    expect(useHabitStore.getState().habits).toHaveLength(20);

    // No hay duplicaciones
    const uniqueIds = new Set(inDb.map((h) => h.id));
    expect(uniqueIds.size).toBe(20);

    // Ahora sí se marcó como migrado y se descartó AsyncStorage
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBe('true');
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).toBeNull();

    consoleSpy.mockRestore();
    (habitRepo.upsertMany as jest.Mock).mockRestore();
  });

  it('Escenario 4: Aplicación con SQLite ya inicializado y datos parciales', async () => {
    // 1. El usuario ya tiene 3 hábitos en SQLite
    const preExistingHabits: Habit[] = [
      createSampleHabit(101, { nombre: 'Hábito Preexistente 1', id: 'pre-1' }),
      createSampleHabit(102, { nombre: 'Hábito Preexistente 2', id: 'pre-2' }),
      createSampleHabit(1, { nombre: 'Hábito ya en SQLite con ID habit-legacy-1', id: 'habit-legacy-1' }),
    ];
    for (const h of preExistingHabits) {
      await habitRepo.create(h, { allowHistorical: true });
    }

    // Verificar que los 3 están en SQLite
    const initialInDb = await habitRepo.get('user-migration-test');
    expect(initialInDb).toHaveLength(3);

    // 2. AsyncStorage contiene 5 hábitos: 1 coincide con 'habit-legacy-1' y 4 son nuevos ('habit-legacy-2' a 'habit-legacy-5')
    const legacyHabits = [
      createSampleHabit(1, { nombre: 'Hábito 1 actualizado desde AsyncStorage' }),
      createSampleHabit(2),
      createSampleHabit(3),
      createSampleHabit(4),
      createSampleHabit(5),
    ];
    await AsyncStorage.setItem(
      LEGACY_HABIT_STORAGE_KEY,
      JSON.stringify({
        state: { habits: legacyHabits },
      })
    );

    // 3. Ejecutar loadHabits
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    const inDbAfter = await habitRepo.get('user-migration-test');

    // 4. Se conservan los 2 preexistentes + 1 actualizado + 4 nuevos = 7 hábitos en total
    expect(inDbAfter).toHaveLength(7);

    // 5. Verificar que NO hubo duplicación del id 'habit-legacy-1'
    const matchingLegacy1 = inDbAfter.filter((h) => h.id === 'habit-legacy-1');
    expect(matchingLegacy1).toHaveLength(1);

    // 6. Los preexistentes 'pre-1' y 'pre-2' no fueron eliminados
    expect(inDbAfter.some((h) => h.id === 'pre-1')).toBe(true);
    expect(inDbAfter.some((h) => h.id === 'pre-2')).toBe(true);

    // 7. Migración completada
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBe('true');
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).toBeNull();
  });

  it('Escenario 5: Aplicación sin información previa (Instalación nueva limpia)', async () => {
    // No hay nada en AsyncStorage ni en SQLite
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBeNull();

    // Ejecutar loadHabits
    await useHabitStore.getState().loadHabits('user-clean-install');

    // SQLite permanece vacío
    const inDb = await habitRepo.get('user-clean-install');
    expect(inDb).toHaveLength(0);

    // El store tiene 0 hábitos
    expect(useHabitStore.getState().habits).toHaveLength(0);

    // La migración se marca como completada de forma segura
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBe('true');
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).toBeNull();
  });

  it('Escenario 6: Migración ejecutada accidentalmente más de una vez (Llamadas concurrentes y llamadas posteriores)', async () => {
    const twentyHabits = Array.from({ length: 20 }, (_, i) => createSampleHabit(i + 1));
    await AsyncStorage.setItem(
      LEGACY_HABIT_STORAGE_KEY,
      JSON.stringify({
        state: { habits: twentyHabits },
      })
    );

    // 1. Simular llamadas concurrentes simultáneas a loadHabits
    await Promise.all([
      useHabitStore.getState().loadHabits('user-migration-test', habitRepo),
      useHabitStore.getState().loadHabits('user-migration-test', habitRepo),
      useHabitStore.getState().loadHabits('user-migration-test', habitRepo),
    ]);

    // Verificar que solo hay 20 hábitos, sin duplicados por concurrencia
    const inDb = await habitRepo.get('user-migration-test');
    expect(inDb).toHaveLength(20);
    const uniqueIds = new Set(inDb.map((h) => h.id));
    expect(uniqueIds.size).toBe(20);

    // 2. Simular una llamada posterior tras completarse la migración
    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    const inDbAfterSecondCall = await habitRepo.get('user-migration-test');
    expect(inDbAfterSecondCall).toHaveLength(20);
  });

  it('Resiliencia ante JSON corrupto en habit-storage: No elimina datos y registra error', async () => {
    const corruptedPayload = '{"state": {"habits": [ { id: "bad-json" ';
    await AsyncStorage.setItem(LEGACY_HABIT_STORAGE_KEY, corruptedPayload);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await useHabitStore.getState().loadHabits('user-migration-test', habitRepo);

    // No se borró el dato corrupto para permitir análisis/recuperación
    expect(await AsyncStorage.getItem(LEGACY_HABIT_STORAGE_KEY)).toBe(corruptedPayload);
    // No se marcó como completada
    expect(await AsyncStorage.getItem(HABIT_MIGRATION_KEY)).toBeNull();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[HabitMigration] Error crítico al deserializar JSON'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
