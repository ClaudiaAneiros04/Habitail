import { create } from 'zustand';
import { User } from '../types';
import { UserRepository } from '../storage/UserRepository';

interface UserStore {
  user: User | null;
  updateUser: (updates: Partial<User>) => Promise<void>;
  loadUser: () => Promise<void>;
}

const userRepo = new UserRepository();

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  updateUser: async (updates) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await userRepo.save(updatedUser);
    set({ user: updatedUser });
  },
  loadUser: async () => {
    const user = await userRepo.get();
    if (user) {
      set({ user });
    }
  },
}));

// Hydration al iniciar
useUserStore.getState().loadUser();
