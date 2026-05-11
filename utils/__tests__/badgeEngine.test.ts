import { evaluateBadges, UserWithBadges, Badge } from '../badgeEngine';
import { Habit, HabitLog, Frequency, Priority } from '../../types';
import { startOfDay, subDays } from 'date-fns';

describe('badgeEngine', () => {
  const getMockUser = (badges: string[] = [], fechaRegistro = new Date().toISOString()): UserWithBadges => ({
    id: 'u1',
    username: 'test',
    fechaRegistro,
    puntos: 0,
    onboardingCompleted: true,
    badges,
  });

  const getMockHabit = (id: string, activo = true): Habit => ({
    id,
    userId: 'u1',
    nombre: 'Habit ' + id,
    categoria: 'SALUD',
    icono: 'icon',
    colorHex: '#000',
    frecuencia: Frequency.DAILY,
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoVerificacion: 'BOOLEAN',
    nivelPrioridad: Priority.NORMAL,
    fechaInicio: new Date().toISOString(),
    activo,
  });

  const createLog = (habitId: string, daysAgo: number): HabitLog => {
    const d = subDays(startOfDay(new Date()), daysAgo);
    return {
      id: `log_${habitId}_${daysAgo}`,
      habitId,
      userId: 'u1',
      fecha: d.toISOString(),
      completado: true,
      timestampRegistro: new Date().toISOString(),
    };
  };

  it('should not return already granted badges', () => {
    const user = getMockUser(['first_week']);
    const logs = [createLog('h1', 1)];
    user.fechaRegistro = subDays(new Date(), 8).toISOString();
    
    const badges = evaluateBadges(user, [], logs);
    expect(badges.find(b => b.id === 'first_week')).toBeUndefined();
  });

  it('should grant first_week if 7 days passed and at least 1 log', () => {
    const user = getMockUser([], subDays(new Date(), 8).toISOString());
    const logs = [createLog('h1', 1)];
    const badges = evaluateBadges(user, [], logs);
    expect(badges).toContainEqual({ id: 'first_week', name: 'Primera semana' });
  });

  it('should not grant first_week if < 7 days passed', () => {
    const user = getMockUser([], subDays(new Date(), 5).toISOString());
    const logs = [createLog('h1', 1)];
    const badges = evaluateBadges(user, [], logs);
    expect(badges.find(b => b.id === 'first_week')).toBeUndefined();
  });

  it('should grant streak_7 when currentStreak >= 7', () => {
    const user = getMockUser();
    const habit = getMockHabit('h1');
    const logs = Array.from({ length: 7 }, (_, i) => createLog('h1', i)); // Today to 6 days ago
    
    const badges = evaluateBadges(user, [habit], logs);
    expect(badges).toContainEqual({ id: 'streak_7', name: 'Racha 7 días' });
  });

  it('should grant perfect_week when all active habits completed 7 days in a natural week', () => {
    const user = getMockUser();
    const h1 = getMockHabit('h1');
    const h2 = getMockHabit('h2');
    
    // Create logs for 7 consecutive days starting from last Monday
    // Since this is relative, we'll just generate logs for a specific known week.
    const lastMonday = new Date('2023-10-02T00:00:00Z'); // Assuming 2023-10-02 is a Monday
    const logs: HabitLog[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lastMonday.getTime() + i * 86400000);
      logs.push({
        id: `l1_${i}`, habitId: 'h1', userId: 'u1', fecha: d.toISOString(), completado: true, timestampRegistro: d.toISOString()
      });
      logs.push({
        id: `l2_${i}`, habitId: 'h2', userId: 'u1', fecha: d.toISOString(), completado: true, timestampRegistro: d.toISOString()
      });
    }

    const badges = evaluateBadges(user, [h1, h2], logs);
    expect(badges).toContainEqual({ id: 'perfect_week', name: '100% semanal' });
  });

  it('should return empty list if no new badges to unlock', () => {
    const user = getMockUser(['first_week', 'streak_7', 'streak_30', 'perfect_week', 'one_month_active']);
    const h1 = getMockHabit('h1');
    const logs = Array.from({ length: 40 }, (_, i) => createLog('h1', i));
    
    const badges = evaluateBadges(user, [h1], logs);
    expect(badges).toEqual([]);
  });

  it('should not mutate parameters', () => {
    const user = getMockUser();
    const userClone = JSON.parse(JSON.stringify(user));
    const habits = [getMockHabit('h1')];
    const habitsClone = JSON.parse(JSON.stringify(habits));
    const logs = [createLog('h1', 1)];
    const logsClone = JSON.parse(JSON.stringify(logs));

    evaluateBadges(user, habits, logs);

    expect(user).toEqual(userClone);
    expect(habits).toEqual(habitsClone);
    expect(logs).toEqual(logsClone);
  });
});
