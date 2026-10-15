/**
 * useHeatmapData.ts
 *
 * Hook público para obtener los datos del heatmap de actividad.
 * ──────────────────────────────────────────────────────────────────────────────
 * Contrato de salida:
 *   data      : HeatmapEntry[]   — array de 365 entradas {date, value: 0|1|2}
 *   isLoading : boolean          — true mientras se ejecuta la query
 *   error     : Error | null     — error capturado, null si todo fue bien
 *   refresh   : () => void       — invalida el caché y recarga desde la DB
 *
 * Flujo interno:
 *   1. Construye la clave de caché (`habitId` o `'global'`).
 *   2. Si el caché tiene datos válidos → los retorna directamente (sin I/O).
 *   3. Si no → llama al Repository para obtener las filas del heatmap (query SQL
 *      agregada por DATE(fecha), solo días con logs).
 *   4. Mezcla las filas SQL con el rango completo de 365 días (mergeHeatmapData),
 *      rellenando con value=0 los días sin actividad.
 *   5. Almacena el resultado en useHeatmapStore y lo retorna.
 *
 * Agnosticismo de fuente de datos:
 *   El hook acepta `_logRepo` como parámetro opcional (inyección de dependencias).
 *   En producción no se pasa nada; en tests se puede inyectar un mock sin
 *   necesidad de jest.mock de módulos completos.
 *
 * @param habitId - UUID del hábito. Si es undefined → vista global agregada.
 * @param userId  - UUID del usuario activo. Requerido si habitId es undefined.
 * @param _logRepo - Inyección de dependencias (solo para tests).
 */

import { useEffect, useCallback, useRef } from 'react';
import { LogRepository, ILogRepository } from '../storage/LogRepository';
import { useHeatmapStore, buildHeatmapCacheKey } from '../store/useHeatmapStore';
import { useUserStore } from '../store/useUserStore';
import {
  HeatmapEntry,
  buildHeatmapRange,
  mergeHeatmapData,
} from '../utils/heatmapUtils';
import { getLogicalToday } from '../utils/dateUtils';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos del hook
// ──────────────────────────────────────────────────────────────────────────────

export interface UseHeatmapDataOptions {
  /** UUID del hábito. Omitir (o pasar undefined) para vista global. */
  habitId?: string;
  /**
   * UUID del usuario activo. Requerido en modo global (habitId undefined).
   * En modo individual se infiere del store o del hábito.
   */
  userId?: string;
  /** Inyección de dependencias — no usar en producción. */
  _logRepo?: ILogRepository;
}

export interface UseHeatmapDataReturn {
  /** Array completo de 365 entradas ordenadas cronológicamente. */
  data: HeatmapEntry[];
  /** true mientras se ejecuta la query SQLite. */
  isLoading: boolean;
  /** Error capturado durante la carga, null si todo fue bien. */
  error: Error | null;
  /**
   * Invalida el caché y fuerza recarga desde la DB.
   * Llamar desde el consumer tras un nuevo check-in para que el heatmap
   * refleje el cambio sin esperar a un remount.
   */
  refresh: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export const useHeatmapData = ({
  habitId,
  userId: propUserId,
  _logRepo,
}: UseHeatmapDataOptions = {}): UseHeatmapDataReturn => {
  // Repositorio instanciado una sola vez por mount del hook (useRef evita recreaciones).
  const logRepoRef = useRef<ILogRepository>(_logRepo ?? new LogRepository());

  const activeUser = useUserStore((state) => state.user);
  const effectiveUserId = propUserId || activeUser?.id || 'default-user';

  const cacheKey = buildHeatmapCacheKey(habitId, effectiveUserId);

  // Leer el estado actual del caché reactivamente.
  const cacheEntry = useHeatmapStore((state) => state.cache[cacheKey]);
  const { setLoading, setData, setError, invalidate } = useHeatmapStore.getState();

  const requestTokenRef = useRef(0);

  /**
   * Carga los datos del heatmap desde la DB, los mezcla con el rango completo
   * de fechas y los almacena en el caché de Zustand.
   */
  const load = useCallback(async () => {
    const todayStr = getLogicalToday();
    const current = useHeatmapStore.getState().cache[cacheKey];

    if (
      current?.data !== null &&
      current?.data !== undefined &&
      !current.isLoading &&
      current.calculatedForDate === todayStr
    ) {
      return; // Datos en caché válidos para hoy, no recalcular
    }

    const currentToken = ++requestTokenRef.current;
    setLoading(cacheKey);

    try {
      const { fromDate, toDate } = buildHeatmapRange();
      const logRepo = logRepoRef.current;

      let rawRows;

      if (habitId) {
        // ── Modo individual: heatmap de un hábito concreto ────────────────
        rawRows = await logRepo.getHeatmapForHabit(habitId, fromDate, toDate);
      } else {
        // ── Modo global: heatmap de todos los hábitos del usuario ─────────
        if (!effectiveUserId) {
          return;
        }
        rawRows = await logRepo.getHeatmapGlobal(effectiveUserId, fromDate, toDate);
      }

      if (requestTokenRef.current !== currentToken) {
        return;
      }

      // Mezclar filas SQL (solo días con logs) con el rango completo de 365 días,
      // rellenando con value=0 los días sin actividad.
      const entries = mergeHeatmapData(rawRows, fromDate, toDate);

      if (requestTokenRef.current !== currentToken) {
        return;
      }

      setData(cacheKey, entries, todayStr);

    } catch (err) {
      if (requestTokenRef.current === currentToken) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(cacheKey, error);
      }
    }
  }, [cacheKey, habitId, effectiveUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Efecto principal ──────────────────────────────────────────────────────
  useEffect(() => {
    load();
  }, [load]);

  // Validar si cambió el día
  useEffect(() => {
    const todayStr = getLogicalToday();
    if (cacheEntry?.data && cacheEntry.calculatedForDate && cacheEntry.calculatedForDate !== todayStr) {
      load();
    }
  }, [cacheEntry?.data, cacheEntry?.calculatedForDate, load]);

  /**
   * Función de refresco pública: invalida el caché y relanza load().
   * Úsala tras un check-in nuevo para que el heatmap se actualice.
   */
  const refresh = useCallback(() => {
    invalidate(cacheKey);
    load();
  }, [cacheKey, invalidate, load]);

  // ── Retorno del hook ──────────────────────────────────────────────────────
  return {
    data: cacheEntry?.data ?? [],
    isLoading: cacheEntry?.isLoading ?? false,
    error: cacheEntry?.error ?? null,
    refresh,
  };
};
