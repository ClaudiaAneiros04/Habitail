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
  isHabitActiveOnUTCDate,
  parseAsUTC,
  calculateCurrentStreak,
} from '../utils/streakCalculator';
import { format } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────────
// Helper para cálculo de racha con parada temprana (Early Exit)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cuenta los días activos entre dos fechas en formato YYYY-MM-DD para un hábito.
 * Esto se utiliza para determinar si la racha se ha roto en el fragmento cargado.
 */
const countActiveDaysBetween = (startStr: string, endStr: string, habit: Habit): number => {
  const start = parseAsUTC(startStr);
  const end = parseAsUTC(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let count = 0;
  const current = new Date(start.getTime());
  while (current <= end) {
    if (isHabitActiveOnUTCDate(habit, current)) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
};

/**
 * Carga logs por lotes (Data Chunking) y aplica parada temprana
 * si la racha actual del hábito ya ha sido rota en el lote actual.
 * De esta forma, evitamos cargar miles de registros en RAM.
 */
const loadLogsChunked = async (
  logRepo: ILogRepository,
  habitId: string,
  fromDate: string,
  toDate: string,
  habit: Habit,
  period: StatsPeriod
): Promise<HabitLog[]> => {
  const chunkSize = 100;
  let offset = 0;
  let allLogs: HabitLog[] = [];
  const todayStr = toDate.split('T')[0];

  while (true) {
    const chunk = await logRepo.getLogsForRangePaginated(habitId, fromDate, toDate, chunkSize, offset);
    if (chunk.length === 0) {
      break;
    }

    allLogs = allLogs.concat(chunk);

    if (period === 'total') {
      const currentStreak = calculateCurrentStreak(allLogs, habit);
      const oldestLog = allLogs[allLogs.length - 1];
      const oldestLogDate = oldestLog.fecha.split('T')[0];
      const activeDays = countActiveDaysBetween(oldestLogDate, todayStr, habit);

      if (currentStreak < activeDays) {
        // La racha se rompió dentro del lote cargado. Parada temprana.
        break;
      }
    } else {
      // Para periodos semanales/mensuales, el primer chunk de 100 ya cubre todo el periodo
      break;
    }

    offset += chunkSize;
    if (offset >= 10000) break; // Límite de seguridad
  }

  // Se revierte para orden cronológico ascendente como espera el calculador de estadísticas
  return allLogs.reverse();
};

/**
 * Carga logs globales de un usuario por lotes y aplica parada temprana
 * si la racha global ya ha sido rota.
 */
const loadLogsGlobalChunked = async (
  logRepo: ILogRepository,
  userId: string,
  fromDate: string,
  toDate: string,
  period: StatsPeriod
): Promise<HabitLog[]> => {
  const chunkSize = 100;
  let offset = 0;
  let allLogs: HabitLog[] = [];
  const todayStr = toDate.split('T')[0];

  const syntheticHabit: Habit = {
    id: '__global__',
    userId: '__global__',
    nombre: '__global__',
    categoria: 'SALUD',
    icono: '',
    colorHex: '',
    frecuencia: 'DAILY',
    diasSemana: [],
    tipoVerificacion: 'BOOLEAN',
    nivelPrioridad: 'NORMAL',
    fechaInicio: '1970-01-01',
    activo: true,
  };

  while (true) {
    const chunk = await logRepo.getLogsForRangeGlobalPaginated(userId, fromDate, toDate, chunkSize, offset);
    if (chunk.length === 0) {
      break;
    }

    allLogs = allLogs.concat(chunk);

    if (period === 'total') {
      const currentStreak = calculateCurrentStreak(allLogs, syntheticHabit);
      const oldestLog = allLogs[allLogs.length - 1];
      const oldestLogDate = oldestLog.fecha.split('T')[0];
      const activeDays = countActiveDaysBetween(oldestLogDate, todayStr, syntheticHabit);

      if (currentStreak < activeDays) {
        // La racha global se rompió. Parada temprana.
        break;
      }
    } else {
      // Para periodos semanales/mensuales, el primer chunk de 100 ya cubre todo el periodo
      break;
    }

    offset += chunkSize;
    if (offset >= 10000) break; // Límite de seguridad
  }

  return allLogs.reverse();
};

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
      const { fromDate, toDate } = buildPeriodRange(period);
      const logRepo = logRepoRef.current;
      const habitRepo = habitRepoRef.current;

      if (habitId) {
        // ── Modo individual: estadísticas para un hábito concreto ──────────
        
        // Obtener el hábito primero para conocer su fecha de inicio
        const habit = await habitRepo.getById(habitId);
        if (!habit) {
          setData(cacheKey, EMPTY_STATS);
          return;
        }

        // Ajustar fromDate para el periodo 'total' para evitar denominadores gigantes
        let baseEffectiveFrom = fromDate;
        if (period === 'total' && habit.fechaInicio) {
          // Extraemos YYYY-MM-DD para compatibilidad lexicográfica en SQLite
          baseEffectiveFrom = habit.fechaInicio.split('T')[0];
        }

        // b) Logs del periodo para calcular rachas. Usamos carga paginada con parada temprana.
        const logs = await loadLogsChunked(logRepo, habitId, fromDate, toDate, habit, period);

        let effectiveFrom = baseEffectiveFrom;
        if (period === 'total' && logs.length > 0) {
          const oldestLogDate = logs[0].fecha.split('T')[0];
          // Si el usuario registró un log antes de la fecha de inicio del hábito, ajustamos el inicio
          if (oldestLogDate < effectiveFrom) {
            effectiveFrom = oldestLogDate;
          }
        }

        // a) Query SQL agregada: solo contadores, sin filas en memoria.
        const periodStats = await logRepo.getStatsByPeriod(habitId, effectiveFrom, toDate);

        const result = computeStats(periodStats, logs, habit, new Date(), { fromDate: effectiveFrom, toDate });
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

        // a) Query SQL agregada global: cuenta combinaciones (día × hábito) únicas.
        const periodStats = await logRepo.getGlobalStatsByPeriod(userId, fromDate, toDate);

        // b) Para las rachas globales necesitamos los logs del periodo. Usamos carga paginada con parada temprana.
        const logs = await loadLogsGlobalChunked(logRepo, userId, fromDate, toDate, period);

        const result = computeGlobalStats(periodStats, logs, new Date(), userHabits, { fromDate, toDate });
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
