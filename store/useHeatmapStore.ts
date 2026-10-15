/**
 * useHeatmapStore.ts
 *
 * Store Zustand exclusivo para cachear los datos del heatmap.
 * ──────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD ÚNICA: almacenar y servir el caché de entradas del heatmap.
 * No contiene lógica de negocio; solo orquesta el estado de caché.
 *
 * Clave de caché:
 *   habitId si se proporciona, o 'global' si el hook se llama sin habitId.
 *   Ejemplo: "abc-123", "global"
 *
 * Por qué caché sin TTL:
 *   El heatmap se consulta con ventana fija de 365 días. Los datos solo
 *   cambian cuando el usuario hace un check-in nuevo. El consumer del hook
 *   (o useHabitCheckIn) debe llamar a `invalidate(habitId)` o `clearAll()`
 *   tras un check-in para forzar recálculo.
 *
 * Por qué store separado de useStatsStore:
 *   - Tipos de datos distintos: HeatmapEntry[] vs HabitStatsResult.
 *   - Ciclos de vida independientes: el heatmap puede invalidarse por habitId
 *     mientras las stats de otros periodos permanecen en caché.
 *   - Responsabilidad única: cada store gestiona un tipo de dato.
 */

import { create } from 'zustand';
import { HeatmapEntry } from '../utils/heatmapUtils';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────────────────────

interface HeatmapCacheEntry {
  data: HeatmapEntry[] | null;
  isLoading: boolean;
  error: Error | null;
  /** Fecha de generación para control de cambio de día */
  calculatedForDate?: string;
  updatedAt?: number;
}

const MAX_HEATMAP_CACHE_ENTRIES = 30;

interface HeatmapStoreState {
  /** Mapa de entradas de caché indexado por `userId:habitId` o `userId:global`. */
  cache: Record<string, HeatmapCacheEntry>;

  /**
   * Inicia la carga: establece isLoading=true y limpia el error previo.
   * Preserva los datos anteriores para evitar flashes de contenido vacío
   * mientras se recalcula (stale-while-revalidate).
   *
   * @param key - Clave de caché canónica.
   */
  setLoading: (key: string) => void;

  /**
   * Guarda el array de entradas calculado en caché.
   *
   * @param key  - Clave de caché canónica.
   * @param data - Array completo de HeatmapEntry (365 días).
   * @param calculatedForDate - Fecha 'yyyy-MM-dd' con la que se calculó.
   */
  setData: (key: string, data: HeatmapEntry[], calculatedForDate?: string) => void;

  /**
   * Registra un error en la entrada de caché.
   * Preserva los datos anteriores para que la UI pueda mostrar el estado
   * previo mientras informa del error al usuario.
   *
   * @param key   - Clave de caché.
   * @param error - Error capturado.
   */
  setError: (key: string, error: Error) => void;

  /**
   * Elimina una entrada del caché, forzando recálculo en el próximo acceso.
   *
   * @param key - Clave de caché a eliminar.
   */
  invalidate: (key: string) => void;

  /**
   * Invalida las entradas de un hábito (o global) opcionalmente acotado por usuario.
   *
   * @param habitId - UUID del hábito o 'global'.
   * @param userId  - (Opcional) UUID del usuario.
   */
  invalidateHabit: (habitId: string, userId?: string) => void;

  /**
   * Invalida todas las entradas de un usuario específico.
   *
   * @param userId - UUID del usuario.
   */
  invalidateUser: (userId: string) => void;

  /**
   * Elimina todo el caché. Útil al cambiar de usuario o cerrar sesión.
   */
  clearAll: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────────

export const useHeatmapStore = create<HeatmapStoreState>((set) => ({
  cache: {},

  setLoading: (key) =>
    set((state) => ({
      cache: {
        ...state.cache,
        // Preservar data anterior: stale-while-revalidate evita pantalla en blanco
        [key]: {
          data: state.cache[key]?.data ?? null,
          isLoading: true,
          error: null,
          calculatedForDate: state.cache[key]?.calculatedForDate,
          updatedAt: Date.now(),
        },
      },
    })),

  setData: (key, data, calculatedForDate) =>
    set((state) => {
      const now = Date.now();
      const next = {
        ...state.cache,
        [key]: {
          data,
          isLoading: false,
          error: null,
          calculatedForDate,
          updatedAt: now,
        },
      };

      const keys = Object.keys(next);
      if (keys.length > MAX_HEATMAP_CACHE_ENTRIES) {
        const sortedKeys = keys.sort((a, b) => (next[a]?.updatedAt ?? 0) - (next[b]?.updatedAt ?? 0));
        const toRemove = sortedKeys.slice(0, keys.length - MAX_HEATMAP_CACHE_ENTRIES);
        for (const k of toRemove) {
          delete next[k];
        }
      }

      return { cache: next };
    }),

  setError: (key, error) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          data: state.cache[key]?.data ?? null,
          isLoading: false,
          error,
          calculatedForDate: state.cache[key]?.calculatedForDate,
          updatedAt: Date.now(),
        },
      },
    })),

  invalidate: (key) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    }),

  invalidateHabit: (habitId, userId) =>
    set((state) => {
      const next: Record<string, HeatmapCacheEntry> = {};
      for (const [k, v] of Object.entries(state.cache)) {
        const parts = k.split(':');
        if (parts.length >= 2) {
          const entryUserId = parts[0];
          const entryHabitId = parts[1];
          const matchesHabit = entryHabitId === habitId;
          const matchesUser = !userId || entryUserId === userId;
          if (matchesHabit && matchesUser) {
            continue;
          }
        } else if (parts.length === 1 && parts[0] === habitId) {
          // Retrocompatibilidad clave directa
          continue;
        }
        next[k] = v;
      }
      return { cache: next };
    }),

  invalidateUser: (userId) =>
    set((state) => {
      const prefix = `${userId}:`;
      const next: Record<string, HeatmapCacheEntry> = {};
      for (const [k, v] of Object.entries(state.cache)) {
        if (!k.startsWith(prefix)) {
          next[k] = v;
        }
      }
      return { cache: next };
    }),

  clearAll: () => set({ cache: {} }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helper de clave de caché
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera la clave de caché canónica para el heatmap con aislamiento por usuario.
 *
 * @param habitId - UUID del hábito, o undefined para vista global.
 * @param userId  - UUID del usuario activo.
 * @returns Clave de caché canónica (string).
 */
export const buildHeatmapCacheKey = (habitId: string | undefined, userId?: string): string => {
  const effectiveUser = userId || 'default-user';
  const target = habitId ?? 'global';
  return `${effectiveUser}:${target}`;
};
