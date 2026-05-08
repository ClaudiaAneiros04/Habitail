/**
 * useStatsStore.ts
 *
 * Store Zustand exclusivo para cachear los resultados de useHabitStats.
 * ──────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD ÚNICA: almacenar y servir el caché de estadísticas.
 * Este store NO contiene lógica de negocio; solo estructura el estado
 * y expone las operaciones de caché (get / set / invalidate).
 *
 * Clave de caché:
 *   `${habitId ?? 'global'}:${period}`
 *   Ejemplos: "abc-123:weekly", "global:monthly"
 *
 * Estrategia de invalidación:
 *   El hook useHabitStats invalida la entrada al desmontar o cuando cambian
 *   habitId/period. No se usa TTL automático para simplicidad; si se añade
 *   en el futuro, documentar en LEARNING.md.
 *
 * Por qué no persistir en AsyncStorage:
 *   Las estadísticas son datos derivados (calculables de la DB en ~1 query).
 *   Persistirlos añadiría complejidad de sincronización sin beneficio real:
 *   la DB es la fuente de verdad; el caché solo evita recalcular en el mismo render.
 */

import { create } from 'zustand';
import { HabitStatsResult, StatsPeriod } from '../utils/statsCalculator';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos del store
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Entrada de caché para una clave (habitId:period).
 * Incluye `loading` y `error` para que useHabitStats pueda exponer
 * el estado de la petición sin duplicar boilerplate de useState.
 */
interface StatsCacheEntry {
  data: HabitStatsResult | null;
  loading: boolean;
  error: string | null;
}

/** Estado completo del store: un mapa de claves → entradas de caché. */
interface StatsStoreState {
  /** Mapa de entradas de caché indexado por `habitId:period`. */
  cache: Record<string, StatsCacheEntry>;

  /**
   * Inicia la carga de una entrada: establece loading=true y limpia el error previo.
   * Llamar antes de lanzar la query al Repository.
   *
   * @param key - Clave de caché (ej: "habit-123:weekly").
   */
  setLoading: (key: string) => void;

  /**
   * Guarda el resultado de una consulta en caché.
   * Establece loading=false y error=null.
   *
   * @param key  - Clave de caché.
   * @param data - Resultado de useHabitStats listo para exponerse.
   */
  setData: (key: string, data: HabitStatsResult) => void;

  /**
   * Registra un error en la entrada de caché.
   * Establece loading=false y preserva data anterior si existía.
   *
   * @param key     - Clave de caché.
   * @param message - Mensaje de error descriptivo.
   */
  setError: (key: string, message: string) => void;

  /**
   * Elimina una entrada del caché (fuerza recálculo en el próximo acceso).
   * Útil cuando el usuario añade/modifica un log y los stats pueden haber cambiado.
   *
   * @param key - Clave de caché a invalidar.
   */
  invalidate: (key: string) => void;

  /**
   * Invalida todas las entradas cuya clave empieza por `habitId:`.
   * Práctico cuando un hábito concreto recibe un nuevo check-in, ya que
   * todos sus periodos quedan potencialmente desactualizados.
   *
   * @param habitId - ID del hábito afectado, o 'global' para la vista global.
   */
  invalidateHabit: (habitId: string) => void;

  /**
   * Elimina todo el caché. Útil al cambiar de usuario o al cerrar sesión.
   */
  clearAll: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Construcción del store
// ──────────────────────────────────────────────────────────────────────────────

export const useStatsStore = create<StatsStoreState>((set, get) => ({
  cache: {},

  setLoading: (key) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data: state.cache[key]?.data ?? null, loading: true, error: null },
      },
    })),

  setData: (key, data) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data, loading: false, error: null },
      },
    })),

  setError: (key, message) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data: state.cache[key]?.data ?? null, loading: false, error: message },
      },
    })),

  invalidate: (key) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    }),

  invalidateHabit: (habitId) =>
    set((state) => {
      const prefix = `${habitId}:`;
      const next: Record<string, StatsCacheEntry> = {};
      for (const [k, v] of Object.entries(state.cache)) {
        if (!k.startsWith(prefix)) next[k] = v;
      }
      return { cache: next };
    }),

  clearAll: () => set({ cache: {} }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de clave de caché (exportados para que useHabitStats los use)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera la clave de caché canónica para una combinación habitId+period.
 * Centralizar la generación evita inconsistencias entre el hook y el store.
 *
 * @param habitId - UUID del hábito, o undefined para vista global.
 * @param period  - Periodo de estadísticas.
 * @returns Clave de caché (string).
 */
export const buildStatsCacheKey = (habitId: string | undefined, period: StatsPeriod): string =>
  `${habitId ?? 'global'}:${period}`;
