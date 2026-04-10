import { getDb } from './database';
import { Pet, PetState } from '../types';

export interface IPetRepository {
  get(): Promise<Pet | null>;
  save(pet: Pet): Promise<void>;
}

export class PetRepository implements IPetRepository {
  private mapRowToPet(row: any): Pet {
    return {
      id: row.id,
      userId: row.userId,
      vida: row.vida,
      nivel: row.nivel,
      skinActiva: row.skinActiva,
      skinsDesbloqueadas: row.skinsDesbloqueadas ? JSON.parse(row.skinsDesbloqueadas) : [],
      accesorios: row.accesorios ? JSON.parse(row.accesorios) : [],
      xp: row.xp,
      state: row.state as PetState,
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
      `INSERT OR REPLACE INTO pets (id, userId, vida, nivel, skinActiva, skinsDesbloqueadas, accesorios, xp, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pet.id,
        pet.userId,
        pet.vida,
        pet.nivel,
        pet.skinActiva,
        JSON.stringify(pet.skinsDesbloqueadas || []),
        JSON.stringify(pet.accesorios || []),
        pet.xp,
        pet.state
      ]
    );
  }
}
