import { create } from 'zustand';
import { Pet } from '../types';
import { petService } from '../services/petService';

interface PetStore {
  pet: Pet | null;
  loadPet: (userId?: string) => Promise<void>;
  /**
   * Actualizaciones de vida y transiciones de estado emocionales delegadas a PetService.
   */
  updateHealth: (delta: number) => Promise<void>;
  /**
   * Progresión de XP delegada a PetService.
   */
  gainXp: (amount: number) => Promise<void>;
  levelUp: () => Promise<void>;
  /**
   * Actualizaciones exclusivamente cosméticas de la mascota (skin, accesorios).
   */
  updateCosmetics: (cosmetics: { skinEquipada?: string; accesorios?: string[] }) => Promise<void>;
  /**
   * Actualización sanitizada y protegida por PetService.
   */
  updatePet: (updates: Partial<Pet>) => Promise<void>;
  /**
   * Flujo de adopción / reinicio delegado a PetService.
   */
  adoptNewPet: (skin?: string) => Promise<void>;
}

export const usePetStore = create<PetStore>((set, get) => ({
  pet: null,

  loadPet: async (userId?: string) => {
    const pet = await petService.getPet(userId || get().pet?.userId || 'default-user');
    set({ pet });
  },

  updateHealth: async (delta: number) => {
    const { pet } = get();
    if (!pet) return;
    const updated = await petService.applyHealthChange(pet.id, delta, pet.userId);
    set({ pet: updated });
  },

  gainXp: async (amount: number) => {
    const { pet } = get();
    if (!pet || amount <= 0) return;
    const updated = await petService.gainXp(pet.id, amount, pet.userId);
    set({ pet: updated });
  },

  levelUp: async () => {
    const { pet } = get();
    if (!pet) return;
    const updated = await petService.levelUp(pet.id, pet.userId);
    set({ pet: updated });
  },

  updateCosmetics: async (cosmetics) => {
    const { pet } = get();
    if (!pet) return;
    const updated = await petService.updateCosmetics(pet.id, cosmetics, pet.userId);
    set({ pet: updated });
  },

  updatePet: async (updates) => {
    const { pet } = get();
    if (!pet) return;
    const updated = await petService.sanitizeAndUpdatePet(pet.id, updates, pet.userId);
    set({ pet: updated });
  },

  adoptNewPet: async (skin?: string) => {
    const { pet } = get();
    const updated = await petService.adoptNewPet(pet?.userId || 'default-user', skin);
    set({ pet: updated });
  },
}));