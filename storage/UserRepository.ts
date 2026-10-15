import { getDb } from './database';
import { User } from '../types';
import { UserRow } from '../db/schema';
import * as SQLite from 'expo-sqlite';
import { parseSqliteBoolean } from '../utils/booleanUtils';

export interface IUserRepository {
  get(userId?: string): Promise<User | null>;
  getByUserId(id: string): Promise<User | null>;
  create(user: User): Promise<void>;
  update(id: string, updates: Partial<User>): Promise<void>;
  updatePoints(userId: string, newBalance: number): Promise<void>;
  addBadges(userId: string, badgeIds: string[]): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async get(userId?: string): Promise<User | null> {
    if (userId) {
      return this.getByUserId(userId);
    }
    const db = await getDb();
    const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', ['default-user'])
      || await db.getFirstAsync<UserRow>('SELECT * FROM users LIMIT 1');
    if (!row) return null;
    return this.mapRowToUser(row, db);
  }

  async getByUserId(id: string): Promise<User | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapRowToUser(row, db);
  }

  private async mapRowToUser(row: UserRow, db: SQLite.SQLiteDatabase): Promise<User> {
    // Fetch badges
    const badgesRows = await db.getAllAsync<{badgeId: string}>('SELECT badgeId FROM user_badges WHERE userId = ?', [row.id]);
    const badges = badgesRows.map((r: any) => r.badgeId);

    let inventario: string[] = [];
    try {
      if (row.inventario) inventario = JSON.parse(row.inventario);
    } catch (e) {
      console.warn("Error parsing inventario", e);
    }
    return {
      id: row.id,
      username: row.username,
      email: row.email || undefined,
      avatar: row.avatar || undefined,
      fechaRegistro: row.fechaRegistro,
      puntos: row.puntos,
      onboardingCompleted: parseSqliteBoolean(row.onboardingCompleted),
      lastPenaltyAppliedDate: row.lastPenaltyAppliedDate || undefined,
      badges,
      inventario,
      lastOpenedAt: row.lastOpenedAt != null ? Number(row.lastOpenedAt) : undefined,
    } as User;
  }

  async create(user: User): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted, lastPenaltyAppliedDate, inventario, lastOpenedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.email || null,
        user.avatar || null,
        user.fechaRegistro,
        user.puntos,
        user.onboardingCompleted ? 1 : 0,
        user.lastPenaltyAppliedDate || null,
        JSON.stringify(user.inventario || []),
        user.lastOpenedAt ?? null,
      ]
    );
  }

  async update(id: string, updates: Partial<User>): Promise<void> {
    const db = await getDb();
    const current = await this.getByUserId(id);
    if (!current) return;
    
    const updated = { ...current, ...updates };
    
    await db.runAsync(
      `UPDATE users SET 
        username = ?, email = ?, avatar = ?, fechaRegistro = ?, puntos = ?, 
        onboardingCompleted = ?, lastPenaltyAppliedDate = ?, inventario = ?,
        lastOpenedAt = ?
       WHERE id = ?`,
      [
        updated.username,
        updated.email || null,
        updated.avatar || null,
        updated.fechaRegistro,
        updated.puntos,
        updated.onboardingCompleted ? 1 : 0,
        updated.lastPenaltyAppliedDate || null,
        JSON.stringify(updated.inventario || []),
        updated.lastOpenedAt ?? null,
        id
      ]
    );
  }

  async updatePoints(userId: string, newBalance: number): Promise<void> {
    const db = await getDb();
    const safeBalance = Math.max(0, newBalance);
    await db.runAsync(`UPDATE users SET puntos = ? WHERE id = ?`, [safeBalance, userId]);
  }

  async addBadges(userId: string, badgeIds: string[]): Promise<void> {
    const db = await getDb();
    const uniqueBadges = Array.from(new Set(badgeIds));
    for (const badgeId of uniqueBadges) {
      await db.runAsync('INSERT OR IGNORE INTO user_badges (userId, badgeId) VALUES (?, ?)', [userId, badgeId]);
    }
  }
}
