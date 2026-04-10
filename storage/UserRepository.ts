import { getDb } from './database';

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt?: string;
}

export interface IUserRepository {
  get(): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class UserRepository implements IUserRepository {
  async get(): Promise<User | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<User>('SELECT * FROM users LIMIT 1');
    return row || null;
  }

  async save(user: User): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO users (id, name, email, createdAt) VALUES (?, ?, ?, ?)`,
      [user.id, user.name, user.email || null, user.createdAt || null]
    );
  }
}
