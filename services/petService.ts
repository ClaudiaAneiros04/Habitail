import { Pet, PetState } from '../types';
import { IPetRepository, PetRepository } from '../storage/PetRepository';
import {
  clampHealth,
  calculateNewHealth,
  calculateXpProgress,
  isPetTerminal,
  getPetState,
} from '../utils/petLogic';
import { generateUUID } from '../utils/uuid';

/**
 * Servicio de dominio para la mascota.
 * 
 * Responsabilidad:
 * Encapsular y hacer cumplir todas las invariantes de negocio de la mascota:
 * 1. Irreversibilidad del estado terminal (vida = 0 / ABSENT).
 * 2. Rangos de salud [0, 100] y transiciones emocionales consistentes.
 * 3. Progresión de XP y niveles acumulativos sin pérdida de excedente.
 * 4. Persistencia segura e hidratación íntegra desde SQLite.
 */
export class PetService {
  constructor(private petRepo: IPetRepository = new PetRepository()) {}

  /**
   * Obtiene la mascota asociada al usuario, creándola con valores iniciales seguros si no existe.
   */
  async getPet(userId: string = 'default-user'): Promise<Pet> {
    let pet = await this.petRepo.getByUserId(userId);
    if (!pet) {
      // Fallback si no tiene userId específico en BD previa
      pet = await this.petRepo.get();
      if (pet) {
        return pet;
      }

      const defaultPet: Pet = {
        id: generateUUID(),
        userId,
        vida: 100,
        nivel: 1,
        xp: 0,
        xpParaSiguienteNivel: 100,
        estadoActual: PetState.HAPPY,
        skinEquipada: 'default-cat',
        accesorios: [],
        lifecycle: 1,
      };
      await this.petRepo.create(defaultPet);
      return defaultPet;
    }
    return pet;
  }

  /**
   * Aplica un delta de salud respetando la regla estricta de irreversibilidad.
   * Si la mascota está en estado terminal (vida = 0), los deltas positivos quedan bloqueados.
   */
  async applyHealthChange(petId: string, delta: number, userId?: string): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    if (isPetTerminal(pet) && delta > 0) {
      console.warn('[PetService] Bloqueada recuperación de vida: La mascota ha partido definitivamente (vida = 0).');
      return pet;
    }

    const { nuevaVida, nuevoEstado } = calculateNewHealth(pet.vida, delta, pet.estadoActual);
    await this.petRepo.update(pet.id, { vida: nuevaVida, estadoActual: nuevoEstado });

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, vida: nuevaVida, estadoActual: nuevoEstado };
  }

  /**
   * Acumula experiencia y resuelve ascensos de nivel preservando el excedente.
   */
  async gainXp(petId: string, amount: number, userId?: string): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    if (amount <= 0) return pet;

    const progress = calculateXpProgress(pet.nivel, pet.xp, pet.xpParaSiguienteNivel, amount);
    await this.petRepo.update(pet.id, progress);

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, ...progress };
  }

  /**
   * Incrementa manualmente el nivel de la mascota manteniendo la progresión.
   */
  async levelUp(petId: string, userId?: string): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    const progress = calculateXpProgress(pet.nivel + 1, pet.xp, pet.xpParaSiguienteNivel, 0);
    await this.petRepo.update(pet.id, progress);

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, ...progress };
  }

  /**
   * Actualiza aspectos exclusivamente cosméticos (skin, accesorios).
   */
  async updateCosmetics(
    petId: string,
    cosmetics: { skinEquipada?: string; accesorios?: string[] },
    userId?: string
  ): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    const sanitized: Partial<Pet> = {};
    if (cosmetics.skinEquipada !== undefined) sanitized.skinEquipada = cosmetics.skinEquipada;
    if (cosmetics.accesorios !== undefined) sanitized.accesorios = cosmetics.accesorios;

    await this.petRepo.update(pet.id, sanitized);

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, ...sanitized };
  }

  /**
   * Fuerza el estado terminal definitivo por inactividad prolongada (>= 72 horas).
   */
  async setTerminal(petId: string, userId?: string): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    await this.petRepo.update(pet.id, { vida: 0, estadoActual: PetState.ABSENT });

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, vida: 0, estadoActual: PetState.ABSENT };
  }

  /**
   * Adopta una nueva mascota tras la marcha definitiva de la anterior o inicio de juego.
   * Restablece la salud a 100 puntos y su estado a HAPPY, incrementando el ciclo de vida (lifecycle)
   * para aislar estrictamente los eventos y recompensas de la nueva mascota respecto a las anteriores.
   */
  async adoptNewPet(userId: string = 'default-user', skin?: string): Promise<Pet> {
    const existing = await this.petRepo.getByUserId(userId);
    const nextLifecycle = existing ? (existing.lifecycle || 1) + 1 : 1;
    const newPet: Pet = {
      id: existing?.id || generateUUID(),
      userId,
      vida: 100,
      nivel: 1,
      xp: 0,
      xpParaSiguienteNivel: 100,
      estadoActual: PetState.HAPPY,
      skinEquipada: skin || 'default-cat',
      accesorios: [],
      lifecycle: nextLifecycle,
    };

    if (existing) {
      await this.petRepo.update(existing.id, newPet);
    } else {
      await this.petRepo.create(newPet);
    }

    const refreshed = await this.petRepo.getByUserId(userId);
    return refreshed || newPet;
  }

  /**
   * Aplica actualizaciones garantizando la integridad de las invariantes.
   */
  async sanitizeAndUpdatePet(petId: string, updates: Partial<Pet>, userId?: string): Promise<Pet> {
    const pet = (userId ? await this.petRepo.getByUserId(userId) : null) || await this.petRepo.get();
    if (!pet || pet.id !== petId) {
      throw new Error(`Pet not found: ${petId}`);
    }

    const sanitized: Partial<Pet> = {};

    // Invariante de salud y estado
    if (updates.vida !== undefined) {
      const clamped = clampHealth(updates.vida);
      if (isPetTerminal(pet) && clamped > 0) {
        console.warn('[PetService] Bloqueada recuperación arbitraria de vida para una mascota terminal.');
      } else {
        sanitized.vida = clamped;
        sanitized.estadoActual = getPetState(clamped);
      }
    } else if (updates.estadoActual !== undefined) {
      sanitized.estadoActual = getPetState(pet.vida);
    }

    // Invariantes de progresión
    if (updates.nivel !== undefined) {
      sanitized.nivel = Math.max(1, Math.round(updates.nivel));
    }
    if (updates.xp !== undefined) {
      sanitized.xp = Math.max(0, Math.round(updates.xp));
    }
    if (updates.xpParaSiguienteNivel !== undefined) {
      sanitized.xpParaSiguienteNivel = Math.max(10, Math.round(updates.xpParaSiguienteNivel));
    }

    // Cosméticos
    if (updates.skinEquipada !== undefined) {
      sanitized.skinEquipada = updates.skinEquipada;
    }
    if (updates.accesorios !== undefined) {
      sanitized.accesorios = updates.accesorios;
    }

    await this.petRepo.update(pet.id, sanitized);

    const refreshed = await this.petRepo.getByUserId(pet.userId);
    return refreshed || { ...pet, ...sanitized };
  }
}

export const petService = new PetService();
