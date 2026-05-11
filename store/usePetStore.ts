import { create } from 'zustand';
import { Pet, PetState } from '../types';
import { PetRepository } from '../storage/PetRepository';

interface PetStore {
  pet: Pet | null;
  updateHealth: (delta: number) => Promise<void>;
  levelUp: () => Promise<void>;
  loadPet: () => Promise<void>;
  updatePet: (updates: Partial<Pet>) => Promise<void>;
}

const getPetState = (vida: number): PetState => {
  if (vida === 0) return PetState.ABSENT;
  if (vida <= 25) return PetState.SAD;
  if (vida <= 50) return PetState.CONFUSED;
  if (vida <= 75) return PetState.CHEERING;
  return PetState.HAPPY;
};

const petRepo = new PetRepository();

export const usePetStore = create<PetStore>((set, get) => ({
  pet: null,
  updateHealth: async (delta) => {
    const { pet } = get();
    if (!pet) return;
    const nuevaVida = Math.min(100, Math.max(0, pet.vida + delta));
    const updatedPet = {
      ...pet,
      vida: nuevaVida,
      estadoActual: getPetState(nuevaVida),
    };
    await petRepo.save(updatedPet);
    set({ pet: updatedPet });
  },
  levelUp: async () => {
    const { pet } = get();
    if (!pet) return;
    const updatedPet = { 
      ...pet, 
      nivel: pet.nivel + 1, 
      xp: 0,
      xpParaSiguienteNivel: Math.floor(pet.xpParaSiguienteNivel * 1.5) // Ejemplo: incremento de dificultad
    };
    await petRepo.save(updatedPet);
    set({ pet: updatedPet });
  },
  loadPet: async () => {
    const pet = await petRepo.get();
    if (pet) {
      set({ pet });
    } else {
      // Mascota por defecto
      const defaultPet: Pet = {
        id: 'default-pet-1',
        userId: 'local-user', // asumiendo single-user offline
        vida: 100,
        nivel: 1,
        xp: 0,
        xpParaSiguienteNivel: 100,
        estadoActual: PetState.HAPPY,
        skinEquipada: 'default-cat',
        accesorios: []
      };
      await petRepo.save(defaultPet);
      set({ pet: defaultPet });
    }
  },
  updatePet: async (updates) => {
    const { pet } = get();
    if (!pet) return;
    const updatedPet = { ...pet, ...updates };
    await petRepo.save(updatedPet);
    set({ pet: updatedPet });
  },
}));

// Hydration al iniciar
usePetStore.getState().loadPet();