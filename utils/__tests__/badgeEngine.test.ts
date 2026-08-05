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
    // Set fechaInicio in the past so streaks can be calculated correctly
    fechaInicio: subDays(new Date(), 10).toISOString(),
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
    
    // Set fechaInicio to before the test week
    h1.fechaInicio = new Date('2023-09-01T00:00:00Z').toISOString();
    h2.fechaInicio = new Date('2023-09-01T00:00:00Z').toISOString();
    
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

  it('should handle logs with invalid or empty dates gracefully without crashing', () => {
    const user = getMockUser([], subDays(new Date(), 8).toISOString());
    const h1 = getMockHabit('h1');
    const logs = [
      createLog('h1', 1),
      {
        id: 'bad-log-1',
        habitId: 'h1',
        userId: 'u1',
        fecha: 'invalid-date-string',
        completado: true,
        timestampRegistro: new Date().toISOString()
      },
      {
        id: 'bad-log-2',
        habitId: 'h1',
        userId: 'u1',
        fecha: '',
        completado: true,
        timestampRegistro: new Date().toISOString()
      }
    ];

    expect(() => {
      evaluateBadges(user, [h1], logs);
    }).not.toThrow();
  });

  describe('Historical and Idempotency tests', () => {
    it('should not invalidate an old perfect week because a new habit was created later', () => {
      const user = getMockUser();
      
      // h1 was created a long time ago
      const h1 = getMockHabit('h1');
      h1.fechaInicio = new Date('2023-09-01T00:00:00Z').toISOString();
      
      // h2 was created AFTER the perfect week
      const h2 = getMockHabit('h2');
      h2.fechaInicio = new Date('2023-11-01T00:00:00Z').toISOString();
      
      // Perfect week logs for h1 in Oct 2023
      const lastMonday = new Date('2023-10-02T00:00:00Z');
      const logs: HabitLog[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastMonday.getTime() + i * 86400000);
        logs.push({
          id: `l1_${i}`, habitId: 'h1', userId: 'u1', fecha: d.toISOString(), completado: true, timestampRegistro: d.toISOString()
        });
      }

      // Even though h2 exists and has no logs in this week, the week is still perfect for h1!
      const badges = evaluateBadges(user, [h1, h2], logs);
      expect(badges).toContainEqual({ id: 'perfect_week', name: '100% semanal' });
    });

    it('should maintain idempotency (no recalculations) and preserve granted badges if logs are deleted', () => {
      // User ALREADY has perfect_week badge
      const user = getMockUser(['perfect_week']);
      const h1 = getMockHabit('h1');
      
      // Now imagine the logs for that perfect week were DELETED (logs array is empty)
      const logs: HabitLog[] = [];
      
      const badges = evaluateBadges(user, [h1], logs);
      
      // evaluateBadges should return an empty array (no NEW badges unlocked)
      expect(badges).toEqual([]);
      
      // The user's existing badges should still be there (it shouldn't revoke it)
      expect(user.badges).toContain('perfect_week');
    });

    it('should not re-grant the same badge on repeated execution', () => {
      const user = getMockUser([], subDays(new Date(), 8).toISOString());
      const logs = [createLog('h1', 1)]; // sufficient for first_week

      // First execution unlocks it
      const newBadges1 = evaluateBadges(user, [], logs);
      expect(newBadges1).toContainEqual({ id: 'first_week', name: 'Primera semana' });

      // Simulate applying the badge to the user
      user.badges = [...(user.badges || []), ...newBadges1.map(b => b.id)];

      // Second execution does not unlock it again
      const newBadges2 = evaluateBadges(user, [], logs);
      expect(newBadges2).toEqual([]);
    });
  });
});
