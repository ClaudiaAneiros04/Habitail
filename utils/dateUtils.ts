import { format } from 'date-fns';

/**
 * Formatea una fecha para ser usada en la base de datos (YYYY-MM-DD).
 * Se usa este formato para consistencia en las queries literales de SQLite.
 */
export const formatDateDB = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Genera un ID determinista para un log de hábito.
 * Formato: {habitId}_{YYYY-MM-DD}
 */
export const generateLogId = (habitId: string, date: Date): string => {
  return `${habitId}_${formatDateDB(date)}`;
};
