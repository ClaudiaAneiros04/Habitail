import { create } from 'zustand';
import { User } from '../types';
import { UserRepository } from '../storage/UserRepository';

interface UserStore {
  user: User | null;
  updateUser: (updates: Partial<User>) => Promise<void>;
  loadUser: () => Promise<void>;
  updatePoints: (delta: number) => Promise<void>;
  addBadges: (badges: { id: string; name: string }[]) => Promise<void>;
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
    let user = await userRepo.get();
    if (!user) {
      // Crear usuario por defecto si no existe (Fase inicial/Demo)
      user = {
        id: 'default-user',
        username: 'Usuario',
        fechaRegistro: new Date().toISOString(),
        puntos: 0,
        onboardingCompleted: true,
      };
      await userRepo.save(user);
    }
    set({ user });
  },
  updatePoints: async (delta: number) => {
    const { user } = get();
    if (!user) return;
    const newBalance = user.puntos + delta;
    await userRepo.updatePoints(user.id, newBalance);
    set({ user: { ...user, puntos: newBalance } });
  },
  addBadges: async (badges) => {
    const { user } = get();
    if (!user || badges.length === 0) return;
    const badgeIds = badges.map(b => b.id);
    await userRepo.addBadges(user.id, badgeIds);
    // Add to current user state
    const currentUserBadges = (user as any).badges || [];
    set({ user: { ...user, badges: [...currentUserBadges, ...badgeIds] } as User });
  },
}));

// Hydration al iniciar - Comentado para usar carga secuencial en RootLayout
// useUserStore.getState().loadUser();
