import { create } from 'zustand';
import { Pet, PetState } from '../types';

interface PetStore {
  pet: Pet | null;
  updateHealth: (delta: number) => void;
  levelUp: () => void;
}

const getPetState = (vida: number): PetState => {
  if (vida === 0) return PetState.ABSENT;
  if (vida <= 25) return PetState.SAD;
  if (vida <= 50) return PetState.CONFUSED;
  if (vida <= 75) return PetState.CHEERING;
  return PetState.HAPPY;
};

export const usePetStore = create<PetStore>((set) => ({
  pet: null,
  updateHealth: (delta) => {
    set((state) => {
      if (!state.pet) return state;
      const nuevaVida = Math.min(100, Math.max(0, state.pet.vida + delta));
      return {
        pet: {
          ...state.pet,
          vida: nuevaVida,
          state: getPetState(nuevaVida),
        },
      };
    });
  },
  levelUp: () => {
    set((state) => {
      if (!state.pet) return state;
      return { pet: { ...state.pet, nivel: state.pet.nivel + 1, xp: 0 } };
    });
  },
}));