import { Habit, Priority } from '../../types';
import { calcPointsDelta, deductPoints, InsufficientPointsError } from '../pointsEngine';

describe('pointsEngine', () => {
  describe('calcPointsDelta', () => {
    it('should return 20 for ESSENTIAL priority', () => {
      const habit = { nivelPrioridad: Priority.ESSENTIAL } as Habit;
      expect(calcPointsDelta(habit)).toBe(20);
    });

    it('should return 10 for NORMAL priority', () => {
      const habit = { nivelPrioridad: Priority.NORMAL } as Habit;
      expect(calcPointsDelta(habit)).toBe(10);
    });

    it('should return 5 for FLEXIBLE priority', () => {
      const habit = { nivelPrioridad: Priority.FLEXIBLE } as Habit;
      expect(calcPointsDelta(habit)).toBe(5);
    });

    it('should return 0 for unknown priority', () => {
      const habit = { nivelPrioridad: 'UNKNOWN' } as Habit;
      expect(calcPointsDelta(habit)).toBe(0);
    });

    it('should not mutate the habit', () => {
      const habit = { id: '1', nivelPrioridad: Priority.NORMAL } as Habit;
      const clone = { ...habit };
      calcPointsDelta(habit);
      expect(habit).toEqual(clone);
    });
  });

  describe('deductPoints', () => {
    it('should deduct correctly if sufficient points', () => {
      const result = deductPoints(100, 30);
      expect(result).toEqual({ ok: true, value: 70 });
    });

    it('should return error if price is greater than balance', () => {
      const result = deductPoints(50, 60);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(InsufficientPointsError);
      }
    });

    it('should return error if price is exactly 1 greater than balance', () => {
      const result = deductPoints(10, 11);
      expect(result.ok).toBe(false);
    });

    it('should deduct completely to 0 if exact amount', () => {
      const result = deductPoints(50, 50);
      expect(result).toEqual({ ok: true, value: 0 });
    });
  });
});
