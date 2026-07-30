import { parseISO, isValid } from 'date-fns';
import { Habit, HabitLog, Frequency } from '../types';
import { getExpectedCompletions } from './frequencyEngine';

/**
 * Parsea una fecha (formato YYYY-MM-DD o ISO completo con T)
 * de forma que devuelva un objeto Date que represente la medianoche (00:00:00) en UTC.
 * Esto asegura consistencia total sin importar la zona horaria del dispositivo.
 */
export const parseAsUTC = (dateStr: string): Date => {
  if (!dateStr) return new Date(NaN);
  
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed en JS
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  
  // Fallback si por alguna razón no coincide con YYYY-MM-DD
  const parsed = parseISO(dateStr);
  if (isValid(parsed)) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  return new Date(NaN); // Fecha inválida
};

/**
 * Calcula la diferencia en días absolutos entre dos fechas UTC de medianoche.
 */
export const differenceInDaysUTC = (dateLeft: Date, dateRight: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dateLeft.getTime() - dateRight.getTime()) / msPerDay);
};

/**
 * Calcula la diferencia en semanas absolutas entre dos fechas UTC de medianoche.
 */
export const differenceInWeeksUTC = (dateLeft: Date, dateRight: Date): number => {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((dateLeft.getTime() - dateRight.getTime()) / msPerWeek);
};

/**
 * Devuelve el Lunes de la semana (weekStartsOn = 1) en UTC para la fecha dada.
 */
export const startOfWeekUTC = (date: Date, weekStartsOn = 1): Date => {
  const d = new Date(date.getTime());
  const day = d.getUTCDay(); // 0 es Domingo, 1 es Lunes...
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Convierte un objeto Date a formato YYYY-MM-DD en UTC.
 */
export const formatDateUTC = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Determina si el hábito está programado/activo en un día específico en UTC.
 */
export const isHabitActiveOnUTCDate = (habit: Habit, date: Date): boolean => {
  const freq = String(habit.frecuencia);
  if (freq === Frequency.DAILY || freq === 'DAILY') {
    return true;
  }
  if (freq === Frequency.WEEKLY || freq === 'WEEKLY') {
    const day = date.getUTCDay(); // 0 es Domingo, 1 es Lunes...
    // Mapeamos domingo de 0 a 0. Algunos sistemas usan 7 para domingo, pero JS usa 0.
    // Para ser robustos, si diasSemana incluye 7, mapeamos 7 a 0 o viceversa.
    const normalizedDays = habit.diasSemana?.map(d => d === 7 ? 0 : d) || [];
    return normalizedDays.includes(day);
  }
  if (freq === Frequency.MONTHLY || freq === 'MONTHLY') {
    const startDate = parseAsUTC(habit.fechaInicio);
    return date.getUTCDate() === startDate.getUTCDate();
  }
  return false;
};

/**
 * Filtra y prepara los logs de un hábito:
 * - Se queda solo con los completados.
 * - Elimina fechas duplicadas.
 * - Los ordena descendentemente (más reciente primero) basándose en UTC absoluto.
 */
const prepareLogs = (logs: HabitLog[]): Date[] => {
  const completedLogs = logs.filter(log => log.completado && log.fecha);
  const uniqueDatesMap = new Map<string, Date>();
  
  completedLogs.forEach(log => {
    const parsed = parseAsUTC(log.fecha);
    if (isValid(parsed)) {
      const dateStr = parsed.toISOString();
      if (!uniqueDatesMap.has(dateStr)) {
        uniqueDatesMap.set(dateStr, parsed);
      }
    }
  });

  return Array.from(uniqueDatesMap.values())
    .sort((a, b) => b.getTime() - a.getTime()); // Descendente
};

/**
 * Calcula la racha actual considerando la frecuencia del hábito (diario/semanal).
 * Se puede pasar una fecha de referencia (para tests).
 * 
 * @param logs Lista de registros del hábito
 * @param habit Objeto hábito con su configuración de frecuencia
 * @param referenceDate Fecha de referencia para el cálculo de "hoy" (por defecto new Date())
 * @returns Número de racha actual
 */
export const calculateCurrentStreak = (logs: HabitLog[], habit: Habit, referenceDate: Date = new Date()): number => {
  if (!logs || logs.length === 0) return 0;

  const sortedDates = prepareLogs(logs);
  if (sortedDates.length === 0) return 0;

  // Convertimos la fecha de referencia a UTC medianoche basándonos en sus valores locales
  const refDayUTC = new Date(Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ));

  const isWeekly = habit.frecuencia === Frequency.WEEKLY || habit.frecuencia === 'WEEKLY';

  // Si es semanal, se evalúa por semanas completadas (ventanas de L-D).
  if (isWeekly) {
    const refWeek = startOfWeekUTC(refDayUTC, 1); // Semana empieza en Lunes
    
    // Obtenemos semanas únicas ordenadas desc
    const uniqueWeeks = Array.from(new Set(sortedDates.map(d => startOfWeekUTC(d, 1).toISOString())))
      .map(isoString => new Date(isoString))
      .sort((a, b) => b.getTime() - a.getTime());

    if (uniqueWeeks.length > 0 && differenceInWeeksUTC(refWeek, uniqueWeeks[0]) > 1) {
      return 0; // Se rompió la racha hace más de una semana
    }

    let currentStreak = 0;
    let currentExpectedWeek = refWeek;

    for (const week of uniqueWeeks) {
      const diff = differenceInWeeksUTC(currentExpectedWeek, week);
      if (diff === 0) {
        currentStreak++;
        currentExpectedWeek = new Date(currentExpectedWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (diff === 1) {
        if (currentStreak === 0) {
          // Si estamos evaluando la semana actual y no hay log, empezamos a contar desde la pasada
          currentStreak++;
          currentExpectedWeek = new Date(week.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return currentStreak;
  }

  // Frecuencia diaria o semanal con días de semana específicos:
  const completedDatesSet = new Set(sortedDates.map(d => d.toISOString()));
  
  let currentStreak = 0;
  let checkDate = new Date(refDayUTC.getTime());
  let gapDays = 0;
  let streakActive = true;

  while (streakActive) {
    const isActive = isHabitActiveOnUTCDate(habit, checkDate);

    if (isActive) {
      const dateISO = checkDate.toISOString();
      const isCompleted = completedDatesSet.has(dateISO);

      if (isCompleted) {
        currentStreak++;
        gapDays = 0; // Resetear el gap
      } else {
        // Si no se completó en un día activo:
        // Si es hoy, la racha no se rompe aún (el usuario tiene tiempo de completarla).
        if (checkDate.getTime() === refDayUTC.getTime()) {
          // No incrementamos, pero seguimos buscando hacia atrás
        } else {
          // Un día activo en el pasado no completado rompe la racha.
          streakActive = false;
          break;
        }
      }
    }

    // Retrocedemos 1 día
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    gapDays++;

    // Salvaguarda para evitar bucle infinito
    if (gapDays > 365 || (currentStreak === 0 && gapDays > 7)) {
      streakActive = false;
      break;
    }
  }

  return currentStreak;
};

/**
 * Calcula la racha histórica más larga en base a los logs y la configuración del hábito.
 * 
 * @param logs Lista de registros
 * @param habit Objeto hábito para leer su frecuencia y días activos (opcional)
 * @returns Número de la racha máxima histórica
 */
export const calculateMaxStreak = (logs: HabitLog[], habit?: Habit): number => {
  if (!logs || logs.length === 0) return 0;
  const sortedDates = prepareLogs(logs);
  if (sortedDates.length === 0) return 0;
  
  // Si no se provee hábito o es diario/general, usamos el cálculo diario por defecto
  if (!habit) {
    const ascendingDates = [...sortedDates].reverse();
    let maxStreak = 1;
    let currentCounter = 1;

    for (let i = 1; i < ascendingDates.length; i++) {
      const diff = differenceInDaysUTC(ascendingDates[i], ascendingDates[i - 1]);
      
      if (diff === 1) {
        currentCounter++; // Días contiguos
      } else {
        currentCounter = 1; // Racha finalizada, se reinicia contador
      }

      if (currentCounter > maxStreak) {
        maxStreak = currentCounter;
      }
    }

    return maxStreak;
  }

  const isWeekly = habit.frecuencia === Frequency.WEEKLY || habit.frecuencia === 'WEEKLY';

  if (isWeekly) {
    // Racha máxima en base a semanas consecutivas completadas
    const uniqueWeeks = Array.from(new Set(sortedDates.map(d => startOfWeekUTC(d, 1).toISOString())))
      .map(isoString => new Date(isoString))
      .sort((a, b) => a.getTime() - b.getTime()); // Ascendente

    let maxStreak = 1;
    let currentCounter = 1;

    for (let i = 1; i < uniqueWeeks.length; i++) {
      const diff = differenceInWeeksUTC(uniqueWeeks[i], uniqueWeeks[i - 1]);
      if (diff === 1) {
        currentCounter++;
      } else if (diff > 1) {
        currentCounter = 1;
      }
      if (currentCounter > maxStreak) {
        maxStreak = currentCounter;
      }
    }
    return maxStreak;
  }

  // Para hábitos diarios o semanales con días de semana específicos:
  const ascendingDates = [...sortedDates].reverse();
  const completedDatesSet = new Set(ascendingDates.map(d => d.toISOString()));

  const firstDate = new Date(ascendingDates[0].getTime());
  const lastDate = new Date(ascendingDates[ascendingDates.length - 1].getTime());

  let maxStreak = 0;
  let currentCounter = 0;
  let checkDate = new Date(firstDate.getTime());

  while (checkDate <= lastDate) {
    const isActive = isHabitActiveOnUTCDate(habit, checkDate);

    if (isActive) {
      const dateISO = checkDate.toISOString();
      const isCompleted = completedDatesSet.has(dateISO);

      if (isCompleted) {
        currentCounter++;
        if (currentCounter > maxStreak) {
          maxStreak = currentCounter;
        }
      } else {
        currentCounter = 0; // Racha rota en este día activo
      }
    }

    // Avanzar 1 día
    checkDate.setUTCDate(checkDate.getUTCDate() + 1);
  }

  return maxStreak;
};

/**
 * Calcula el porcentaje de éxito (Completion Rate) en los últimos "N" días en UTC absoluto.
 * 
 * @param logs Lista de registros
 * @param days Número de días hacia atrás a evaluar (ej: 30)
 * @param referenceDate Fecha de referencia (hoy)
 * @param habit Objeto Habit opcional para respetar frecuencia programada real
 * @returns Porcentaje de éxito (0 a 100)
 */
export const calculateCompletionRate = (
  logs: HabitLog[],
  days: number,
  referenceDate: Date = new Date(),
  habit?: Habit
): number => {
  if (!logs || logs.length === 0 || days <= 0) return 0;

  const refDayUTC = new Date(Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ));
  
  const startDateUTC = new Date(refDayUTC.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  // Consideramos solo los logs en el rango de los últimos 'days' días y que están completados
  const completedInPeriod = logs.filter(log => {
    if (!log.completado || !log.fecha) return false;
    const parsed = parseAsUTC(log.fecha);
    if (!isValid(parsed)) return false;
    return parsed.getTime() >= startDateUTC.getTime() && parsed.getTime() <= refDayUTC.getTime();
  });

  // Fechas únicas para evitar contar múltiples logs el mismo día
  const uniqueDatesMap = new Set<string>();
  completedInPeriod.forEach(log => {
    const parsed = parseAsUTC(log.fecha);
    if (isValid(parsed)) {
      uniqueDatesMap.add(parsed.toISOString());
    }
  });

  const completedDays = uniqueDatesMap.size;

  let expectedDays = days;
  if (habit) {
    expectedDays = getExpectedCompletions(habit, startDateUTC, refDayUTC);
  }

  if (expectedDays <= 0) return 0;

  const percentage = (completedDays / expectedDays) * 100;
  return Math.min(100, Math.round(percentage * 10) / 10); // Redondea a 1 decimal
};

