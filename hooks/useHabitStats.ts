/**
 * useHabitStats.ts
 *
 * Hook público de estadísticas de hábitos.
 * ──────────────────────────────────────────────────────────────────────────────
 * Contrato de salida (HabitStatsResult):
 *   - completionRate : number (0–100)
 *   - currentStreak  : number
 *   - maxStreak      : number
 *   - totalCompleted : number
 *   - totalDays      : number
 *
 * Adicionalmente expone:
 *   - loading : boolean  — true mientras se ejecuta la query
 *   - error   : string | null — mensaje si la query falla
 *   - refresh : () => void  — fuerza recálculo invalidando el caché
 *
 * Flujo interno:
 *   1. Construye la clave de caché `habitId:period` (o `global:period`).
 *   2. Si el caché tiene datos válidos → los retorna directamente (sin I/O).
 *   3. Si no → llama al Repository para:
 *        a. PeriodStats (query SQL agregada — no trae filas individuales).
 *        b. HabitLog[] del periodo (para calcular rachas — usa índice B-Tree).
 *   4. Calcula HabitStatsResult con funciones puras de statsCalculator.ts.
 *   5. Almacena el resultado en useStatsStore y lo retorna.
 *
 * Agnosticismo de fuente de datos:
 *   El hook no instancia directamente LogRepository ni HabitRepository.
 *   Los recibe como parámetros opcionales (inyección de dependencias),
 *   lo que facilita el testing con mocks sin necesidad de jest.mock de módulos.
 *
 * @param habitId    - UUID del hábito. Si es undefined → vista global agregada.
 * @param period     - 'weekly' | 'monthly' | 'total'
 * @param userId     - UUID del usuario activo (necesario para la vista global).
 * @param logRepo    - Instancia de ILogRepository (DI). Por defecto: LogRepository.
 * @param habitRepo  - Instancia de IHabitRepository (DI). Por defecto: HabitRepository.
 */

import { useEffect, useCallback, useRef } from 'react';
import { LogRepository, ILogRepository } from '../storage/LogRepository';
import { HabitRepository, IHabitRepository } from '../storage/HabitRepository';
import { useStatsStore, buildStatsCacheKey } from '../store/useStatsStore';
import {
  StatsPeriod,
  HabitStatsResult,
  buildPeriodRange,
  computeStats,
  computeGlobalStats,
} from '../utils/statsCalculator';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos del hook
// ──────────────────────────────────────────────────────────────────────────────

export interface UseHabitStatsOptions {
  /** UUID del hábito. Omitir (o pasar undefined) para vista global. */
  habitId?: string;
  /** Periodo de estadísticas. Por defecto: 'monthly'. */
  period?: StatsPeriod;
  /**
   * UUID del usuario activo. Requerido si habitId es undefined (vista global).
   * En vista de hábito individual se extrae del objeto Habit de la DB.
   */
  userId?: string;
  /** Inyección de dependencias para tests — no usar en producción. */
  _logRepo?: ILogRepository;
  _habitRepo?: IHabitRepository;
}

export interface UseHabitStatsReturn extends HabitStatsResult {
  loading: boolean;
  error: string | null;
  /** Invalida el caché y fuerza un recálculo desde la DB. */
  refresh: () => void;
}

// Valores por defecto cuando no hay datos cargados aún.
const EMPTY_STATS: HabitStatsResult = {
  completionRate: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalCompleted: 0,
  totalDays: 0,
};

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export const useHabitStats = ({
  habitId,
  period = 'monthly',
  userId,
  _logRepo,
  _habitRepo,
}: UseHabitStatsOptions = {}): UseHabitStatsReturn => {
  // Repositorios — se instancian una vez por mount del hook.
  // Al ser singletons de módulo (no de clase), no generan conexiones duplicadas.
  const logRepoRef = useRef<ILogRepository>(_logRepo ?? new LogRepository());
  const habitRepoRef = useRef<IHabitRepository>(_habitRepo ?? new HabitRepository());

  const cacheKey = buildStatsCacheKey(habitId, period);

  // Leer el estado actual del caché para esta clave.
  const cacheEntry = useStatsStore((state) => state.cache[cacheKey]);
  const { setLoading, setData, setError, invalidate } = useStatsStore.getState();

  /**
   * Carga las estadísticas desde la DB, calcula los resultados y los cachea.
   * Se llama en el primer mount y cada vez que habitId o period cambian.
   */
  const load = useCallback(async () => {
    // Si ya hay datos válidos en caché, no relanzar la query.
    const current = useStatsStore.getState().cache[cacheKey];
    if (current?.data !== undefined && current?.data !== null && !current.loading) {
      return;
    }

    setLoading(cacheKey);

    try {
      const { fromDate, toDate } = buildPeriodRange(period);
      const logRepo = logRepoRef.current;
      const habitRepo = habitRepoRef.current;

      if (habitId) {
        // ── Modo individual: estadísticas para un hábito concreto ──────────

        // a) Query SQL agregada: solo contadores, sin filas en memoria.
        const periodStats = await logRepo.getStatsByPeriod(habitId, fromDate, toDate);

        // b) Logs del periodo para calcular rachas.
        //    getLogsForRange usa el índice compuesto (habitId, fecha) → O(log N).
        const logs = await logRepo.getLogsForRange(habitId, fromDate, toDate);

        // c) Objeto Habit completo (necesario para frecuencia en calculateCurrentStreak).
        const habit = await habitRepo.getById(habitId);

        if (!habit) {
          // El hábito no existe (fue eliminado). Retornamos stats vacíos.
          setData(cacheKey, EMPTY_STATS);
          return;
        }

        const result = computeStats(periodStats, logs, habit);
        setData(cacheKey, result);

      } else {
        // ── Modo global: estadísticas de todos los hábitos del usuario ─────

        if (!userId) {
          // Sin userId no podemos hacer la query global. Es un error de integración.
          setError(cacheKey, 'useHabitStats: userId es requerido en modo global (habitId no definido).');
          return;
        }

        // a) Query SQL agregada global: cuenta combinaciones (día × hábito) únicas.
        const periodStats = await logRepo.getGlobalStatsByPeriod(userId, fromDate, toDate);

        // b) Para las rachas globales necesitamos los logs del periodo.
        //    No existe getLogsForRangeGlobal en el repo actual; hacemos la query
        //    directa a través de getGlobalStatsByPeriod ya cargado, y para las
        //    rachas usamos getByDate iterando... pero eso sería O(N días).
        //
        //    DECISIÓN: En vista global, currentStreak y maxStreak se calculan
        //    sobre el total de logs del periodo. Dado que getLogsForRange solo
        //    acepta habitId, usamos periodStats.totalCompleted como aproximación
        //    para las rachas globales en esta versión.
        //
        //    TODO: añadir getLogsForRangeGlobal(userId, from, to) al repository
        //    para calcular rachas globales correctamente en una futura iteración.
        //    Ver LEARNING.md — Fase 4 — Casos borde pendientes.
        const result = computeGlobalStats(periodStats, [], new Date());
        setData(cacheKey, result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido en useHabitStats';
      setError(cacheKey, message);
    }
  }, [cacheKey, habitId, period, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Efecto principal: cargar datos al montar o cuando cambian las dependencias ──
  useEffect(() => {
    load();
  }, [load]);

  /**
   * Función de refresco pública: invalida el caché y lanza load() de nuevo.
   * El consumer del hook puede llamarla después de añadir un nuevo log.
   */
  const refresh = useCallback(() => {
    invalidate(cacheKey);
    load();
  }, [cacheKey, invalidate, load]);

  // ── Retorno del hook ──────────────────────────────────────────────────────
  const data = cacheEntry?.data ?? EMPTY_STATS;

  return {
    ...data,
    loading: cacheEntry?.loading ?? false,
    error: cacheEntry?.error ?? null,
    refresh,
  };
};
