import { getDb } from './database';
import { User } from '../types';
import { UserRow } from '../db/schema';

export interface IUserRepository {
  get(): Promise<User | null>;
  save(user: User): Promise<void>;
  updatePoints(userId: string, newBalance: number): Promise<void>;
  addBadges(userId: string, badgeIds: string[]): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async get(): Promise<User | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<UserRow>('SELECT * FROM users LIMIT 1');
    if (!row) return null;
    // Fetch badges
    const badgesRows = await db.getAllAsync<{badgeId: string}>('SELECT badgeId FROM user_badges WHERE userId = ?', [row.id]);
    const badges = badgesRows.map(r => r.badgeId);

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
      onboardingCompleted: Boolean(row.onboardingCompleted),
      lastPenaltyAppliedDate: row.lastPenaltyAppliedDate || undefined,
      badges,
      inventario,
    } as User;
  }

  async save(user: User): Promise<void> {
    const db = await getDb();
    // Verify if table has inventario column, if not, it should be added in database initialization
    await db.runAsync(
      `INSERT OR REPLACE INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted, lastPenaltyAppliedDate, inventario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
  }

  async updatePoints(userId: string, newBalance: number): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE users SET puntos = ? WHERE id = ?`, [newBalance, userId]);
  }

  async addBadges(userId: string, badgeIds: string[]): Promise<void> {
    const db = await getDb();
    for (const badgeId of badgeIds) {
      await db.runAsync('INSERT OR IGNORE INTO user_badges (userId, badgeId) VALUES (?, ?)', [userId, badgeId]);
    }
  }
}
