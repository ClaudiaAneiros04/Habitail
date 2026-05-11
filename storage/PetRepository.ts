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
      xp: row.xp,
      xpParaSiguienteNivel: row.xpParaSiguienteNivel || 100, // Fallback safe
      estadoActual: row.estadoActual as PetState,
      skinEquipada: row.skinEquipada,
      accesorios: row.accesorios ? JSON.parse(row.accesorios) : [],
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
      `INSERT OR REPLACE INTO pets (id, userId, vida, nivel, xp, xpParaSiguienteNivel, estadoActual, skinEquipada, accesorios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pet.id,
        pet.userId,
        pet.vida,
        pet.nivel,
        pet.xp,
        pet.xpParaSiguienteNivel,
        pet.estadoActual,
        pet.skinEquipada,
        JSON.stringify(pet.accesorios || [])
      ]
    );
  }
}
