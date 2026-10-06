import {
  getHabitScheduleForDate,
  isHabitExpectedOnDate,
  getHabitsExpectedOnDate,
  countExpectedOccurrences,
  HabitScheduleSnapshot,
} from '../frequencyEngine';
import {
  toLogicalDate,
  toInstant,
  getLogicalToday,
  getCurrentInstant,
  addDaysToLogicalDate,
  subDaysFromLogicalDate,
  diffInDaysLogicalDates,
  compareLogicalDates,
  isLogicalDateBefore,
  isLogicalDateAfter,
  isLogicalDateBetween,
  getDayOfWeek,
  getDaysInMonth,
  isValidLogicalDate,
  parseLogicalDateUTC,
  formatLogicalDate,
  formatDateDB,
  generateLogId,
} from '../dateUtils';
import { Habit, HabitScheduleHistory, Frequency, Priority, VerificationType, Category } from '../../types';
import { DatabaseSync } from 'node:sqlite';
import { HabitRepository } from '../../storage/HabitRepository';
import { runMigrations } from '../../db/migrator';

// Helper para instanciar hábitos de prueba
const makeTestHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'habit-test-1',
  userId: 'user-1',
  nombre: 'Hábito Test',
  categoria: Category.SALUD,
  icono: 'leaf',
  colorHex: '#4CAF50',
  frecuencia: Frequency.DAILY,
  diasSemana: [0, 1, 2, 3, 4, 5, 6],
  tipoVerificacion: VerificationType.BOOLEAN,
  nivelPrioridad: Priority.NORMAL,
  fechaInicio: '2026-01-01',
  activo: true,
  ...overrides,
});

describe('Sistema Canónico de Fechas y Programación Histórica (Habitail)', () => {
  // ── 1. DAILY ───────────────────────────────────────────────────────────────
  describe('DAILY', () => {
    it('corresponde todos los días dentro de su intervalo activo', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.DAILY,
        fechaInicio: '2026-01-01',
      });

      expect(isHabitExpectedOnDate(habit, '2026-01-01')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-01-15')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-01-31')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-02-28')).toBe(true);

      const occurrences = countExpectedOccurrences(habit, '2026-01-01', '2026-01-10');
      expect(occurrences).toBe(10); // 10 días inclusivos
    });
  });

  // ── 2. WEEKLY lunes/miércoles/viernes ───────────────────────────────────────
  describe('WEEKLY lunes/miércoles/viernes', () => {
    it('solo corresponde lunes(1), miércoles(3) y viernes(5)', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3, 5],
        fechaInicio: '2026-01-01',
      });

      // 2026-01-05 es Lunes (1)
      expect(isHabitExpectedOnDate(habit, '2026-01-05')).toBe(true);
      // 2026-01-06 es Martes (2)
      expect(isHabitExpectedOnDate(habit, '2026-01-06')).toBe(false);
      // 2026-01-07 es Miércoles (3)
      expect(isHabitExpectedOnDate(habit, '2026-01-07')).toBe(true);
      // 2026-01-08 es Jueves (4)
      expect(isHabitExpectedOnDate(habit, '2026-01-08')).toBe(false);
      // 2026-01-09 es Viernes (5)
      expect(isHabitExpectedOnDate(habit, '2026-01-09')).toBe(true);
      // 2026-01-10 es Sábado (6)
      expect(isHabitExpectedOnDate(habit, '2026-01-10')).toBe(false);
      // 2026-01-11 es Domingo (0)
      expect(isHabitExpectedOnDate(habit, '2026-01-11')).toBe(false);

      // En la semana del 5 al 11 hay exactamente 3 ocurrencias
      expect(countExpectedOccurrences(habit, '2026-01-05', '2026-01-11')).toBe(3);
    });
  });

  // ── 3. WEEKLY domingo ──────────────────────────────────────────────────────
  describe('WEEKLY domingo', () => {
    it('soporta domingo tanto con 0 como normalizando 7 (datos antiguos)', () => {
      // domingo = 0
      const habitDom0 = makeTestHabit({
        frecuencia: Frequency.WEEKLY,
        diasSemana: [0],
        fechaInicio: '2026-01-01',
      });

      // domingo = 7 (legacy)
      const habitDom7 = makeTestHabit({
        frecuencia: Frequency.WEEKLY,
        diasSemana: [7],
        fechaInicio: '2026-01-01',
      });

      // 2026-01-11 es Domingo
      expect(isHabitExpectedOnDate(habitDom0, '2026-01-11')).toBe(true);
      expect(isHabitExpectedOnDate(habitDom7, '2026-01-11')).toBe(true);

      // 2026-01-12 es Lunes
      expect(isHabitExpectedOnDate(habitDom0, '2026-01-12')).toBe(false);
      expect(isHabitExpectedOnDate(habitDom7, '2026-01-12')).toBe(false);
    });
  });

  // ── 4. Hábito antes de fechaInicio ─────────────────────────────────────────
  describe('Hábito antes de fechaInicio', () => {
    it('no existía ni corresponde antes de fechaInicio, pero fechaInicio es inclusiva', () => {
      const habit = makeTestHabit({
        fechaInicio: '2026-05-10',
        frecuencia: Frequency.DAILY,
      });

      expect(getHabitScheduleForDate(habit, '2026-05-09')).toBeNull();
      expect(isHabitExpectedOnDate(habit, '2026-05-09')).toBe(false);

      // fechaInicio es inclusiva
      expect(getHabitScheduleForDate(habit, '2026-05-10')?.exists).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-05-10')).toBe(true);

      // Conteo previo a fechaInicio
      expect(countExpectedOccurrences(habit, '2026-05-01', '2026-05-09')).toBe(0);
      expect(countExpectedOccurrences(habit, '2026-05-01', '2026-05-10')).toBe(1);
    });
  });

  // ── 5. fechaFin ────────────────────────────────────────────────────────────
  describe('fechaFin', () => {
    it('fechaFin es inclusiva, pero días posteriores no corresponden', () => {
      const habit = makeTestHabit({
        fechaInicio: '2026-05-01',
        fechaFin: '2026-05-05',
        frecuencia: Frequency.DAILY,
      });

      expect(isHabitExpectedOnDate(habit, '2026-05-05')).toBe(true); // Inclusiva
      expect(isHabitExpectedOnDate(habit, '2026-05-06')).toBe(false); // Finalizado

      const scheduleAfter = getHabitScheduleForDate(habit, '2026-05-06');
      expect(scheduleAfter?.exists).toBe(true);
      expect(scheduleAfter?.active).toBe(false);

      expect(countExpectedOccurrences(habit, '2026-05-01', '2026-05-10')).toBe(5);
    });
  });

  // ── 6. Archivado ───────────────────────────────────────────────────────────
  describe('Archivado', () => {
    it('archivar NO modifica retrospectivamente los días anteriores', () => {
      const habit: Habit = makeTestHabit({
        id: 'h-archived',
        fechaInicio: '2026-01-01',
        frecuencia: Frequency.DAILY,
        activo: false, // archivado actualmente
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'h-archived',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-01-01',
            validUntil: '2026-02-01', // estuvo activo en enero
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'h-archived',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-02-01',
            validUntil: null, // archivado desde el 1 de febrero
            activo: false,
          },
        ],
      });

      // En enero sí correspondía
      expect(isHabitExpectedOnDate(habit, '2026-01-15')).toBe(true);
      expect(countExpectedOccurrences(habit, '2026-01-01', '2026-01-31')).toBe(31);

      // En febrero ya estaba archivado
      expect(isHabitExpectedOnDate(habit, '2026-02-01')).toBe(false);
      expect(isHabitExpectedOnDate(habit, '2026-02-15')).toBe(false);
      expect(countExpectedOccurrences(habit, '2026-02-01', '2026-02-28')).toBe(0);
    });
  });

  // ── 7. Reactivado ──────────────────────────────────────────────────────────
  describe('Reactivado', () => {
    it('reactivar inicia un nuevo intervalo activo sin reescribir el pasado inactivo', () => {
      const habit: Habit = makeTestHabit({
        id: 'h-reactivated',
        fechaInicio: '2026-01-01',
        activo: true,
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'h-reactivated',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-01-01',
            validUntil: '2026-02-01',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'h-reactivated',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-02-01',
            validUntil: '2026-03-01',
            activo: false, // archivado durante febrero
          },
          {
            id: 'sh-3',
            habitId: 'h-reactivated',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-03-01',
            validUntil: null,
            activo: true, // reactivado a partir de marzo
          },
        ],
      });

      // Enero: activo
      expect(isHabitExpectedOnDate(habit, '2026-01-10')).toBe(true);
      // Febrero: inactivo
      expect(isHabitExpectedOnDate(habit, '2026-02-10')).toBe(false);
      // Marzo: reactivado
      expect(isHabitExpectedOnDate(habit, '2026-03-10')).toBe(true);

      expect(countExpectedOccurrences(habit, '2026-01-01', '2026-03-31')).toBe(31 + 0 + 31);
    });
  });

  // ── 8. Cambio DAILY → WEEKLY ───────────────────────────────────────────────
  describe('Cambio DAILY → WEEKLY', () => {
    it('preserva DAILY en el intervalo antiguo y aplica WEEKLY en el nuevo intervalo', () => {
      const habit: Habit = makeTestHabit({
        id: 'h-d-to-w',
        fechaInicio: '2026-01-01',
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'h-d-to-w',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-01-01',
            validUntil: '2026-02-01',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'h-d-to-w',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [1, 3], // Solo Lunes y Miércoles desde Febrero
            validFrom: '2026-02-01',
            validUntil: null,
            activo: true,
          },
        ],
      });

      // Jueves 15 de enero: correspondía porque era DAILY
      expect(isHabitExpectedOnDate(habit, '2026-01-15')).toBe(true);

      // Jueves 5 de febrero: NO corresponde porque ahora es WEEKLY Lun/Mié
      expect(isHabitExpectedOnDate(habit, '2026-02-05')).toBe(false);

      // Lunes 2 de febrero: SÍ corresponde
      expect(isHabitExpectedOnDate(habit, '2026-02-02')).toBe(true);
    });
  });

  // ── 9. Cambio de días semanales ───────────────────────────────────────────
  describe('Cambio de días semanales', () => {
    it('evalúa los días antiguos en el intervalo anterior y los nuevos en el intervalo actual', () => {
      const habit: Habit = makeTestHabit({
        id: 'h-w-days',
        fechaInicio: '2026-01-01',
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'h-w-days',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [1], // Solo Lunes en Enero
            validFrom: '2026-01-01',
            validUntil: '2026-02-01',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'h-w-days',
            frecuencia: Frequency.WEEKLY,
            diasSemana: [5], // Solo Viernes desde Febrero
            validFrom: '2026-02-01',
            validUntil: null,
            activo: true,
          },
        ],
      });

      // Lunes 12 de enero: correspondía
      expect(isHabitExpectedOnDate(habit, '2026-01-12')).toBe(true);
      // Viernes 16 de enero: no correspondía
      expect(isHabitExpectedOnDate(habit, '2026-01-16')).toBe(false);

      // Lunes 9 de febrero: ya no corresponde
      expect(isHabitExpectedOnDate(habit, '2026-02-09')).toBe(false);
      // Viernes 13 de febrero: sí corresponde
      expect(isHabitExpectedOnDate(habit, '2026-02-13')).toBe(true);
    });
  });

  // ── 10. Dos modificaciones el mismo día ────────────────────────────────────
  describe('Dos modificaciones el mismo día (Consolidación sin duración cero)', () => {
    let testDbRaw: DatabaseSync;
    let repo: HabitRepository;

    beforeEach(async () => {
      testDbRaw = new DatabaseSync(':memory:');
      const adapter = {
        execAsync: async (sql: string) => { testDbRaw.exec(sql); },
        runAsync: async (sql: string, params: unknown[] = []) => {
          const stmt = testDbRaw.prepare(sql);
          const res = stmt.run(...(params as any[]));
          return { lastInsertRowId: Number(res.lastInsertRowid ?? 0), changes: Number(res.changes ?? 0) };
        },
        getFirstAsync: async <T>(sql: string, params: unknown[] = []) => {
          const stmt = testDbRaw.prepare(sql);
          return (stmt.get(...(params as any[])) as T) ?? null;
        },
        getAllAsync: async <T>(sql: string, params: unknown[] = []) => {
          const stmt = testDbRaw.prepare(sql);
          return stmt.all(...(params as any[])) as T[];
        },
        withTransactionAsync: async (fn: () => Promise<void>) => {
          testDbRaw.exec('BEGIN TRANSACTION;');
          try {
            await fn();
            testDbRaw.exec('COMMIT;');
          } catch (e) {
            testDbRaw.exec('ROLLBACK;');
            throw e;
          }
        },
      };

      (globalThis as any)._dbPromise = Promise.resolve(adapter);
      await runMigrations(adapter as any);
      await adapter.runAsync(
        `INSERT INTO users (id, username, fechaRegistro) VALUES (?, ?, ?);`,
        ['user-1', 'TestUser', '2026-01-01']
      );
      repo = new HabitRepository();
    });

    afterEach(() => {
      testDbRaw.close();
      delete (globalThis as any)._dbPromise;
    });

    it('consolida el estado efectivo en lugar de crear registros con validFrom === validUntil', async () => {
      const today = getLogicalToday();
      const habit = makeTestHabit({
        id: 'h-same-day',
        fechaInicio: today,
        frecuencia: Frequency.DAILY,
      });

      // 1. Crear hábito hoy
      await repo.create(habit);

      // 2. Modificación 1 hoy: cambiar a WEEKLY [1, 3]
      await repo.update('h-same-day', {
        frecuencia: Frequency.WEEKLY,
        diasSemana: [1, 3],
      });

      // 3. Modificación 2 hoy: cambiar a WEEKLY [5]
      await repo.update('h-same-day', {
        frecuencia: Frequency.WEEKLY,
        diasSemana: [5],
      });

      // 4. Modificación 3 hoy: archivar y luego reactivar
      await repo.archive('h-same-day');
      await repo.update('h-same-day', { activo: true });

      const loaded = await repo.getById('h-same-day');
      expect(loaded).not.toBeNull();

      // Debe haber exactamente 1 registro histórico consolidado (sin intervalos de duración cero)
      expect(loaded?.scheduleHistory?.length).toBe(1);
      const record = loaded?.scheduleHistory?.[0];
      expect(record?.validFrom).toBe(today);
      expect(record?.validUntil).toBeNull();
      expect(record?.frecuencia).toBe(Frequency.WEEKLY);
      expect(record?.diasSemana).toEqual([5]);
      expect(record?.activo).toBe(true);

      // Ningún registro en la base de datos debe tener validFrom === validUntil
      const zeroDurationRows = await (await (globalThis as any)._dbPromise).getAllAsync(
        'SELECT * FROM habit_schedule_history WHERE validFrom = validUntil'
      );
      expect(zeroDurationRows.length).toBe(0);
    });
  });

  // ── 11. Mensual iniciado día 28 ───────────────────────────────────────────
  describe('Mensual iniciado día 28', () => {
    it('corresponde el día 28 en todos los meses (incluyendo Febrero)', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-28',
      });

      expect(isHabitExpectedOnDate(habit, '2026-01-28')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-02-28')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-03-28')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-04-28')).toBe(true);

      expect(isHabitExpectedOnDate(habit, '2026-02-27')).toBe(false);
    });
  });

  // ── 12. Mensual día 29 en febrero bisiesto ─────────────────────────────────
  describe('Mensual día 29 en febrero bisiesto (2024 / 2028)', () => {
    it('corresponde el 29 de febrero cuando el año es bisiesto', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2024-01-29', // 2024 es bisiesto
      });

      expect(isHabitExpectedOnDate(habit, '2024-01-29')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2024-02-29')).toBe(true); // Febrero tiene 29 días
      expect(isHabitExpectedOnDate(habit, '2024-02-28')).toBe(false);
    });
  });

  // ── 13. Mensual día 29 en febrero no bisiesto ─────────────────────────────
  describe('Mensual día 29 en febrero no bisiesto (2026)', () => {
    it('corresponde el último día del mes (28 de febrero) si febrero no tiene día 29', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-29', // 2026 no es bisiesto
      });

      expect(isHabitExpectedOnDate(habit, '2026-01-29')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-02-28')).toBe(true); // Último día de Febrero
      expect(isHabitExpectedOnDate(habit, '2026-02-27')).toBe(false);
      expect(isHabitExpectedOnDate(habit, '2026-03-29')).toBe(true);
    });
  });

  // ── 14. Mensual día 30 ────────────────────────────────────────────────────
  describe('Mensual día 30', () => {
    it('corresponde el 28 en febrero (no bisiesto), 30 en abril y 30 en mayo', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-30',
      });

      expect(isHabitExpectedOnDate(habit, '2026-01-30')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-02-28')).toBe(true); // Febrero: último día
      expect(isHabitExpectedOnDate(habit, '2026-03-30')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-04-30')).toBe(true); // Abril (30 días)
      expect(isHabitExpectedOnDate(habit, '2026-05-30')).toBe(true); // Mayo (31 días, corresponde el 30)
      expect(isHabitExpectedOnDate(habit, '2026-05-31')).toBe(false);
    });
  });

  // ── 15. Mensual día 31 ────────────────────────────────────────────────────
  describe('Mensual día 31', () => {
    it('corresponde el último día en meses de 28 y 30 días, y el 31 en meses de 31 días', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-01-31',
      });

      expect(isHabitExpectedOnDate(habit, '2026-01-31')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2026-02-28')).toBe(true); // Febrero (28)
      expect(isHabitExpectedOnDate(habit, '2026-03-31')).toBe(true); // Marzo (31)
      expect(isHabitExpectedOnDate(habit, '2026-04-30')).toBe(true); // Abril (30)
      expect(isHabitExpectedOnDate(habit, '2026-05-31')).toBe(true); // Mayo (31)
      expect(isHabitExpectedOnDate(habit, '2026-05-30')).toBe(false);
    });
  });

  // ── 16. Diciembre → Enero ─────────────────────────────────────────────────
  describe('Diciembre → Enero (Transición de Año)', () => {
    it('transiciona correctamente entre años sin perder la programación', () => {
      const habit = makeTestHabit({
        frecuencia: Frequency.MONTHLY,
        fechaInicio: '2026-12-31',
      });

      expect(isHabitExpectedOnDate(habit, '2026-12-31')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2027-01-31')).toBe(true);
      expect(isHabitExpectedOnDate(habit, '2027-02-28')).toBe(true);

      // Verificación de suma y diferencia de fechas sobre límite de año
      expect(addDaysToLogicalDate('2026-12-31', 1)).toBe('2027-01-01');
      expect(subDaysFromLogicalDate('2027-01-01', 1)).toBe('2026-12-31');
      expect(diffInDaysLogicalDates('2027-01-01', '2026-12-31')).toBe(1);
    });
  });

  // ── 17. Zona Europe/Madrid y Cambio de hora (DST) ─────────────────────────
  describe('Zona Europe/Madrid y Cambio de hora invierno/verano (DST)', () => {
    it('mantiene la consistencia de días durante el cambio de hora de primavera (29 de marzo)', () => {
      // En Europe/Madrid, el 29 de marzo de 2026 a las 02:00 el reloj salta a las 03:00 (día de 23h)
      const dayBefore = '2026-03-28';
      const transitionDay = '2026-03-29';
      const dayAfter = '2026-03-30';

      expect(addDaysToLogicalDate(dayBefore, 1)).toBe(transitionDay);
      expect(addDaysToLogicalDate(transitionDay, 1)).toBe(dayAfter);
      expect(diffInDaysLogicalDates(dayAfter, dayBefore)).toBe(2);
    });

    it('mantiene la consistencia de días durante el cambio de hora de otoño (25 de octubre)', () => {
      // En Europe/Madrid, el 25 de octubre de 2026 a las 03:00 el reloj retrocede a las 02:00 (día de 25h)
      const dayBefore = '2026-10-24';
      const transitionDay = '2026-10-25';
      const dayAfter = '2026-10-26';

      expect(addDaysToLogicalDate(dayBefore, 1)).toBe(transitionDay);
      expect(addDaysToLogicalDate(transitionDay, 1)).toBe(dayAfter);
      expect(diffInDaysLogicalDates(dayAfter, dayBefore)).toBe(2);
    });
  });

  // ── 18. Operaciones alrededor de las 00:01 y no desplazamiento por UTC ────
  describe('Operaciones alrededor de las 00:01 y preservación UTC', () => {
    it('una operación a las 00:01 local no se desplaza al día anterior por UTC', () => {
      // Simula fecha local del usuario a las 00:01:30 en su zona horaria
      const localMidnightDate = new Date(2026, 3, 20, 0, 1, 30); // 20 de Abril a las 00:01 local
      const logicalDate = toLogicalDate(localMidnightDate);

      // Debe ser exactamente el 20 de Abril, NUNCA el 19
      expect(logicalDate).toBe('2026-04-20');
      expect(formatDateDB(localMidnightDate)).toBe('2026-04-20');
      expect(generateLogId('h1', localMidnightDate)).toBe('h1_2026-04-20');
    });

    it('una operación a las 23:59 local no se desplaza al día siguiente por UTC', () => {
      const localLateDate = new Date(2026, 3, 20, 23, 59, 30);
      const logicalDate = toLogicalDate(localLateDate);

      expect(logicalDate).toBe('2026-04-20');
      expect(formatDateDB(localLateDate)).toBe('2026-04-20');
    });

    it('parseLogicalDateUTC y formatLogicalDate son simétricos e idempotentes', () => {
      const dates = ['2026-01-01', '2026-02-28', '2026-03-29', '2026-12-31'];
      for (const d of dates) {
        const utcDate = parseLogicalDateUTC(d);
        expect(formatLogicalDate(utcDate)).toBe(d);
        expect(toLogicalDate(d)).toBe(d);
        expect(isValidLogicalDate(d)).toBe(true);
      }
    });

    it('isValidLogicalDate rechaza fechas inválidas y formatos erróneos', () => {
      expect(isValidLogicalDate('2026-02-29')).toBe(false); // 2026 no es bisiesto
      expect(isValidLogicalDate('2024-02-29')).toBe(true);  // 2024 sí es bisiesto
      expect(isValidLogicalDate('2026-04-31')).toBe(false); // Abril tiene 30 días
      expect(isValidLogicalDate('invalid')).toBe(false);
      expect(isValidLogicalDate('2026-13-01')).toBe(false);
      expect(isValidLogicalDate('')).toBe(false);
      expect(isValidLogicalDate(null)).toBe(false);
    });
  });

  // ── 19. getHabitsExpectedOnDate ───────────────────────────────────────────
  describe('getHabitsExpectedOnDate', () => {
    it('filtra correctamente una lista heterogénea según la fecha evaluada', () => {
      const dailyHabit = makeTestHabit({ id: 'h-daily', frecuencia: Frequency.DAILY, fechaInicio: '2026-01-01' });
      const weeklyMonHabit = makeTestHabit({ id: 'h-mon', frecuencia: Frequency.WEEKLY, diasSemana: [1], fechaInicio: '2026-01-01' });
      const futureHabit = makeTestHabit({ id: 'h-future', frecuencia: Frequency.DAILY, fechaInicio: '2026-06-01' });
      const archivedHabit = makeTestHabit({
        id: 'h-archived',
        fechaInicio: '2026-01-01',
        activo: false,
        scheduleHistory: [
          {
            id: 'sh-1',
            habitId: 'h-archived',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-01-01',
            validUntil: '2026-02-01',
            activo: true,
          },
          {
            id: 'sh-2',
            habitId: 'h-archived',
            frecuencia: Frequency.DAILY,
            diasSemana: [0, 1, 2, 3, 4, 5, 6],
            validFrom: '2026-02-01',
            validUntil: null,
            activo: false,
          },
        ],
      });

      const habits = [dailyHabit, weeklyMonHabit, futureHabit, archivedHabit];

      // Lunes 5 de Enero:
      // daily -> sí
      // weeklyMon -> sí
      // future -> no (no ha nacido)
      // archived -> sí (en enero estaba activo)
      const expectedJan5 = getHabitsExpectedOnDate(habits, '2026-01-05');
      expect(expectedJan5.map(h => h.id).sort()).toEqual(['h-archived', 'h-daily', 'h-mon']);

      // Martes 6 de Enero:
      // daily -> sí
      // weeklyMon -> no
      // future -> no
      // archived -> sí
      const expectedJan6 = getHabitsExpectedOnDate(habits, '2026-01-06');
      expect(expectedJan6.map(h => h.id).sort()).toEqual(['h-archived', 'h-daily']);

      // Lunes 9 de Febrero:
      // daily -> sí
      // weeklyMon -> sí
      // future -> no
      // archived -> no (ya archivado en febrero)
      const expectedFeb9 = getHabitsExpectedOnDate(habits, '2026-02-09');
      expect(expectedFeb9.map(h => h.id).sort()).toEqual(['h-daily', 'h-mon']);
    });
  });
});
