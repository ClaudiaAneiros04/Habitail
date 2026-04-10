import { getDb } from './database';
import { Pet, PetState } from '../types';

export interface IPetRepository {
  get(): Promise<Pet | null>;
  save(pet: Pet): Promise<void>;
}

export class PetRepository implements IPetRepository {
  private mapRowToPet(row: any): Pet {
    return {
      ...row,
    };
  }

  async get(): Promise<Pet | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<any>('SELECT * FROM pets LIMIT 1');
    return row ? this.mapRowToPet(row) : null;
  }

  async save(pet: Pet): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO pets (id, userId, nombre, vida, nivel, xp, skinActual, accesorioActual, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pet.id, pet.userId, pet.nombre, pet.vida, pet.nivel, pet.xp, pet.skinActual, pet.accesorioActual || null, pet.state]
    );
  }
}
