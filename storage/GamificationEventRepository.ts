import { GamificationEvent, LogicalDate } from '../types';
import { getDb } from './database';
import { GamificationEventRow } from '../db/schema';
import { toLogicalDate, toInstant } from '../utils/dateUtils';

export interface IGamificationEventRepository {
  getByEventKey(eventKey: string): Promise<GamificationEvent | null>;
  getByHabitAndDate(habitId: string, logicalDate: LogicalDate | string): Promise<GamificationEvent | null>;
  create(event: GamificationEvent): Promise<void>;
  update(eventKey: string, updates: Partial<GamificationEvent>): Promise<void>;
  getAll(): Promise<GamificationEvent[]>;
}

export class GamificationEventRepository implements IGamificationEventRepository {
  private mapRowToEvent(row: GamificationEventRow): GamificationEvent {
    return {
      eventKey: row.eventKey,
      userId: row.userId,
      petId: row.petId,
      habitId: row.habitId || null,
      logicalDate: toLogicalDate(row.logicalDate),
      eventType: row.eventType,
      healthDelta: Number(row.healthDelta),
      appliedHealthDelta: row.appliedHealthDelta !== undefined && row.appliedHealthDelta !== null
        ? Number(row.appliedHealthDelta)
        : Number(row.healthDelta),
      pointsDelta: Number(row.pointsDelta),
      createdAt: toInstant(row.createdAt),
      isReverted: Number(row.isReverted) === 1,
      revertedAt: row.revertedAt ? toInstant(row.revertedAt) : null,
    };
  }

  async getByEventKey(eventKey: string): Promise<GamificationEvent | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<GamificationEventRow>(
      'SELECT * FROM gamification_events WHERE eventKey = ?',
      [eventKey]
    );
    return row ? this.mapRowToEvent(row) : null;
  }

  async getByHabitAndDate(habitId: string, logicalDate: LogicalDate | string): Promise<GamificationEvent | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<GamificationEventRow>(
      'SELECT * FROM gamification_events WHERE habitId = ? AND logicalDate = ?',
      [habitId, toLogicalDate(logicalDate)]
    );
    return row ? this.mapRowToEvent(row) : null;
  }

  async create(event: GamificationEvent): Promise<void> {
    const db = await getDb();
    const appliedHealth = event.appliedHealthDelta !== undefined
      ? event.appliedHealthDelta
      : event.healthDelta;
    await db.runAsync(
      `INSERT INTO gamification_events 
       (eventKey, userId, petId, habitId, logicalDate, eventType, healthDelta, appliedHealthDelta, pointsDelta, createdAt, isReverted, revertedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventKey,
        event.userId,
        event.petId,
        event.habitId || null,
        toLogicalDate(event.logicalDate),
        event.eventType,
        event.healthDelta,
        appliedHealth,
        event.pointsDelta,
        toInstant(event.createdAt),
        event.isReverted ? 1 : 0,
        event.revertedAt ? toInstant(event.revertedAt) : null,
      ]
    );
  }

  async update(eventKey: string, updates: Partial<GamificationEvent>): Promise<void> {
    const db = await getDb();
    const current = await this.getByEventKey(eventKey);
    if (!current) return;
    const merged = { ...current, ...updates };
    const appliedHealth = merged.appliedHealthDelta !== undefined
      ? merged.appliedHealthDelta
      : merged.healthDelta;
    await db.runAsync(
      `UPDATE gamification_events SET
         userId = ?, petId = ?, habitId = ?, logicalDate = ?, eventType = ?,
         healthDelta = ?, appliedHealthDelta = ?, pointsDelta = ?, isReverted = ?, revertedAt = ?
       WHERE eventKey = ?`,
      [
        merged.userId,
        merged.petId,
        merged.habitId || null,
        toLogicalDate(merged.logicalDate),
        merged.eventType,
        merged.healthDelta,
        appliedHealth,
        merged.pointsDelta,
        merged.isReverted ? 1 : 0,
        merged.revertedAt ? toInstant(merged.revertedAt) : null,
        eventKey,
      ]
    );
  }

  async getAll(): Promise<GamificationEvent[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<GamificationEventRow>(
      'SELECT * FROM gamification_events ORDER BY createdAt DESC'
    );
    return rows.map((r) => this.mapRowToEvent(r));
  }
}
