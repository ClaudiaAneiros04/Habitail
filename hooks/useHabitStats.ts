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
import { Habit, HabitLog } from '../types';
import {
  calculateCurrentStreak,
  calculateMaxStreak,
} from '../utils/streakCalculator';
import { format } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers eliminados:
// Se eliminaron `loadLogsChunked` y `loadLogsGlobalChunked` porque la racha
// (currentStreak y maxStreak) siempre debe ser calculada sobre el historial completo,
// y no limitarse al periodo seleccionado en pantalla.
// ──────────────────────────────────────────────────────────────────────────────

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
  expectedCompletions: 0,
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
    const current = useStatsStore.getState().cache[cacheKey];
    // Si ya está cargando o ya tiene datos válidos en caché, no relanzar la query.
    if (current?.loading) {
      return;
    }
    if (current?.data !== undefined && current?.data !== null) {
      return;
    }

    setLoading(cacheKey);

    try {
      const logRepo = logRepoRef.current;
      const habitRepo = habitRepoRef.current;
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      if (habitId) {
        // ── Modo individual: estadísticas para un hábito concreto ──────────
        
        // Obtener el hábito primero
        const habit = await habitRepo.getById(habitId);
        if (!habit) {
          setData(cacheKey, EMPTY_STATS);
          return;
        }

        // Logs de todo el historial para calcular rachas reales históricas
        const logs = await logRepo.getByHabit(habitId);

        let effectiveFrom: string;
        let effectiveTo = todayStr;

        if (period === 'total') {
          // Determinamos fecha lógica de inicio para el periodo 'total':
          // 1. habit.fechaInicio
          // 2. Si existen logs completados anteriores a fechaInicio, usamos la fecha más antigua
          // 3. Fallback a hoy si no hay fechas disponibles (nunca 1970-01-01)
          let earliestDate = habit.fechaInicio ? habit.fechaInicio.split('T')[0] : null;

          if (logs.length > 0) {
            for (const log of logs) {
              if (log.fecha) {
                const logDate = log.fecha.split('T')[0];
                if (!earliestDate || logDate < earliestDate) {
                  earliestDate = logDate;
                }
              }
            }
          }

          effectiveFrom = earliestDate || todayStr;

          // Si el hábito tiene fechaFin y es anterior a hoy, acotamos el fin
          if (habit.fechaFin) {
            const habitEnd = habit.fechaFin.split('T')[0];
            if (habitEnd < effectiveTo) {
              effectiveTo = habitEnd;
            }
          }
        } else {
          const range = buildPeriodRange(period, today);
          effectiveFrom = range.fromDate;
          effectiveTo = range.toDate;

          // Si el hábito se creó después de fromDate (ej. a mitad de semana/mes),
          // acotamos el inicio para no consultar periodos previos a su existencia
          if (habit.fechaInicio) {
            const habitStart = habit.fechaInicio.split('T')[0];
            if (habitStart > effectiveFrom) {
              effectiveFrom = habitStart;
            }
          }

          // Si el hábito tiene fechaFin anterior a toDate, acotamos el fin
          if (habit.fechaFin) {
            const habitEnd = habit.fechaFin.split('T')[0];
            if (habitEnd < effectiveTo) {
              effectiveTo = habitEnd;
            }
          }
        }

        // Si el periodo resultante es inválido (ej. hábito creado en el futuro o finalizado antes del periodo)
        if (effectiveFrom > effectiveTo) {
          const currentStreak = calculateCurrentStreak(logs, habit, today);
          const maxStreak = calculateMaxStreak(logs, habit);
          setData(cacheKey, {
            ...EMPTY_STATS,
            currentStreak,
            maxStreak,
          });
          return;
        }

        // a) Query SQL agregada para los contadores de completados del periodo
        const periodStats = await logRepo.getStatsByPeriod(habitId, effectiveFrom, effectiveTo);

        // b) computeStats calcula métricas finales con fecha y dateRange exacto
        const result = computeStats(
          periodStats,
          logs,
          habit,
          today,
          { fromDate: effectiveFrom, toDate: effectiveTo }
        );
        setData(cacheKey, result);

      } else {
        // ── Modo global: estadísticas de todos los hábitos del usuario ─────

        if (!userId) {
          setError(cacheKey, 'useHabitStats: userId es requerido en modo global (habitId no definido).');
          return;
        }

        // Obtenemos los hábitos del usuario para calcular el esperado global
        const allHabits = await habitRepo.get();
        const userHabits = allHabits.filter(h => h.userId === userId || !h.userId);

        // Para las rachas globales usamos las fechas históricas donde se completó al menos un hábito (string[])
        const activeDates = await logRepo.getGlobalActiveDates(userId);

        let effectiveFrom: string;
        let effectiveTo = todayStr;

        if (period === 'total') {
          // Determinamos el inicio lógico del historial global:
          // El mínimo entre la fechaInicio más antigua de los hábitos del usuario
          // y el primer registro válido en activeDates.
          const habitStarts = userHabits
            .map(h => h.fechaInicio ? h.fechaInicio.split('T')[0] : null)
            .filter((d): d is string => Boolean(d));

          let earliestDate: string | null = null;
          if (habitStarts.length > 0) {
            habitStarts.sort();
            earliestDate = habitStarts[0];
          }

          if (activeDates.length > 0) {
            for (let i = activeDates.length - 1; i >= 0; i--) {
              const d = activeDates[i].split('T')[0];
              if (!earliestDate || d < earliestDate) {
                earliestDate = d;
              }
            }
          }

          effectiveFrom = earliestDate || todayStr;
        } else {
          const range = buildPeriodRange(period, today);
          effectiveFrom = range.fromDate;
          effectiveTo = range.toDate;
        }

        // a) Query SQL agregada global
        const periodStats = await logRepo.getGlobalStatsByPeriod(userId, effectiveFrom, effectiveTo);

        // b) computeGlobalStats recibe activeDates como string[]
        const result = computeGlobalStats(
          periodStats,
          activeDates,
          today,
          userHabits,
          { fromDate: effectiveFrom, toDate: effectiveTo }
        );
        setData(cacheKey, result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido en useHabitStats';
      setError(cacheKey, message);
    }
  }, [cacheKey, habitId, period, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Efecto principal: cargar datos al montar o cuando cambian las dependencias o se limpia el caché ──
  useEffect(() => {
    load();
  }, [load, cacheEntry === undefined]);

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
