import { DatabaseSync } from 'node:sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMigrations } from '../../db/migrator';
import { UserRepository } from '../../storage/UserRepository';
import { PetRepository } from '../../storage/PetRepository';
import { HabitRepository } from '../../storage/HabitRepository';
import { LogRepository } from '../../storage/LogRepository';
import { useHabitStore } from '../useHabitStore';
import { useLogStore } from '../useLogStore';
import { useUserStore } from '../useUserStore';
import { usePetStore } from '../usePetStore';
import { useStatsStore } from '../useStatsStore';
import { useHeatmapStore } from '../useHeatmapStore';
import { Habit, HabitLog, PetState, Priority, VerificationType } from '../../types';

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

describe('Consistencia de Arquitectura de Stores (Habitail)', () => {
  let testAdapter: RealSqliteTestAdapter;
  let db: any;
  let userRepo: UserRepository;
  let petRepo: PetRepository;
  let habitRepo: HabitRepository;
  let logRepo: LogRepository;

  beforeEach(async () => {
    // Limpiar almacenamiento en memoria AsyncStorage
    await AsyncStorage.clear();

    // Crear base de datos SQLite real en memoria
    testAdapter = new RealSqliteTestAdapter();
    db = testAdapter.asExpoDb();
    (globalThis as any)._dbPromise = Promise.resolve(db);

    // Aplicar esquema canónico v1 - v8
    await runMigrations(db);

    userRepo = new UserRepository();
    petRepo = new PetRepository();
    habitRepo = new HabitRepository();
    logRepo = new LogRepository();

    // Resetear estados en memoria de Zustand
    useUserStore.setState({ user: null });
    useHabitStore.setState({ habits: [] });
    usePetStore.setState({ pet: null });
    useLogStore.setState({ logs: [] });
    useStatsStore.setState({ cache: {} });
    useHeatmapStore.setState({ cache: {} });
  });

  afterEach(async () => {
    testAdapter.close();
    delete (globalThis as any)._dbPromise;
  });

  it('1. Store vs DB tras actualización: el store debe reflejar la entidad hidratada con scheduleHistory', async () => {
    // 1. Inicializar usuario y hábito
    await useUserStore.getState().loadUser('user-test-1');
    const habitData: Omit<Habit, 'id'> = {
      userId: 'user-test-1',
      nombre: 'Hacer Ejercicio',
      categoria: 'DEPORTE',
      icono: 'barbell',
      colorHex: '#3b82f6',
      frecuencia: 'DAILY',
      diasSemana: [1, 2, 3, 4, 5],
      nivelPrioridad: 'ESSENTIAL',
      tipoVerificacion: 'BOOLEAN',
      fechaInicio: '2026-10-15',
      activo: true,
    };

    await useHabitStore.getState().addHabit(habitData);
    const addedHabit = useHabitStore.getState().habits[0];
    expect(addedHabit).toBeDefined();

    // 2. Modificar el hábito
    await useHabitStore.getState().updateHabit(addedHabit.id, {
      nombre: 'Hacer Ejercicio Intenso',
      frecuencia: 'WEEKLY',
      diasSemana: [1, 3, 5],
    });

    // 3. Comprobar que el store tiene la entidad hidratada exactamente igual a la DB
    const habitInDb = await habitRepo.getById(addedHabit.id);
    const habitInStore = useHabitStore.getState().habits.find((h) => h.id === addedHabit.id);

    expect(habitInStore).toBeDefined();
    expect(habitInDb).toBeDefined();
    expect(habitInStore?.nombre).toBe('Hacer Ejercicio Intenso');
    expect(habitInStore?.frecuencia).toBe('WEEKLY');
    expect(habitInStore?.diasSemana).toEqual([1, 3, 5]);

    // Verificar que scheduleHistory está completamente hidratado en el store
    expect(habitInStore?.scheduleHistory).toBeDefined();
    expect(habitInStore?.scheduleHistory).toEqual(habitInDb?.scheduleHistory);
    expect(habitInStore?.scheduleHistory?.length).toBeGreaterThan(0);
  });

  it('2. Eliminación de log y refresco del día: logs eliminados de DB no sobreviven en memoria', async () => {
    // Crear usuario y hábitos para respetar claves foráneas
    await userRepo.create({
      id: 'user-1',
      username: 'User 1',
      fechaRegistro: new Date().toISOString(),
      puntos: 0,
      onboardingCompleted: true,
    });
    await habitRepo.create({
      id: 'habit-1',
      userId: 'user-1',
      nombre: 'Hábito 1',
      categoria: 'SALUD',
      icono: 'water',
      colorHex: '#00bcd4',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });
    await habitRepo.create({
      id: 'habit-2',
      userId: 'user-1',
      nombre: 'Hábito 2',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4caf50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    const date = '2026-10-15';
    const log1: HabitLog = {
      id: 'log-1',
      habitId: 'habit-1',
      userId: 'user-1',
      fecha: date,
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };
    const log2: HabitLog = {
      id: 'log-2',
      habitId: 'habit-2',
      userId: 'user-1',
      fecha: date,
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };

    // Guardar en DB
    await logRepo.upsert(log1);
    await logRepo.upsert(log2);

    // Cargar en el store
    await useLogStore.getState().getLogsForDay(date, 'user-1');
    expect(useLogStore.getState().logs).toHaveLength(2);

    // Eliminar log1 directamente de SQLite (simulando desmarcado o limpieza externa)
    await logRepo.deleteById('log-1');

    // Refrescar la fecha
    const refreshedLogs = await useLogStore.getState().getLogsForDay(date, 'user-1');

    // Comprobar que log1 ya NO sobrevive en memoria
    expect(refreshedLogs).toHaveLength(1);
    expect(refreshedLogs[0].id).toBe('log-2');
    expect(useLogStore.getState().logs.some((l) => l.id === 'log-1')).toBe(false);
  });

  it('3. Migración única desde AsyncStorage para hábitos y usuario', async () => {
    // A. Preparar datos heredados en AsyncStorage
    const legacyHabits = [
      {
        id: 'legacy-habit-1',
        userId: 'default-user',
        nombre: 'Beber agua',
        categoria: 'SALUD',
        icono: 'water',
        colorHex: '#00bcd4',
        frecuencia: 'DAILY',
        diasSemana: [0, 1, 2, 3, 4, 5, 6],
        fechaInicio: '2026-01-01',
        activo: 1,
      },
    ];
    await AsyncStorage.setItem('habit-storage', JSON.stringify({ state: { habits: legacyHabits } }));
    await AsyncStorage.setItem('@onboarding_completed', 'true');
    await AsyncStorage.setItem('habitail_user_last_opened_at', '1700000000000');

    // B. Ejecutar loadUser primero (crea el usuario y migra onboarding/lastOpened) y luego loadHabits
    await useUserStore.getState().loadUser();
    await useHabitStore.getState().loadHabits();

    // C. Verificar persistencia en SQLite
    const habitsInDb = await habitRepo.get('default-user');
    expect(habitsInDb).toHaveLength(1);
    expect(habitsInDb[0].nombre).toBe('Beber agua');

    const userInDb = await userRepo.get('default-user');
    expect(userInDb?.onboardingCompleted).toBe(true);
    expect(userInDb?.lastOpenedAt).toBe(1700000000000);

    // D. Verificar que las claves en AsyncStorage fueron eliminadas o marcadas como migradas
    expect(await AsyncStorage.getItem('@habit_storage_migrated')).toBe('true');
    expect(await AsyncStorage.getItem('habit-storage')).toBeNull();
    expect(await AsyncStorage.getItem('@onboarding_completed')).toBeNull();
    expect(await AsyncStorage.getItem('habitail_user_last_opened_at')).toBeNull();

    // E. Segunda ejecución: no vuelve a duplicar ni sobreescribir
    await useHabitStore.getState().loadHabits();
    expect(await habitRepo.get('default-user')).toHaveLength(1);
  });

  it('4. Reinicio de la app (Cold Start): rehidratación fiel desde SQLite', async () => {
    // 1. Crear datos en SQLite
    await userRepo.create({
      id: 'default-user',
      username: 'Ada Lovelace',
      fechaRegistro: new Date().toISOString(),
      puntos: 150,
      onboardingCompleted: true,
      lastOpenedAt: 1705000000,
    });
    await petRepo.create({
      id: 'pet-1',
      userId: 'default-user',
      vida: 85,
      nivel: 3,
      xp: 40,
      xpParaSiguienteNivel: 150,
      estadoActual: PetState.HAPPY,
      skinEquipada: 'golden-cat',
      accesorios: ['hat'],
    });
    await habitRepo.create({
      id: 'habit-cold-start',
      userId: 'default-user',
      nombre: 'Meditar',
      categoria: 'MENTE',
      icono: 'flower',
      colorHex: '#9c27b0',
      frecuencia: 'DAILY',
      diasSemana: [1, 2, 3, 4, 5, 6, 7],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });

    // 2. Simular reinicio: resetear Zustand a null / vacío
    useUserStore.setState({ user: null });
    usePetStore.setState({ pet: null });
    useHabitStore.setState({ habits: [] });
    useLogStore.setState({ logs: [] });

    // 3. Ejecutar carga secuencial como en RootLayout
    await useUserStore.getState().loadUser();
    await usePetStore.getState().loadPet();
    await useHabitStore.getState().loadHabits();
    await useLogStore.getState().loadLogs('2026-10-15');

    // 4. Aserciones de rehidratación
    expect(useUserStore.getState().user?.username).toBe('Ada Lovelace');
    expect(useUserStore.getState().user?.puntos).toBe(150);
    expect(usePetStore.getState().pet?.vida).toBe(85);
    expect(usePetStore.getState().pet?.skinEquipada).toBe('golden-cat');
    expect(useHabitStore.getState().habits).toHaveLength(1);
    expect(useHabitStore.getState().habits[0].nombre).toBe('Meditar');
  });

  it('5. Caches después de editar un horario: invalida stats y heatmap', async () => {
    await useUserStore.getState().loadUser(); // Asegura default-user en SQLite
    const habitId = 'habit-cache-test';
    await habitRepo.create({
      id: habitId,
      userId: 'default-user',
      nombre: 'Pasear',
      categoria: 'SALUD',
      icono: 'walk',
      colorHex: '#4caf50',
      frecuencia: 'DAILY',
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoVerificacion: VerificationType.BOOLEAN,
      nivelPrioridad: Priority.NORMAL,
      fechaInicio: '2026-10-15',
      activo: true,
    });
    await useHabitStore.getState().loadHabits();

    // Poblar cachés de stats y heatmap
    useStatsStore.getState().setData(`${habitId}:weekly`, { totalCompleted: 5, totalDays: 7, expectedCompletions: 7, completionRate: 71, currentStreak: 3, maxStreak: 5 });
    useStatsStore.getState().setData('global:weekly', { totalCompleted: 10, totalDays: 14, expectedCompletions: 14, completionRate: 71, currentStreak: 3, maxStreak: 5 });
    useHeatmapStore.getState().setData(habitId, [{ date: '2026-10-15', value: 2 }]);
    useHeatmapStore.getState().setData('global', [{ date: '2026-10-15', value: 2 }]);

    expect(useStatsStore.getState().cache[`${habitId}:weekly`]?.data).not.toBeNull();
    expect(useHeatmapStore.getState().cache[habitId]?.data).not.toBeNull();

    // Editar programación del hábito (días)
    await useHabitStore.getState().updateHabit(habitId, { diasSemana: [1, 2, 3, 4, 5] });

    // Los cachés del hábito y global deben haber sido invalidados
    expect(useStatsStore.getState().cache[`${habitId}:weekly`]).toBeUndefined();
    expect(useStatsStore.getState().cache['global:weekly']).toBeUndefined();
    expect(useHeatmapStore.getState().cache[habitId]).toBeUndefined();
    expect(useHeatmapStore.getState().cache['global']).toBeUndefined();
  });

  it('6. Badges sin duplicados en store ni en persistencia SQLite', async () => {
    await useUserStore.getState().loadUser('user-badges');

    const badge1 = { id: 'badge-fire', name: 'Racha Imparable' };

    // Añadir la misma insignia dos veces
    await useUserStore.getState().addBadges([badge1]);
    await useUserStore.getState().addBadges([badge1]);

    const user = useUserStore.getState().user;
    expect(user?.badges).toEqual(['badge-fire']);

    // Verificar en SQLite que no se duplicó
    const rows = await db.getAllAsync('SELECT * FROM user_badges WHERE userId = ?', ['user-badges']);
    expect(rows).toHaveLength(1);
  });

  it('7. Puntos nunca negativos: clamp a cero ante deltas que superen el saldo', async () => {
    await useUserStore.getState().loadUser('user-points');
    await useUserStore.getState().updatePoints(30);
    expect(useUserStore.getState().user?.puntos).toBe(30);

    // Intentar restar 50 puntos
    await useUserStore.getState().updatePoints(-50);

    // Store debe ser 0, nunca negativo
    expect(useUserStore.getState().user?.puntos).toBe(0);

    // SQLite debe ser 0
    const dbUser = await userRepo.getByUserId('user-points');
    expect(dbUser?.puntos).toBe(0);
  });
});
