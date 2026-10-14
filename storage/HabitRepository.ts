import { Habit, HabitScheduleHistory, LogicalDate } from '../types';
import { getDb } from './database';
import { HabitRow, HabitScheduleHistoryRow } from '../db/schema';
import * as SQLite from 'expo-sqlite';
import { toLogicalDate, getLogicalToday } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';

export interface IHabitRepository {
  get(userId?: string): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  create(habit: Habit): Promise<void>;
  update(id: string, changes: Partial<Habit>): Promise<void>;
  upsert(habit: Habit): Promise<void>;
  archive(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class HabitRepository implements IHabitRepository {
  private mapRowToHabit(row: HabitRow): Habit {
    return {
      ...row,
      descripcion: row.descripcion || undefined,
      horaRecordatorio: row.horaRecordatorio || undefined,
      fechaInicio: toLogicalDate(row.fechaInicio),
      fechaFin: row.fechaFin ? toLogicalDate(row.fechaFin) : undefined,
      diasSemana: JSON.parse(row.diasSemana),
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

  async create(habit: Habit): Promise<void> {
    const db = await getDb();
    const normalizedHabit: Habit = {
      ...habit,
      fechaInicio: toLogicalDate(habit.fechaInicio || getLogicalToday()),
      fechaFin: habit.fechaFin ? toLogicalDate(habit.fechaFin) : undefined,
    };

    await db.withTransactionAsync(async () => {
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
      await this.syncScheduleHistory(db, normalizedHabit);
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

    const db = await getDb();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE habits SET 
        userId = ?, nombre = ?, descripcion = ?, categoria = ?, icono = ?, colorHex = ?, frecuencia = ?, 
        diasSemana = ?, horaRecordatorio = ?, tipoVerificacion = ?, nivelPrioridad = ?, fechaInicio = ?, 
        fechaFin = ?, activo = ?
        WHERE id = ?`,
        [
          updated.userId,
          updated.nombre,
          updated.descripcion || null,
          updated.categoria,
          updated.icono,
          updated.colorHex,
          updated.frecuencia,
          JSON.stringify(updated.diasSemana),
          updated.horaRecordatorio || null,
          updated.tipoVerificacion,
          updated.nivelPrioridad,
          updated.fechaInicio,
          updated.fechaFin || null,
          updated.activo ? 1 : 0,
          id,
        ]
      );
      await this.syncScheduleHistory(db, updated);
    });
  }

  async upsert(habit: Habit): Promise<void> {
    const current = await this.getById(habit.id);
    if (current) {
      await this.update(habit.id, habit);
    } else {
      await this.create(habit);
    }
  }

  async archive(id: string): Promise<void> {
    await this.update(id, { activo: false });
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  }
}
