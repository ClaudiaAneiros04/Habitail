import { create } from 'zustand';
import { Pet, PetState } from '../types';
import { PetRepository } from '../storage/PetRepository';
import {
  getPetState,
  clampHealth,
  calculateNewHealth,
  calculateXpProgress,
  isPetTerminal,
} from '../utils/petLogic';

interface PetStore {
  pet: Pet | null;
  loadPet: () => Promise<void>;
  /**
   * Actualizaciones de vida y transiciones de estado emocionales.
   * Respeta la irreversibilidad si la mascota está en estado terminal (vida = 0).
   */
  updateHealth: (delta: number) => Promise<void>;
  /**
   * Progresión de XP: acumula experiencia, evalúa umbrales y preserva el excedente.
   */
  gainXp: (amount: number) => Promise<void>;
  levelUp: () => Promise<void>;
  /**
   * Actualizaciones exclusivamente cosméticas de la mascota (skin, accesorios).
   */
  updateCosmetics: (cosmetics: { skinEquipada?: string; accesorios?: string[] }) => Promise<void>;
  /**
   * Actualización protegida contra escrituras arbitrarias fuera de rango
   * o estados incompatibles con los HP actuales.
   */
  updatePet: (updates: Partial<Pet>) => Promise<void>;
  /**
   * Flujo expreso de adopción / reinicio cuando la mascota previa ha partido definitivamente.
   */
  adoptNewPet: (skin?: string) => Promise<void>;
}

const petRepo = new PetRepository();

export const usePetStore = create<PetStore>((set, get) => ({
  pet: null,

  loadPet: async () => {
    const pet = await petRepo.get();
    if (pet) {
      set({ pet });
    } else {
      // Mascota por defecto inicial
      const defaultPet: Pet = {
        id: 'default-pet-1',
        userId: 'default-user',
        vida: 100,
        nivel: 1,
        xp: 0,
        xpParaSiguienteNivel: 100,
        estadoActual: PetState.HAPPY,
        skinEquipada: 'default-cat',
        accesorios: [],
      };
      await petRepo.create(defaultPet);
      set({ pet: defaultPet });
    }
  },

  updateHealth: async (delta: number) => {
    const { pet } = get();
    if (!pet) return;

    // Regla de Irreversibilidad: si la vida es 0 o estado terminal, ninguna acción cura
    if (isPetTerminal(pet) && delta > 0) {
      console.warn('[PetStore] Bloqueada recuperación de vida: La mascota ha partido definitivamente (vida = 0). Se requiere nueva partida o adopción.');
      return;
    }

    const { nuevaVida, nuevoEstado } = calculateNewHealth(pet.vida, delta, pet.estadoActual);
    const updatedPet: Pet = {
      ...pet,
      vida: nuevaVida,
      estadoActual: nuevoEstado,
    };

    await petRepo.update(pet.id, { vida: nuevaVida, estadoActual: nuevoEstado });
    set({ pet: updatedPet });
  },

  gainXp: async (amount: number) => {
    const { pet } = get();
    if (!pet || amount <= 0) return;

    const progress = calculateXpProgress(pet.nivel, pet.xp, pet.xpParaSiguienteNivel, amount);
    const updatedPet: Pet = {
      ...pet,
      ...progress,
    };

    await petRepo.update(pet.id, progress);
    set({ pet: updatedPet });
  },

  levelUp: async () => {
    const { pet } = get();
    if (!pet) return;

    const progress = calculateXpProgress(pet.nivel + 1, pet.xp, pet.xpParaSiguienteNivel, 0);
    const updatedPet: Pet = { ...pet, ...progress };
    await petRepo.update(pet.id, progress);
    set({ pet: updatedPet });
  },

  updateCosmetics: async (cosmetics) => {
    const { pet } = get();
    if (!pet) return;

    const sanitized: Partial<Pet> = {};
    if (cosmetics.skinEquipada !== undefined) sanitized.skinEquipada = cosmetics.skinEquipada;
    if (cosmetics.accesorios !== undefined) sanitized.accesorios = cosmetics.accesorios;

    const updatedPet: Pet = { ...pet, ...sanitized };
    await petRepo.update(pet.id, sanitized);
    set({ pet: updatedPet });
  },

  updatePet: async (updates) => {
    const { pet } = get();
    if (!pet) return;

    const sanitized: Partial<Pet> = { ...updates };

    // 1. Proteger mutaciones de salud arbitrarias y asegurar coherencia con estado
    if (sanitized.vida !== undefined) {
      const clamped = clampHealth(sanitized.vida);
      if (isPetTerminal(pet) && clamped > 0) {
        console.warn('[PetStore] Bloqueada recuperación arbitraria de vida para una mascota terminal.');
        delete sanitized.vida;
        delete sanitized.estadoActual;
      } else {
        sanitized.vida = clamped;
        sanitized.estadoActual = getPetState(clamped);
      }
    } else if (sanitized.estadoActual !== undefined) {
      // Coherencia obligatoria entre estadoActual y vida
      sanitized.estadoActual = getPetState(pet.vida);
    }

    // 2. Proteger nivel y XP
    if (sanitized.nivel !== undefined) {
      sanitized.nivel = Math.max(1, Math.round(sanitized.nivel));
    }
    if (sanitized.xp !== undefined) {
      sanitized.xp = Math.max(0, Math.round(sanitized.xp));
    }
    if (sanitized.xpParaSiguienteNivel !== undefined) {
      sanitized.xpParaSiguienteNivel = Math.max(10, Math.round(sanitized.xpParaSiguienteNivel));
    }

    const updatedPet = { ...pet, ...sanitized };
    await petRepo.update(pet.id, sanitized);
    set({ pet: updatedPet });
  },

  adoptNewPet: async (skin?: string) => {
    const { pet } = get();
    const newPet: Pet = {
      id: pet?.id || 'default-pet-1',
      userId: pet?.userId || 'default-user',
      vida: 100,
      nivel: 1,
      xp: 0,
      xpParaSiguienteNivel: 100,
      estadoActual: PetState.HAPPY,
      skinEquipada: skin || 'default-cat',
      accesorios: [],
    };

    if (pet) {
      await petRepo.update(pet.id, newPet);
    } else {
      await petRepo.create(newPet);
    }
    set({ pet: newPet });
  },
}));