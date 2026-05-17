import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { UserRepository } from '../storage/UserRepository';

interface UserStore {
  user: User | null;
  updateUser: (updates: Partial<User>) => Promise<void>;
  loadUser: () => Promise<void>;
  updatePoints: (delta: number) => Promise<void>;
  addBadges: (badges: { id: string; name: string }[]) => Promise<void>;
  /**
   * Actualiza el timestamp de la última vez que el usuario abrió la app.
   * Se ejecuta al pasar la app a primer plano.
   */
  updateLastOpenedAt: () => Promise<void>;
}

const userRepo = new UserRepository();
// Clave para almacenar la última fecha de apertura en AsyncStorage
const LAST_OPENED_AT_KEY = 'habitail_user_last_opened_at';

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
    
    // Recuperar el último timestamp de apertura desde AsyncStorage
    try {
      const storedLastOpened = await AsyncStorage.getItem(LAST_OPENED_AT_KEY);
      if (storedLastOpened) {
        user.lastOpenedAt = parseInt(storedLastOpened, 10);
      }
    } catch (e) {
      console.warn('[UserStore] Error al cargar lastOpenedAt desde AsyncStorage:', e);
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
  updateLastOpenedAt: async () => {
    const { user } = get();
    if (!user) return;
    const now = Date.now();
    const updatedUser = { ...user, lastOpenedAt: now };
    
    try {
      await AsyncStorage.setItem(LAST_OPENED_AT_KEY, now.toString());
    } catch (e) {
      console.error('[UserStore] Error al guardar lastOpenedAt en AsyncStorage:', e);
    }
    
    set({ user: updatedUser });
  },
}));

// Hydration al iniciar - Comentado para usar carga secuencial en RootLayout
// useUserStore.getState().loadUser();
