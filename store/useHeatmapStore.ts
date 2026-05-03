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
}

interface HeatmapStoreState {
  /** Mapa de entradas de caché indexado por habitId o 'global'. */
  cache: Record<string, HeatmapCacheEntry>;

  /**
   * Inicia la carga: establece isLoading=true y limpia el error previo.
   * Preserva los datos anteriores para evitar flashes de contenido vacío
   * mientras se recalcula (stale-while-revalidate).
   *
   * @param key - Clave de caché (habitId o 'global').
   */
  setLoading: (key: string) => void;

  /**
   * Guarda el array de entradas calculado en caché.
   *
   * @param key  - Clave de caché.
   * @param data - Array completo de HeatmapEntry (365 días).
   */
  setData: (key: string, data: HeatmapEntry[]) => void;

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
   * Llamar tras un check-in para que el heatmap refleje el nuevo estado.
   *
   * @param key - Clave de caché a eliminar.
   */
  invalidate: (key: string) => void;

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
        [key]: { data: state.cache[key]?.data ?? null, isLoading: true, error: null },
      },
    })),

  setData: (key, data) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data, isLoading: false, error: null },
      },
    })),

  setError: (key, error) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data: state.cache[key]?.data ?? null, isLoading: false, error },
      },
    })),

  invalidate: (key) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    }),

  clearAll: () => set({ cache: {} }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helper de clave de caché
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera la clave de caché canónica para el heatmap.
 * El heatmap no tiene periodo variable (siempre 365 días), así que la clave
 * es solo el habitId (o 'global' para la vista agregada).
 *
 * @param habitId - UUID del hábito, o undefined para vista global.
 * @returns Clave de caché (string).
 */
export const buildHeatmapCacheKey = (habitId: string | undefined): string =>
  habitId ?? 'global';
