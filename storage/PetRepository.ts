import { Pet, PetState } from '../types';
import { getDb } from './database';
import { PetRow } from '../db/schema';

export interface IPetRepository {
  get(userId?: string): Promise<Pet | null>;
  getByUserId(userId: string): Promise<Pet | null>;
  create(pet: Pet): Promise<void>;
  update(id: string, updates: Partial<Pet>): Promise<void>;
}

export class PetRepository implements IPetRepository {
  private mapRowToPet(row: PetRow): Pet {
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
      lifecycle: row.lifecycle !== undefined && row.lifecycle !== null ? Number(row.lifecycle) : 1,
    };
  }

  async get(userId?: string): Promise<Pet | null> {
    if (userId) {
      return this.getByUserId(userId);
    }
    const db = await getDb();
    const row = await db.getFirstAsync<PetRow>('SELECT * FROM pets LIMIT 1');
    return row ? this.mapRowToPet(row) : null;
  }

  async getByUserId(userId: string): Promise<Pet | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<PetRow>('SELECT * FROM pets WHERE userId = ? LIMIT 1', [userId]);
    return row ? this.mapRowToPet(row) : null;
  }

  async create(pet: Pet): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO pets (id, userId, vida, nivel, xp, xpParaSiguienteNivel, estadoActual, skinEquipada, accesorios, lifecycle) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pet.id,
        pet.userId,
        pet.vida,
        pet.nivel,
        pet.xp,
        pet.xpParaSiguienteNivel,
        pet.estadoActual,
        pet.skinEquipada,
        JSON.stringify(pet.accesorios || []),
        pet.lifecycle || 1,
      ]
    );
  }

  async update(id: string, updates: Partial<Pet>): Promise<void> {
    const db = await getDb();
    const currentRow = await db.getFirstAsync<PetRow>('SELECT * FROM pets WHERE id = ?', [id]);
    if (!currentRow) return;
    
    const current = this.mapRowToPet(currentRow);
    const updated = { ...current, ...updates };
    
    await db.runAsync(
      `UPDATE pets SET vida = ?, nivel = ?, xp = ?, xpParaSiguienteNivel = ?, estadoActual = ?, skinEquipada = ?, accesorios = ?, lifecycle = ? WHERE id = ?`,
      [
        updated.vida,
        updated.nivel,
        updated.xp,
        updated.xpParaSiguienteNivel,
        updated.estadoActual,
        updated.skinEquipada,
        JSON.stringify(updated.accesorios || []),
        updated.lifecycle || 1,
        id
      ]
    );
  }
}
