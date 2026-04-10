import { getDb } from './database';
import { User } from '../types';

export interface IUserRepository {
  get(): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async get(): Promise<User | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM users LIMIT 1');
    if (!row) return null;
    return {
      ...row,
      onboardingCompleted: Boolean(row.onboardingCompleted),
    };
  }

  async save(user: User): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO users (id, nombre, onboardingCompleted, lastOpenedAt, puntos, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.nombre,
        user.onboardingCompleted ? 1 : 0,
        user.lastOpenedAt,
        user.puntos,
        user.createdAt
      ]
    );
  }
}
