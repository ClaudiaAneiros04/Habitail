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
    await userRepo.update(user.id, updates);
    set({ user: updatedUser });
  },
  loadUser: async () => {
    let user = await userRepo.get();
    
    // Recuperar el flag onboardingCompleted desde AsyncStorage
    let onboardingCompleted = false;
    try {
      const completedStr = await AsyncStorage.getItem('@onboarding_completed');
      onboardingCompleted = completedStr === 'true';
    } catch (e) {
      console.warn('[UserStore] Error al cargar onboardingCompleted desde AsyncStorage:', e);
    }

    if (!user) {
      // Crear usuario por defecto si no existe (Fase inicial/Demo)
      user = {
        id: 'default-user',
        username: 'Usuario',
        fechaRegistro: new Date().toISOString(),
        puntos: 0,
        onboardingCompleted,
      };
      await userRepo.create(user);
    } else {
      // Mantener sincronizado el flag con AsyncStorage
      user.onboardingCompleted = onboardingCompleted;
    }
    
    // Migración única controlada de lastOpenedAt desde AsyncStorage a SQLite
    try {
      const storedLastOpened = await AsyncStorage.getItem(LAST_OPENED_AT_KEY);
      if (storedLastOpened) {
        const parsedAsyncTimestamp = parseInt(storedLastOpened, 10);
        if (!isNaN(parsedAsyncTimestamp)) {
          // Priorizar el valor válido más reciente entre SQLite y AsyncStorage
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
    
    // Operar exclusivamente contra SQLite como fuente única de verdad
    try {
      await userRepo.update(user.id, { lastOpenedAt: now });
    } catch (e) {
      console.error('[UserStore] Error al guardar lastOpenedAt en SQLite:', e);
    }
    
    set({ user: updatedUser });
  },
}));

// Hydration al iniciar - Comentado para usar carga secuencial en RootLayout
// useUserStore.getState().loadUser();
