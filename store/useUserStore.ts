import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { UserRepository } from '../storage/UserRepository';

interface UserStore {
  user: User | null;
  updateUser: (updates: Partial<User>) => Promise<void>;
  loadUser: (userId?: string) => Promise<void>;
  updatePoints: (delta: number) => Promise<void>;
  addBadges: (badges: { id: string; name: string }[]) => Promise<void>;
  /**
   * Actualiza el timestamp de la última vez que el usuario abrió la app.
   * Se ejecuta al pasar la app a primer plano.
   */
  updateLastOpenedAt: () => Promise<void>;
}

const userRepo = new UserRepository();
// Clave antigua para almacenar la última fecha de apertura en AsyncStorage (migración one-shot)
const LAST_OPENED_AT_KEY = 'habitail_user_last_opened_at';
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,

  updateUser: async (updates) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await userRepo.update(user.id, updates);
    set({ user: updatedUser });
  },

  loadUser: async (userId?: string) => {
    const targetUserId = userId || get().user?.id || 'default-user';
    let user = await userRepo.get(targetUserId);

    // 1. Migración one-shot controlada de onboardingCompleted desde AsyncStorage a SQLite
    try {
      const completedStr = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      if (completedStr !== null) {
        const isCompleted = completedStr === 'true';
        if (user) {
          if (isCompleted && !user.onboardingCompleted) {
            user.onboardingCompleted = true;
            await userRepo.update(user.id, { onboardingCompleted: true });
          }
        } else {
          user = {
            id: targetUserId,
            username: 'Usuario',
            fechaRegistro: new Date().toISOString(),
            puntos: 0,
            onboardingCompleted: isCompleted,
          };
          await userRepo.create(user);
        }
        // Descartar AsyncStorage tras migrar a SQLite como fuente única de verdad
        await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      }
    } catch (e) {
      console.warn('[UserStore] Error al migrar onboardingCompleted desde AsyncStorage a SQLite:', e);
    }

    if (!user) {
      // Crear usuario por defecto si no existe
      user = {
        id: targetUserId,
        username: 'Usuario',
        fechaRegistro: new Date().toISOString(),
        puntos: 0,
        onboardingCompleted: false,
      };
      await userRepo.create(user);
    }

    // 2. Migración one-shot controlada de lastOpenedAt desde AsyncStorage a SQLite
    try {
      const storedLastOpened = await AsyncStorage.getItem(LAST_OPENED_AT_KEY);
      if (storedLastOpened) {
        const parsedAsyncTimestamp = parseInt(storedLastOpened, 10);
        if (!isNaN(parsedAsyncTimestamp)) {
          const currentSqliteTimestamp = user.lastOpenedAt ?? 0;
          const mostRecent = Math.max(currentSqliteTimestamp, parsedAsyncTimestamp);
          if (mostRecent > currentSqliteTimestamp) {
            user.lastOpenedAt = mostRecent;
            await userRepo.update(user.id, { lastOpenedAt: mostRecent });
          }
        }
        // Descartar AsyncStorage como almacenamiento primario
        await AsyncStorage.removeItem(LAST_OPENED_AT_KEY);
      }
    } catch (e) {
      console.warn('[UserStore] Error al migrar lastOpenedAt desde AsyncStorage a SQLite:', e);
    }

    set({ user });
  },

  updatePoints: async (delta: number) => {
    const { user } = get();
    if (!user) return;
    // Invariante de dominio: el saldo nunca debe ser negativo
    const newBalance = Math.max(0, user.puntos + delta);
    await userRepo.updatePoints(user.id, newBalance);
    set({ user: { ...user, puntos: newBalance } });
  },

  addBadges: async (badges) => {
    const { user } = get();
    if (!user || badges.length === 0) return;
    const badgeIds = badges.map((b) => b.id);
    await userRepo.addBadges(user.id, badgeIds);

    // Evitar insignias duplicadas en el estado en memoria
    const currentUserBadges = (user as any).badges || [];
    const uniqueBadges = Array.from(new Set([...currentUserBadges, ...badgeIds]));
    set({ user: { ...user, badges: uniqueBadges } as User });
  },

  updateLastOpenedAt: async () => {
    const { user } = get();
    if (!user) return;
    const now = Date.now();
    const updatedUser = { ...user, lastOpenedAt: now };

    // Operar exclusivamente contra SQLite como fuente única de verdad
    try {
      await userRepo.update(user.id, { lastOpenedAt: now });
    } catch (e) {
      console.error('[UserStore] Error al guardar lastOpenedAt en SQLite:', e);
    }

    set({ user: updatedUser });
  },
}));
