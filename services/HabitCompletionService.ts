import { HabitLog, Habit, LogicalDate, HabitScheduleHistory } from '../types';
import { getDb } from '../storage/database';
import { UserRow, HabitRow, PetRow, HabitLogRow, HabitScheduleHistoryRow, GamificationEventRow } from '../db/schema';
import { HabitRepository } from '../storage/HabitRepository';
import { UserRepository } from '../storage/UserRepository';
import { PetRepository } from '../storage/PetRepository';
import { LogRepository } from '../storage/LogRepository';
import { GamificationEventRepository } from '../storage/GamificationEventRepository';
import { 
  toLogicalDate, 
  getLogicalToday, 
  compareLogicalDates, 
  getCurrentInstant, 
  generateLogId 
} from '../utils/dateUtils';
import { isHabitExpectedOnDate } from '../utils/frequencyEngine';
import { getHealthDeltaForPriority, getPetState, clampHealth, isTerminalPetState } from '../utils/petLogic';
import { calcPointsDelta } from '../utils/pointsEngine';
import { evaluateBadges } from '../utils/badgeEngine';
import { useLogStore } from '../store/useLogStore';
import { usePetStore } from '../store/usePetStore';
import { useUserStore } from '../store/useUserStore';
import { CacheInvalidationService } from './cacheInvalidationService';
import { parseSqliteBoolean } from '../utils/booleanUtils';

export interface CompleteHabitParams {
  userId: string;
  habitId: string;
  logicalDate: LogicalDate | string | Date;
  source?: 'UI' | 'NOTIFICATION' | string;
}

export interface UncompleteHabitParams {
  userId: string;
  habitId: string;
  logicalDate: LogicalDate | string | Date;
  source?: 'UI' | 'NOTIFICATION' | string;
}

export interface HabitCompletionResult {
  success: boolean;
  logId: string;
  eventKey: string;
  alreadyCompleted: boolean;
  healthDelta: number;
  appliedHealthDelta: number;
  pointsDelta: number;
  newHealth?: number;
  newPoints?: number;
  isHistorical: boolean;
  newBadges?: { id: string; name: string }[];
}

export interface HabitUncompletionResult {
  success: boolean;
  logId: string;
  eventKey: string;
  alreadyUncompleted: boolean;
  healthDeltaReverted: number;
  appliedHealthDeltaReverted: number;
  pointsDeltaReverted: number;
  newHealth?: number;
  newPoints?: number;
}

/**
 * Servicio de dominio central y única fuente de verdad para gestionar la completitud
 * de hábitos (check-in y deshacer check-in).
 *
 * Garantiza:
 * 1. SQLite como fuente de verdad indiscutible.
 * 2. Validación de precondiciones de dominio (existencia, pertenencia, programación y temporalidad).
 * 3. Idempotencia y atomicidad estricta mediante transacciones ACID de SQLite.
 * 4. Ledger de gamificación inmutable para evitar exploits por alternancia (toggling)
 *    o alteraciones posteriores de prioridad.
 * 5. Protección de fechas históricas (sin puntos ni curación retroactivos) y prohibición de fechas futuras.
 */
export class HabitCompletionService {
  private mutexes = new Map<string, Promise<unknown>>();
  private habitRepo = new HabitRepository();
  private userRepo = new UserRepository();
  private petRepo = new PetRepository();
  private logRepo = new LogRepository();
  private eventRepo = new GamificationEventRepository();

  /**
   * Serializa llamadas concurrentes que compartan la misma clave (habitId + logicalDate)
   * para prevenir colisiones o condiciones de carrera en memoria antes del commit en SQLite.
   */
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.mutexes.get(key) || Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current, () => current);
    this.mutexes.set(key, chained);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.mutexes.get(key) === chained) {
        this.mutexes.delete(key);
      }
    }
  }

  /**
   * Completa un hábito para una fecha lógica dada.
   */
  async completeHabit(params: CompleteHabitParams): Promise<HabitCompletionResult> {
    const targetDate = toLogicalDate(params.logicalDate);
    const lockKey = `${params.habitId}:${targetDate}`;
    return this.withLock(lockKey, () => this.executeCompleteHabit(params, targetDate));
  }

  /**
   * Desmarca un hábito (elimina el log y revierte deltas exactos otorgados).
   */
  async uncompleteHabit(params: UncompleteHabitParams): Promise<HabitUncompletionResult> {
    const targetDate = toLogicalDate(params.logicalDate);
    const lockKey = `${params.habitId}:${targetDate}`;
    return this.withLock(lockKey, () => this.executeUncompleteHabit(params, targetDate));
  }

  private async executeCompleteHabit(
    params: CompleteHabitParams,
    targetDate: LogicalDate
  ): Promise<HabitCompletionResult> {
    const today = getLogicalToday();

    // 1. Validación de temporalidad: fechas futuras estrictamente prohibidas
    if (compareLogicalDates(targetDate, today) > 0) {
      throw new Error(`Cannot complete habit for a future date: ${targetDate}`);
    }

    const isHistorical = compareLogicalDates(targetDate, today) < 0;
    const db = await getDb();

    // 2. Validación de usuario en SQLite
    const userRow = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [params.userId]);
    if (!userRow) {
      throw new Error(`User not found: ${params.userId}`);
    }

    // 3. Validación de hábito en SQLite
    const habitRow = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [params.habitId]);
    if (!habitRow) {
      throw new Error(`Habit not found: ${params.habitId}`);
    }

    // 4. Validación de pertenencia del hábito
    if (habitRow.userId !== params.userId) {
      throw new Error(`Habit ${params.habitId} does not belong to user ${params.userId}`);
    }

    // 5. Validación de mascota asociada al usuario
    const petRow = await db.getFirstAsync<PetRow>('SELECT * FROM pets WHERE userId = ? LIMIT 1', [params.userId]);
    if (!petRow) {
      throw new Error(`Pet not found for user ${params.userId}`);
    }

    // 6. Validación de programación del hábito en esa fecha
    const historyRows = await db.getAllAsync<HabitScheduleHistoryRow>(
      'SELECT * FROM habit_schedule_history WHERE habitId = ? ORDER BY validFrom ASC',
      [params.habitId]
    );

    const habit: Habit = {
      ...habitRow,
      descripcion: habitRow.descripcion || undefined,
      horaRecordatorio: habitRow.horaRecordatorio || undefined,
      fechaInicio: toLogicalDate(habitRow.fechaInicio),
      fechaFin: habitRow.fechaFin ? toLogicalDate(habitRow.fechaFin) : undefined,
      diasSemana: typeof habitRow.diasSemana === 'string' ? JSON.parse(habitRow.diasSemana) : habitRow.diasSemana,
      activo: parseSqliteBoolean(habitRow.activo),
      scheduleHistory: historyRows.map((hr) => ({
        id: hr.id,
        habitId: hr.habitId,
        frecuencia: hr.frecuencia,
        diasSemana: typeof hr.diasSemana === 'string' ? JSON.parse(hr.diasSemana) : hr.diasSemana,
        validFrom: toLogicalDate(hr.validFrom),
        validUntil: hr.validUntil ? toLogicalDate(hr.validUntil) : null,
        activo: parseSqliteBoolean(hr.activo, true),
      })),
    } as Habit;

    if (!isHabitExpectedOnDate(habit, targetDate)) {
      throw new Error(`Habit ${params.habitId} is not scheduled on date ${targetDate}`);
    }

    const eventKey = `completion:${params.habitId}:${targetDate}`;
    const logId = generateLogId(params.habitId, targetDate);

    // 7. Comprobación de idempotencia en SQLite (¿ya está completado?)
    const existingLog = await db.getFirstAsync<HabitLogRow>(
      'SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?',
      [params.habitId, targetDate]
    );

    if (existingLog && parseSqliteBoolean(existingLog.completado)) {
      return {
        success: true,
        logId: existingLog.id,
        eventKey,
        alreadyCompleted: true,
        healthDelta: 0,
        appliedHealthDelta: 0,
        pointsDelta: 0,
        isHistorical,
      };
    }

    // 8. Cálculo de recompensas según ledger de gamificación y reglas anti-exploit
    const existingEvent = await db.getFirstAsync<GamificationEventRow>(
      'SELECT * FROM gamification_events WHERE eventKey = ?',
      [eventKey]
    );

    let healthDelta = 0;
    let pointsDelta = 0;

    if (!isHistorical) {
      if (existingEvent) {
        // Restauración de un evento previo que fue desmarcado:
        // Se restituye EXACTAMENTE el delta teórico original, ignorando cambios de prioridad intermedios
        healthDelta = existingEvent.healthDelta;
        pointsDelta = existingEvent.pointsDelta;
      } else {
        // Primera vez que se completa hoy:
        healthDelta = getHealthDeltaForPriority(habit.nivelPrioridad, 0);
        pointsDelta = calcPointsDelta(habit);
      }
    }

    // 9. Actualización atómica dentro de una transacción en SQLite
    let finalHealth = petRow.vida;
    let finalPoints = userRow.puntos;
    let appliedHealthDelta = 0;
    const nowInstant = getCurrentInstant();

    await db.withTransactionAsync(async () => {
      // Doble verificación dentro de la transacción contra carreras concurrentes
      const inTxLog = await db.getFirstAsync<HabitLogRow>(
        'SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?',
        [params.habitId, targetDate]
      );
      if (inTxLog && parseSqliteBoolean(inTxLog.completado)) {
        return;
      }

      // A. Crear o actualizar log
      await db.runAsync(
        `INSERT INTO habit_logs (id, habitId, userId, fecha, completado, valor, nota, timestampRegistro)
         VALUES (?, ?, ?, ?, 1, NULL, NULL, ?)
         ON CONFLICT(habitId, fecha) DO UPDATE SET
           completado = 1,
           timestampRegistro = excluded.timestampRegistro`,
        [logId, params.habitId, params.userId, targetDate, nowInstant]
      );

      // B. Actualizar vida y estado de la mascota si aplica
      if (healthDelta > 0) {
        const freshPet = await db.getFirstAsync<PetRow>('SELECT vida, estadoActual FROM pets WHERE id = ?', [petRow.id]);
        const currentVida = freshPet ? freshPet.vida : petRow.vida;
        const currentEstado = freshPet ? freshPet.estadoActual : petRow.estadoActual;

        // Regla de Irreversibilidad: si la mascota está en estado terminal (vida = 0 / ABSENT), ningún check-in la recupera.
        if (currentVida > 0 && !isTerminalPetState(currentEstado)) {
          finalHealth = clampHealth(currentVida + healthDelta);
          appliedHealthDelta = finalHealth - currentVida;
          const newState = getPetState(finalHealth);
          await db.runAsync(
            'UPDATE pets SET vida = ?, estadoActual = ? WHERE id = ?',
            [finalHealth, newState, petRow.id]
          );
        } else {
          finalHealth = 0;
          appliedHealthDelta = 0;
        }
      }

      // C. Actualizar puntos del usuario si aplica
      if (pointsDelta > 0) {
        const freshUser = await db.getFirstAsync<UserRow>('SELECT puntos FROM users WHERE id = ?', [params.userId]);
        const currentPuntos = freshUser ? freshUser.puntos : userRow.puntos;
        finalPoints = currentPuntos + pointsDelta;
        await db.runAsync(
          'UPDATE users SET puntos = ? WHERE id = ?',
          [finalPoints, params.userId]
        );
      }

      // D. Registrar o restaurar en el ledger de gamificación
      if (existingEvent) {
        await db.runAsync(
          'UPDATE gamification_events SET isReverted = 0, revertedAt = NULL, appliedHealthDelta = ? WHERE eventKey = ?',
          [appliedHealthDelta, eventKey]
        );
      } else {
        await db.runAsync(
          `INSERT INTO gamification_events
           (eventKey, userId, petId, habitId, logicalDate, eventType, healthDelta, appliedHealthDelta, pointsDelta, createdAt, isReverted, revertedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
          [
            eventKey,
            params.userId,
            petRow.id,
            params.habitId,
            targetDate,
            isHistorical ? 'HISTORICAL_COMPLETION' : 'DAILY_COMPLETION',
            healthDelta,
            appliedHealthDelta,
            pointsDelta,
            nowInstant,
          ]
        );
      }
    });

    // 10. Post-commit: sincronizar stores, invalidar cachés y evaluar insignias
    const completedLog: HabitLog = {
      id: logId,
      habitId: params.habitId,
      userId: params.userId,
      fecha: targetDate,
      completado: true,
      timestampRegistro: nowInstant,
    };

    try {
      useLogStore.setState((state) => ({
        logs: [...state.logs.filter((l) => l.id !== logId), completedLog],
        lastUpdate: Date.now(),
      }));
    } catch (e) {}

    try {
      await usePetStore.getState().loadPet();
    } catch (e) {}

    try {
      await useUserStore.getState().loadUser();
    } catch (e) {}

    try {
      CacheInvalidationService.invalidateHabitCaches(params.habitId);
    } catch (e) {}

    // Evaluación de insignias con el historial persistido completo
    let newBadges: { id: string; name: string }[] = [];
    try {
      const allLogs = await this.logRepo.getAll();
      if (!allLogs.some((l) => l.id === logId)) {
        allLogs.push(completedLog);
      }
      const updatedUser = await this.userRepo.getByUserId(params.userId);
      const allHabits = await this.habitRepo.get();
      if (updatedUser) {
        newBadges = evaluateBadges(updatedUser as any, allHabits, allLogs);
        if (newBadges.length > 0) {
          await this.userRepo.addBadges(params.userId, newBadges.map((b) => b.id));
          await useUserStore.getState().addBadges(newBadges);
        }
      }
    } catch (badgeError) {
      console.error('[HabitCompletionService] Error evaluating badges:', badgeError);
    }

    return {
      success: true,
      logId,
      eventKey,
      alreadyCompleted: false,
      healthDelta,
      appliedHealthDelta,
      pointsDelta,
      newHealth: finalHealth,
      newPoints: finalPoints,
      isHistorical,
      newBadges,
    };
  }

  private async executeUncompleteHabit(
    params: UncompleteHabitParams,
    targetDate: LogicalDate
  ): Promise<HabitUncompletionResult> {
    const today = getLogicalToday();

    // 1. Temporalidad: no se puede desmarcar el futuro
    if (compareLogicalDates(targetDate, today) > 0) {
      throw new Error(`Cannot uncomplete habit for a future date: ${targetDate}`);
    }

    const db = await getDb();

    // 2. Validaciones básicas de existencia
    const userRow = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [params.userId]);
    if (!userRow) {
      throw new Error(`User not found: ${params.userId}`);
    }

    const habitRow = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [params.habitId]);
    if (!habitRow) {
      throw new Error(`Habit not found: ${params.habitId}`);
    }

    if (habitRow.userId !== params.userId) {
      throw new Error(`Habit ${params.habitId} does not belong to user ${params.userId}`);
    }

    const petRow = await db.getFirstAsync<PetRow>('SELECT * FROM pets WHERE userId = ? LIMIT 1', [params.userId]);

    const eventKey = `completion:${params.habitId}:${targetDate}`;
    const logId = generateLogId(params.habitId, targetDate);

    // 3. Comprobación de estado actual en SQLite
    const existingLog = await db.getFirstAsync<HabitLogRow>(
      'SELECT * FROM habit_logs WHERE habitId = ? AND fecha = ?',
      [params.habitId, targetDate]
    );

    if (!existingLog || !parseSqliteBoolean(existingLog.completado)) {
      // Ya estaba desmarcado o nunca existió
      return {
        success: true,
        logId,
        eventKey,
        alreadyUncompleted: true,
        healthDeltaReverted: 0,
        appliedHealthDeltaReverted: 0,
        pointsDeltaReverted: 0,
      };
    }

    // 4. Buscar evento original en el ledger para revertir EXACTAMENTE los deltas concedidos
    const event = await db.getFirstAsync<GamificationEventRow>(
      'SELECT * FROM gamification_events WHERE eventKey = ?',
      [eventKey]
    );

    let healthDeltaToRevert = 0;
    let appliedHealthDeltaToRevert = 0;
    let pointsDeltaToRevert = 0;

    if (event && !parseSqliteBoolean(event.isReverted)) {
      healthDeltaToRevert = event.healthDelta;
      appliedHealthDeltaToRevert = event.appliedHealthDelta !== undefined && event.appliedHealthDelta !== null
        ? event.appliedHealthDelta
        : event.healthDelta;
      pointsDeltaToRevert = event.pointsDelta;
    }

    // 5. Transacción atómica en SQLite
    let finalHealth = petRow ? petRow.vida : 0;
    let finalPoints = userRow.puntos;
    const nowInstant = getCurrentInstant();

    await db.withTransactionAsync(async () => {
      // A. Eliminar el log
      await db.runAsync('DELETE FROM habit_logs WHERE habitId = ? AND fecha = ?', [params.habitId, targetDate]);

      // B. Revertir salud en la mascota (restando exactamente el incremento aplicado)
      if (petRow && appliedHealthDeltaToRevert > 0) {
        const freshPet = await db.getFirstAsync<PetRow>('SELECT vida, estadoActual FROM pets WHERE id = ?', [petRow.id]);
        const currentVida = freshPet ? freshPet.vida : petRow.vida;
        finalHealth = clampHealth(currentVida - appliedHealthDeltaToRevert);
        const newState = getPetState(finalHealth);
        await db.runAsync(
          'UPDATE pets SET vida = ?, estadoActual = ? WHERE id = ?',
          [finalHealth, newState, petRow.id]
        );
      }

      // C. Revertir puntos en el usuario
      if (pointsDeltaToRevert > 0) {
        const freshUser = await db.getFirstAsync<UserRow>('SELECT puntos FROM users WHERE id = ?', [params.userId]);
        const currentPuntos = freshUser ? freshUser.puntos : userRow.puntos;
        finalPoints = Math.max(0, currentPuntos - pointsDeltaToRevert);
        await db.runAsync(
          'UPDATE users SET puntos = ? WHERE id = ?',
          [finalPoints, params.userId]
        );
      }

      // D. Marcar el evento de gamificación como revertido
      if (event) {
        await db.runAsync(
          'UPDATE gamification_events SET isReverted = 1, revertedAt = ? WHERE eventKey = ?',
          [nowInstant, eventKey]
        );
      }
    });

    // 6. Post-commit: sincronizar stores e invalidar cachés
    try {
      useLogStore.setState((state) => ({
        logs: state.logs.filter((l) => l.id !== logId),
        lastUpdate: Date.now(),
      }));
    } catch (e) {}

    try {
      await usePetStore.getState().loadPet();
    } catch (e) {}

    try {
      await useUserStore.getState().loadUser();
    } catch (e) {}

    try {
      CacheInvalidationService.invalidateHabitCaches(params.habitId);
    } catch (e) {}

    return {
      success: true,
      logId,
      eventKey,
      alreadyUncompleted: false,
      healthDeltaReverted: healthDeltaToRevert,
      appliedHealthDeltaReverted: appliedHealthDeltaToRevert,
      pointsDeltaReverted: pointsDeltaToRevert,
      newHealth: finalHealth,
      newPoints: finalPoints,
    };
  }
}

export const habitCompletionService = new HabitCompletionService();
