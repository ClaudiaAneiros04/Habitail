import {
  parseLogicalDateUTC,
  formatLogicalDate,
  formatDateDB,
  getLogicalToday
} from '../dateUtils';

describe('Date Utilities', () => {
  describe('parseLogicalDateUTC & formatLogicalDate', () => {
    it('should parse YYYY-MM-DD strings to UTC midnight correctly', () => {
      const date = parseLogicalDateUTC('2023-10-25');
      expect(date.getUTCFullYear()).toBe(2023);
      expect(date.getUTCMonth()).toBe(9); // 0-indexed
      expect(date.getUTCDate()).toBe(25);
      expect(date.getUTCHours()).toBe(0);
      expect(formatLogicalDate(date)).toBe('2023-10-25');
    });

    it('should strip time when parsing full ISO strings', () => {
      const date = parseLogicalDateUTC('2023-10-25T23:59:59.999Z');
      expect(date.getUTCFullYear()).toBe(2023);
      expect(date.getUTCMonth()).toBe(9);
      expect(date.getUTCDate()).toBe(25);
      expect(formatLogicalDate(date)).toBe('2023-10-25');
    });

    it('should handle Date objects by converting their local time to UTC midnight', () => {
      // Mocking local time can be tricky, but we can verify it translates local components properly
      const localDate = new Date(2024, 1, 29, 23, 59, 59); // Feb 29, 2024 local
      const utcDate = parseLogicalDateUTC(localDate);
      expect(utcDate.getUTCFullYear()).toBe(2024);
      expect(utcDate.getUTCMonth()).toBe(1);
      expect(utcDate.getUTCDate()).toBe(29);
      expect(utcDate.getUTCHours()).toBe(0);
      expect(formatLogicalDate(utcDate)).toBe('2024-02-29');
    });
  });

  describe('formatDateDB', () => {
    it('should handle YYYY-MM-DD input gracefully', () => {
      expect(formatDateDB('2023-10-25')).toBe('2023-10-25');
    });

    it('should format Date objects using their Logical mapping', () => {
      const d = new Date(2025, 11, 31, 23, 59, 59);
      expect(formatDateDB(d)).toBe('2025-12-31');
    });
  });

  describe('getLogicalToday', () => {
    it('should return a YYYY-MM-DD string', () => {
      const today = getLogicalToday();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
