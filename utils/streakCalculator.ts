import { differenceInDays, differenceInWeeks, parseISO, startOfDay, startOfWeek, isAfter, isBefore } from 'date-fns';
import { Habit, HabitLog, Frequency } from '../types';

/**
 * Filtra y prepara los logs de un hábito:
 * - Se queda solo con los completados.
 * - Elimina fechas duplicadas.
 * - Los ordena descendentemente (más reciente primero).
 */
const prepareLogs = (logs: HabitLog[]): Date[] => {
  const completedLogs = logs.filter(log => log.completado);
  
  // Extraemos fechas, eliminamos horas y quitamos duplicados
  const uniqueDatesMap = new Map<string, Date>();
  
  completedLogs.forEach(log => {
    const dateObj = startOfDay(parseISO(log.fecha));
    const dateStr = dateObj.toISOString();
    if (!uniqueDatesMap.has(dateStr)) {
      uniqueDatesMap.set(dateStr, dateObj);
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

  const refDay = startOfDay(referenceDate);
  let currentStreak = 0;

  if (habit.frecuencia === Frequency.WEEKLY || habit.frecuencia === 'WEEKLY') {
    // Frecuencia Semanal: Racha cuenta las semanas consecutivas en las que se ha completado al menos 1 vez.
    const refWeek = startOfWeek(refDay, { weekStartsOn: 1 }); // Semana empieza en Lunes
    
    // Obtenemos semanas únicas ordenadas
    const uniqueWeeks = Array.from(new Set(sortedDates.map(d => startOfWeek(d, { weekStartsOn: 1 }).toISOString())))
      .map(isoString => new Date(isoString))
      .sort((a, b) => b.getTime() - a.getTime());

    let currentExpectedWeek = refWeek;
    
    // Si la última semana registrada está en el futuro, no contamos racha desde "hoy", contamos desde esa semana o ignoramos.
    // Asumiremos que el usuario no puede registrar en el futuro de manera realista super lejos.
    // Si la primer semana (la más reciente) es anterior a la semana pasada, la racha está rota.
    if (uniqueWeeks.length > 0 && differenceInWeeks(refWeek, uniqueWeeks[0]) > 1) {
      return 0; // Se rompió la racha hace más de una semana
    }

    // Iniciamos la verificación
    for (const week of uniqueWeeks) {
      const diff = differenceInWeeks(currentExpectedWeek, week);
      if (diff === 0) {
        currentStreak++;
        currentExpectedWeek = new Date(currentExpectedWeek.getTime() - 7 * 24 * 60 * 60 * 1000); // Restar 1 semana
      } else if (diff === 1) {
        // En la semana de referencia no se hizo, pero en la pasada sí, y vamos restando consecutivo
        if (currentStreak === 0) {
          // Si estamos evaluando la semana actual y no hay (diff=1), empezamos a contar desde la pasada
          currentStreak++;
          currentExpectedWeek = new Date(week.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          // Si difiere más de 1 semana consecutiva estricta, se rompe
          break;
        }
      } else {
        // Difiere más de 1 semana, racha rota
        break;
      }
    }

    return currentStreak;

  } else {
    // Frecuencia Diaria (y por defecto): Racha cuenta los días consecutivos.
    let currentExpectedDay = refDay;

    // Si el último registro (más reciente) fue hace más de un día, la racha está rota.
    if (sortedDates.length > 0 && differenceInDays(refDay, sortedDates[0]) > 1) {
      return 0;
    }

    for (const date of sortedDates) {
      const diff = differenceInDays(currentExpectedDay, date);
      
      if (diff === 0) {
        // Coincide con el día esperado (hoy o retrocediendo)
        currentStreak++;
        // Retrocedemos el día esperado
        currentExpectedDay = new Date(currentExpectedDay.getTime() - 24 * 60 * 60 * 1000);
      } else if (diff === 1 && currentStreak === 0) {
        // No se hizo "hoy", pero sí "ayer". Empezamos la racha contándola desde ayer.
        currentStreak++;
        currentExpectedDay = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      } else {
        // Se saltó un día, la racha se rompió
        break;
      }
    }

    return currentStreak;
  }
};

/**
 * Calcula la racha histórica más larga en base a los logs.
 * Se asume frecuencia diaria para simplificar racha máxima pura (como es común en gamification).
 * 
 * @param logs Lista de registros
 * @returns Número de la racha máxima histórica
 */
export const calculateMaxStreak = (logs: HabitLog[]): number => {
  if (!logs || logs.length === 0) return 0;
  const sortedDates = prepareLogs(logs);
  if (sortedDates.length === 0) return 0;
  
  // Ordenar fechas ascendentemente para procesar hacia adelante
  const ascendingDates = [...sortedDates].reverse();

  let maxStreak = 1;
  let currentCounter = 1;

  for (let i = 1; i < ascendingDates.length; i++) {
    const diff = differenceInDays(ascendingDates[i], ascendingDates[i - 1]);
    
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
};

/**
 * Calcula el porcentaje de éxito (Completion Rate) en los últimos "N" días.
 * 
 * @param logs Lista de registros
 * @param days Número de días hacia atrás a evaluar (ej: 30)
 * @param referenceDate Fecha de referencia (hoy)
 * @returns Porcentaje de éxito (0 a 100)
 */
export const calculateCompletionRate = (logs: HabitLog[], days: number, referenceDate: Date = new Date()): number => {
  if (!logs || logs.length === 0 || days <= 0) return 0;

  const refDay = startOfDay(referenceDate);
  const startDate = new Date(refDay.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  // Consideramos solo los logs en el rango de los últimos 'days' días y que están completados
  const completedInPeriod = logs.filter(log => {
    if (!log.completado) return false;
    const logDate = startOfDay(parseISO(log.fecha));
    return !isBefore(logDate, startDate) && !isAfter(logDate, refDay);
  });

  // Fechas únicas para evitar contar múltiples logs el mismo día como >1 de éxito
  const uniqueDatesMap = new Set(completedInPeriod.map(log => startOfDay(parseISO(log.fecha)).toISOString()));

  const completedDays = uniqueDatesMap.size;
  
  const percentage = (completedDays / days) * 100;
  return Math.round(percentage * 10) / 10; // Redondea a 1 decimal
};
