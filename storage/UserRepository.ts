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
    let inventario: string[] = [];
    try {
      if (row.inventario) inventario = JSON.parse(row.inventario);
    } catch (e) {
      console.warn("Error parsing inventario", e);
    }
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      avatar: row.avatar,
      fechaRegistro: row.fechaRegistro,
      puntos: row.puntos,
      onboardingCompleted: Boolean(row.onboardingCompleted),
      inventario,
    };
  }

  async save(user: User): Promise<void> {
    const db = await getDb();
    // Verify if table has inventario column, if not, it should be added in database initialization
    await db.runAsync(
      `INSERT OR REPLACE INTO users (id, username, email, avatar, fechaRegistro, puntos, onboardingCompleted, inventario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.email || null,
        user.avatar || null,
        user.fechaRegistro,
        user.puntos,
        user.onboardingCompleted ? 1 : 0,
        JSON.stringify(user.inventario || []),
      ]
    );
  }
}
