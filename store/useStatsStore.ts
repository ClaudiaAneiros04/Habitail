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
/**
 * Entrada de caché para una clave de estadísticas.
 * Incluye `loading`, `error`, `calculatedForDate` (fecha lógica de cálculo para detectar cambio de día)
 * y `updatedAt` para control de antigüedad/LRU.
 */
interface StatsCacheEntry {
  data: HabitStatsResult | null;
  loading: boolean;
  error: string | null;
  /** Fecha lógica ('yyyy-MM-dd') con la que se calcularon estas estadísticas */
  calculatedForDate?: string;
  /** Timestamp de última actualización para política de poda de memoria */
  updatedAt?: number;
}

/** Límite de entradas máximas en caché para evitar consumo descontrolado de RAM */
const MAX_STATS_CACHE_ENTRIES = 50;

/** Estado completo del store: un mapa de claves → entradas de caché. */
interface StatsStoreState {
  /** Mapa de entradas de caché indexado por `userId:habitId:period`. */
  cache: Record<string, StatsCacheEntry>;

  /**
   * Inicia la carga de una entrada: establece loading=true y limpia el error previo.
   * Llamar antes de lanzar la query al Repository.
   *
   * @param key - Clave de caché canónica.
   */
  setLoading: (key: string) => void;

  /**
   * Guarda el resultado de una consulta en caché junto con la fecha de cálculo.
   * Establece loading=false y error=null.
   * Aplica poda si se sobrepasa el límite de entradas.
   *
   * @param key  - Clave de caché canónica.
   * @param data - Resultado de useHabitStats listo para exponerse.
   * @param calculatedForDate - Fecha lógica 'yyyy-MM-dd' con la que se generó.
   */
  setData: (key: string, data: HabitStatsResult, calculatedForDate?: string) => void;

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
   *
   * @param key - Clave de caché a invalidar.
   */
  invalidate: (key: string) => void;

  /**
   * Invalida todas las entradas asociadas a un hábito específico o a 'global'.
   * Opcionalmente acotado por userId. Si no se pasa userId, invalida para cualquier usuario.
   *
   * @param habitId - ID del hábito afectado, o 'global' para la vista global.
   * @param userId  - (Opcional) ID del usuario específico.
   */
  invalidateHabit: (habitId: string, userId?: string) => void;

  /**
   * Invalida todas las entradas pertenecientes a un usuario en particular.
   * Vital para cambios de sesión o login/logout sin mezclar estados.
   *
   * @param userId - ID del usuario.
   */
  invalidateUser: (userId: string) => void;

  /**
   * Elimina todo el caché. Útil al cerrar sesión o resetear la app.
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
        [key]: {
          data: state.cache[key]?.data ?? null,
          loading: true,
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
          loading: false,
          error: null,
          calculatedForDate,
          updatedAt: now,
        },
      };

      // Control de tamaño: si se supera el umbral, podar las entradas más antiguas (LRU / FIFO)
      const keys = Object.keys(next);
      if (keys.length > MAX_STATS_CACHE_ENTRIES) {
        // Ordenar por updatedAt ascendente y eliminar las excedentes
        const sortedKeys = keys.sort((a, b) => (next[a]?.updatedAt ?? 0) - (next[b]?.updatedAt ?? 0));
        const entriesToRemove = sortedKeys.slice(0, keys.length - MAX_STATS_CACHE_ENTRIES);
        for (const k of entriesToRemove) {
          delete next[k];
        }
      }

      return { cache: next };
    }),

  setError: (key, message) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          data: state.cache[key]?.data ?? null,
          loading: false,
          error: message,
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
      const next: Record<string, StatsCacheEntry> = {};
      for (const [k, v] of Object.entries(state.cache)) {
        const parts = k.split(':');
        // Formatos posibles:
        // Nuevo: userId:targetId:period (longitud >= 3)
        // Legacy: targetId:period (longitud == 2)
        if (parts.length >= 3) {
          const entryUserId = parts[0];
          const entryHabitId = parts[1];
          const matchesHabit = entryHabitId === habitId;
          const matchesUser = !userId || entryUserId === userId;
          if (matchesHabit && matchesUser) {
            continue; // Se invalida
          }
        } else if (parts.length === 2) {
          const entryHabitId = parts[0];
          if (entryHabitId === habitId) {
            continue; // Se invalida compatibilidad hacia atrás
          }
        }
        next[k] = v;
      }
      return { cache: next };
    }),

  invalidateUser: (userId) =>
    set((state) => {
      const prefix = `${userId}:`;
      const next: Record<string, StatsCacheEntry> = {};
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
// Helpers de clave de caché (exportados para que useHabitStats los use)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Genera la clave de caché canónica para una combinación userId + habitId + period.
 * Centralizar la generación asegura aislamiento estricto entre usuarios y hábitos.
 *
 * @param habitId - UUID del hábito, o undefined para vista global.
 * @param period  - Periodo de estadísticas ('weekly' | 'monthly' | 'total').
 * @param userId  - UUID del usuario activo (si no está disponible, se usa 'default-user' o 'anon').
 * @returns Clave de caché canónica (string).
 */
export const buildStatsCacheKey = (
  habitId: string | undefined,
  period: StatsPeriod,
  userId?: string
): string => {
  const effectiveUser = userId || 'default-user';
  const target = habitId ?? 'global';
  return `${effectiveUser}:${target}:${period}`;
};
