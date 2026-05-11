import { startOfWeek, subDays, isSameWeek } from 'date-fns';
import { Habit, HabitLog, User } from '../types';
import { calculateCurrentStreak } from './streakCalculator';

export interface Badge {
  id: string;
  name: string;
}

export interface UserWithBadges extends User {
  badges?: string[];
}

/**
 * Evalúa el historial del usuario, sus hábitos y logs para desbloquear nuevas insignias.
 * Es una función pura y lazy: solo procesa cuando es necesario y devuelve insignias *nuevas*.
 * 
 * @param user Usuario actual (debe incluir .badges de tipo string[])
 * @param habits Lista de hábitos actuales
 * @param logs Lista del historial completo de check-ins
 * @returns Un arreglo con las insignias (Badges) nuevas desbloqueadas.
 */
export function evaluateBadges(user: UserWithBadges, habits: Habit[], logs: HabitLog[]): Badge[] {
  const newBadges: Badge[] = [];
  const existingBadges = new Set(user.badges || []);

  const addBadge = (id: string, name: string) => {
    if (!existingBadges.has(id)) {
      newBadges.push({ id, name });
      existingBadges.add(id); // Para no duplicar en la misma evaluación
    }
  };

  // 1. first_week: Primera semana
  if (user.fechaRegistro && !existingBadges.has('first_week')) {
    const createdAt = new Date(user.fechaRegistro);
    if (!isNaN(createdAt.getTime())) {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Require 7 days and at least 1 check-in
      if (diffDays >= 7 && logs.length > 0) {
        addBadge('first_week', 'Primera semana');
      }
    }
  }

  // Si no hay logs, el resto de insignias no aplican (excepto tal vez las que piden inactividad, que no hay)
  if (logs.length === 0) {
    return newBadges;
  }

  // Agrupar logs por hábito para calcular rachas
  const logsByHabit = new Map<string, HabitLog[]>();
  logs.forEach(log => {
    const list = logsByHabit.get(log.habitId) || [];
    list.push(log);
    logsByHabit.set(log.habitId, list);
  });

  let maxCurrentStreak = 0;
  for (const habit of habits) {
    const hLogs = logsByHabit.get(habit.id) || [];
    // streakCalculator evalúa la racha actual considerando el día de hoy
    const streak = calculateCurrentStreak(hLogs, habit);
    if (streak > maxCurrentStreak) {
      maxCurrentStreak = streak;
    }
  }

  // 2. streak_7: Racha 7 días
  if (maxCurrentStreak >= 7 && !existingBadges.has('streak_7')) {
    addBadge('streak_7', 'Racha 7 días');
  }

  // 3. streak_30: Racha 30 días
  if (maxCurrentStreak >= 30 && !existingBadges.has('streak_30')) {
    addBadge('streak_30', 'Racha 30 días');
  }

  // 4. perfect_week: 100% semanal
  // "Todos los hábitos activos completados los 7 días de alguna semana natural (Lu–Do)"
  if (!existingBadges.has('perfect_week')) {
    const activeHabits = habits.filter(h => h.activo);
    if (activeHabits.length > 0) {
      const uniqueWeeks = new Set<string>();
      logs.filter(l => l.completado).forEach(l => {
        const d = new Date(l.fecha);
        uniqueWeeks.add(startOfWeek(d, { weekStartsOn: 1 }).toISOString());
      });

      for (const weekStr of uniqueWeeks) {
        const weekStart = new Date(weekStr);
        let perfect = true;

        for (const habit of activeHabits) {
          const hLogs = logsByHabit.get(habit.id) || [];
          const daysCompletedInWeek = new Set<string>();

          hLogs.forEach(l => {
            if (l.completado) {
              const d = new Date(l.fecha);
              if (isSameWeek(d, weekStart, { weekStartsOn: 1 })) {
                // guardamos la fecha truncada a dia para evitar dobles checkins
                daysCompletedInWeek.add(d.toISOString().split('T')[0]);
              }
            }
          });

          // Si un hábito no tiene 7 días completados en esta semana, no es una semana perfecta
          if (daysCompletedInWeek.size < 7) {
            perfect = false;
            break;
          }
        }
        
        if (perfect) {
          addBadge('perfect_week', '100% semanal');
          break; // Con una semana basta
        }
      }
    }
  }

  // 5. one_month_active: 1 mes activo
  // Al menos 1 check-in en 28 de los últimos 30 días calendario
  if (!existingBadges.has('one_month_active')) {
    const now = new Date();
    // Empezamos a contar desde hace 30 días
    const startDate = subDays(now, 30);
    const activeDays = new Set<string>();
    
    logs.filter(l => l.completado).forEach(l => {
      const d = new Date(l.fecha);
      if (d >= startDate) {
        activeDays.add(d.toISOString().split('T')[0]);
      }
    });

    if (activeDays.size >= 28) {
      addBadge('one_month_active', '1 mes activo');
    }
  }

  return newBadges;
}
