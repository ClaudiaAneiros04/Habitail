import { Habit, HabitScheduleHistory, LogicalDate } from '../types';
import { getDb, runInTransaction } from './database';
import { HabitRow, HabitScheduleHistoryRow } from '../db/schema';
import * as SQLite from 'expo-sqlite';
import { toLogicalDate, getLogicalToday } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';

export interface IHabitRepository {
  get(userId?: string): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  getByIds?(ids: string[]): Promise<Habit[]>;
  verifyHabitsExist?(ids: string[]): Promise<boolean>;
  create(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  upsert(habit: Habit): Promise<void>;
  upsertMany?(habits: Habit[]): Promise<void>;
  archive(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class HabitRepository implements IHabitRepository {
  private mapRowToHabit(row: HabitRow): Habit {
    let diasSemana = [0, 1, 2, 3, 4, 5, 6];
    try {
      if (row.diasSemana) {
        diasSemana = JSON.parse(row.diasSemana);
      }
    } catch {
      diasSemana = [0, 1, 2, 3, 4, 5, 6];
    }

    return {
      ...row,
      descripcion: row.descripcion || undefined,
      horaRecordatorio: row.horaRecordatorio || undefined,
      fechaInicio: toLogicalDate(row.fechaInicio),
      fechaFin: row.fechaFin ? toLogicalDate(row.fechaFin) : undefined,
      diasSemana,
      activo: Boolean(row.activo),
    } as Habit;
  }

  /**
   * Sincroniza el historial de programación y estado activo del hábito.
   * Reglas de modelado de intervalos:
   * 1. Las fechas validFrom y validUntil son estrictamente LogicalDate (YYYY-MM-DD).
   * 2. Si el usuario modifica el hábito varias veces el mismo día (validFrom === today),
   *    se consolida el estado efectivo sobre el mismo registro en lugar de generar intervalos de duración cero.
   * 3. Si el registro abierto proviene de un día anterior, se cierra con validUntil = today (semiabierto)
   *    y se abre un nuevo registro con validFrom = today.
   */
  private async syncScheduleHistory(db: SQLite.SQLiteDatabase, habit: Habit): Promise<void> {
    const activeRow = await db.getFirstAsync<HabitScheduleHistoryRow>(
      'SELECT * FROM habit_schedule_history WHERE habitId = ? AND validUntil IS NULL ORDER BY validFrom DESC LIMIT 1',
      [habit.id]
    );

    const today = getLogicalToday();
    const habitStart = toLogicalDate(habit.fechaInicio || today);
    const targetActivo = Boolean(habit.activo);
    const targetFreq = habit.frecuencia;
    const targetDays = JSON.stringify(habit.diasSemana);

    if (!activeRow) {
      await db.runAsync(
        'INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          generateUUID(),
          habit.id,
          targetFreq,
          targetDays,
          habitStart,
          null,
          targetActivo ? 1 : 0,
        ]
      );
      return;
    }

    const rowActivo = activeRow.activo !== undefined ? Boolean(activeRow.activo) : true;
    const sameActivo = rowActivo === targetActivo;
    const sameFreq = activeRow.frecuencia === targetFreq;
    const sameDays = activeRow.diasSemana === targetDays;

    if (sameActivo && sameFreq && sameDays) {
      // Ningún cambio en la programación ni en el estado activo
      return;
    }

    const openValidFrom = toLogicalDate(activeRow.validFrom);

    if (openValidFrom === today) {
      // Modificación el mismo día: consolidar en el registro existente para evitar intervalos de duración cero
      await db.runAsync(
        'UPDATE habit_schedule_history SET frecuencia = ?, diasSemana = ?, activo = ? WHERE id = ?',
        [targetFreq, targetDays, targetActivo ? 1 : 0, activeRow.id]
      );
    } else {
      // Cierre del intervalo anterior en la fecha efectiva 'today'
      await db.runAsync(
        'UPDATE habit_schedule_history SET validUntil = ? WHERE id = ?',
        [today, activeRow.id]
      );
      // Apertura del nuevo intervalo a partir de 'today'
      await db.runAsync(
        'INSERT INTO habit_schedule_history (id, habitId, frecuencia, diasSemana, validFrom, validUntil, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          generateUUID(),
          habit.id,
          targetFreq,
          targetDays,
          today,
          null,
          targetActivo ? 1 : 0,
        ]
      );
    }
  }

  async get(userId?: string): Promise<Habit[]> {
    const db = await getDb();
    const rows = userId
      ? await db.getAllAsync<HabitRow>('SELECT * FROM habits WHERE userId = ?', [userId])
      : await db.getAllAsync<HabitRow>('SELECT * FROM habits');
    const historyRows = await db.getAllAsync<HabitScheduleHistoryRow>(
      'SELECT * FROM habit_schedule_history ORDER BY validFrom ASC'
    );

    const historyMap = new Map<string, HabitScheduleHistory[]>();
    for (const hr of historyRows) {
      if (!historyMap.has(hr.habitId)) {
        historyMap.set(hr.habitId, []);
      }
      historyMap.get(hr.habitId)!.push({
        id: hr.id,
        habitId: hr.habitId,
        frecuencia: hr.frecuencia,
        diasSemana: JSON.parse(hr.diasSemana),
        validFrom: toLogicalDate(hr.validFrom),
        validUntil: hr.validUntil ? toLogicalDate(hr.validUntil) : null,
        activo: hr.activo !== undefined ? Boolean(hr.activo) : true,
      });
    }

    return rows.map((row) => {
      const habit = this.mapRowToHabit(row);
      habit.scheduleHistory = historyMap.get(habit.id) || [];
      return habit;
    });
  }

  async getById(id: string): Promise<Habit | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [id]);
    if (!row) return null;

    const habit = this.mapRowToHabit(row);
    const historyRows = await db.getAllAsync<HabitScheduleHistoryRow>(
      'SELECT * FROM habit_schedule_history WHERE habitId = ? ORDER BY validFrom ASC',
      [id]
    );
    habit.scheduleHistory = historyRows.map((hr) => ({
      id: hr.id,
      habitId: hr.habitId,
      frecuencia: hr.frecuencia,
      diasSemana: JSON.parse(hr.diasSemana),
      validFrom: toLogicalDate(hr.validFrom),
      validUntil: hr.validUntil ? toLogicalDate(hr.validUntil) : null,
      activo: hr.activo !== undefined ? Boolean(hr.activo) : true,
    }));

    return habit;
  }

  /**
   * Operación interna para insertar o actualizar un hábito y sincronizar su historial
   * de forma atómica dentro de la conexión o transacción SQLite provista.
   */
  private async upsertHabitInternal(db: SQLite.SQLiteDatabase, habit: Habit): Promise<void> {
    const normalizedHabit: Habit = {
      ...habit,
      fechaInicio: toLogicalDate(habit.fechaInicio || getLogicalToday()),
      fechaFin: habit.fechaFin ? toLogicalDate(habit.fechaFin) : undefined,
      activo: habit.activo !== undefined ? Boolean(habit.activo) : true,
    };

    // Asegurar que el usuario existe en users para respetar foreign key (ON DELETE CASCADE)
    const userRow = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM users WHERE id = ?',
      [normalizedHabit.userId]
    );
    if (!userRow) {
      await db.runAsync(
        'INSERT OR IGNORE INTO users (id, username, fechaRegistro, puntos, onboardingCompleted) VALUES (?, ?, ?, ?, ?)',
        [normalizedHabit.userId, 'Usuario', new Date().toISOString(), 0, 0]
      );
    }

    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM habits WHERE id = ?',
      [normalizedHabit.id]
    );

    if (existing) {
      await db.runAsync(
        `UPDATE habits SET 
        userId = ?, nombre = ?, descripcion = ?, categoria = ?, icono = ?, colorHex = ?, frecuencia = ?, 
        diasSemana = ?, horaRecordatorio = ?, tipoVerificacion = ?, nivelPrioridad = ?, fechaInicio = ?, 
        fechaFin = ?, activo = ?
        WHERE id = ?`,
        [
          normalizedHabit.userId,
          normalizedHabit.nombre,
          normalizedHabit.descripcion || null,
          normalizedHabit.categoria,
          normalizedHabit.icono,
          normalizedHabit.colorHex,
          normalizedHabit.frecuencia,
          JSON.stringify(normalizedHabit.diasSemana),
          normalizedHabit.horaRecordatorio || null,
          normalizedHabit.tipoVerificacion,
          normalizedHabit.nivelPrioridad,
          normalizedHabit.fechaInicio,
          normalizedHabit.fechaFin || null,
          normalizedHabit.activo ? 1 : 0,
          normalizedHabit.id,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO habits 
        (id, userId, nombre, descripcion, categoria, icono, colorHex, frecuencia, diasSemana, horaRecordatorio, tipoVerificacion, nivelPrioridad, fechaInicio, fechaFin, activo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedHabit.id,
          normalizedHabit.userId,
          normalizedHabit.nombre,
          normalizedHabit.descripcion || null,
          normalizedHabit.categoria,
          normalizedHabit.icono,
          normalizedHabit.colorHex,
          normalizedHabit.frecuencia,
          JSON.stringify(normalizedHabit.diasSemana),
          normalizedHabit.horaRecordatorio || null,
          normalizedHabit.tipoVerificacion,
          normalizedHabit.nivelPrioridad,
          normalizedHabit.fechaInicio,
          normalizedHabit.fechaFin || null,
          normalizedHabit.activo ? 1 : 0,
        ]
      );
    }

    await this.syncScheduleHistory(db, normalizedHabit);
  }

  async create(habit: Habit): Promise<void> {
    await runInTransaction(async (db) => {
      await this.upsertHabitInternal(db, habit);
    });
  }

  async update(id: string, changes: Partial<Habit>): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;

    const updated: Habit = {
      ...current,
      ...changes,
      fechaInicio: changes.fechaInicio ? toLogicalDate(changes.fechaInicio) : current.fechaInicio,
      fechaFin: changes.fechaFin !== undefined
        ? (changes.fechaFin ? toLogicalDate(changes.fechaFin) : undefined)
        : current.fechaFin,
      activo: changes.activo !== undefined ? Boolean(changes.activo) : current.activo,
    };

    await runInTransaction(async (db) => {
      await this.upsertHabitInternal(db, updated);
    });
  }

  async upsert(habit: Habit): Promise<void> {
    await runInTransaction(async (db) => {
      await this.upsertHabitInternal(db, habit);
    });
  }

  /**
   * Guarda o actualiza múltiples hábitos atómicamente en una única transacción SQLite.
   * Si cualquiera falla, la transacción completa se revierte automáticamente (ROLLBACK).
   */
  async upsertMany(habits: Habit[]): Promise<void> {
    if (habits.length === 0) return;
    await runInTransaction(async (db) => {
      for (const habit of habits) {
        await this.upsertHabitInternal(db, habit);
      }
    });
  }

  /**
   * Obtiene una lista de hábitos a partir de un conjunto de IDs.
   */
  async getByIds(ids: string[]): Promise<Habit[]> {
    if (ids.length === 0) return [];
    const db = await getDb();
    const uniqueIds = Array.from(new Set(ids));
    const CHUNK_SIZE = 100;
    const allRows: HabitRow[] = [];

    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = await db.getAllAsync<HabitRow>(
        `SELECT * FROM habits WHERE id IN (${placeholders})`,
        chunk
      );
      allRows.push(...rows);
    }

    return allRows.map((row) => this.mapRowToHabit(row));
  }

  /**
   * Verifica estrictamente que todos los IDs proporcionados existan en la tabla habits de SQLite.
   */
  async verifyHabitsExist(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const db = await getDb();
    const uniqueIds = Array.from(new Set(ids));
    const CHUNK_SIZE = 100;

    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(DISTINCT id) as count FROM habits WHERE id IN (${placeholders})`,
        chunk
      );
      if (!row || Number(row.count) !== chunk.length) {
        return false;
      }
    }
    return true;
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  }
}
