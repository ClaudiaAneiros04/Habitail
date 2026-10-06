import { format, parseISO, isValid } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import i18n from '../i18n';
import { LogicalDate, Instant } from '../types';

export { LogicalDate, Instant };

const locales: Record<string, any> = {
  es,
  en: enUS,
};

const getLocale = () => {
  const lang = i18n.language?.split('-')[0] || 'es';
  return locales[lang] || es;
};

/**
 * Valida si un string cumple estrictamente con el formato YYYY-MM-DD y es una fecha válida.
 */
export const isValidLogicalDate = (str: unknown): str is LogicalDate => {
  if (typeof str !== 'string') return false;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInMonth = getDaysInMonth(y, m);
  return d <= daysInMonth;
};

/**
 * Devuelve la cadena "YYYY-MM-DD" para el día de hoy según la zona local del usuario.
 * Acepta un Date opcional (útil para inyección de tiempo y pruebas unitarias).
 */
export const getLogicalToday = (now?: Date): LogicalDate => {
  const d = now ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` as LogicalDate;
};

/**
 * Obtiene el Instant actual (ISO 8601 con hora y zona UTC).
 */
export const getCurrentInstant = (): Instant => {
  return new Date().toISOString() as Instant;
};

/**
 * Convierte un Date o string a Instant (ISO 8601).
 */
export const toInstant = (dateOrStr?: Date | string): Instant => {
  if (!dateOrStr) return getCurrentInstant();
  if (dateOrStr instanceof Date) return dateOrStr.toISOString() as Instant;
  if (typeof dateOrStr === 'string') {
    if (dateOrStr.includes('T')) return dateOrStr as Instant;
    // Si es un LogicalDate YYYY-MM-DD, convertimos a UTC medianoche ISO
    return `${dateOrStr}T00:00:00.000Z` as Instant;
  }
  return getCurrentInstant();
};

/**
 * Convierte de forma canónica y segura cualquier Date o string a LogicalDate (YYYY-MM-DD).
 * - Si ya es un string YYYY-MM-DD, lo devuelve sin alterar.
 * - Si es un Date, extrae año/mes/día LOCALES (evitando desplazamiento por UTC).
 * - Si es un string ISO con 'T', extrae la fecha evitando desvíos por zona horaria.
 */
export const toLogicalDate = (dateOrStr: Date | string): LogicalDate => {
  if (!dateOrStr) return getLogicalToday();

  if (dateOrStr instanceof Date) {
    if (isNaN(dateOrStr.getTime())) return getLogicalToday();
    const y = dateOrStr.getFullYear();
    const m = String(dateOrStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateOrStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}` as LogicalDate;
  }

  if (typeof dateOrStr === 'string') {
    const trimmed = dateOrStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed as LogicalDate;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      // Extrae directamente la porción YYYY-MM-DD
      return trimmed.substring(0, 10) as LogicalDate;
    }
    // Para otros formatos, parseamos con parseISO
    const parsed = parseISO(trimmed);
    if (isValid(parsed)) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}` as LogicalDate;
    }
  }

  return getLogicalToday();
};

/**
 * Devuelve el número de días que tiene un mes en un año concreto (1-indexed: 1 = Enero, 12 = Diciembre).
 */
export const getDaysInMonth = (year: number, month1Indexed: number): number => {
  return new Date(Date.UTC(year, month1Indexed, 0)).getUTCDate();
};

/**
 * Devuelve el día de la semana para un LogicalDate según la convención JS:
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado.
 */
export const getDayOfWeek = (date: LogicalDate | string | Date): number => {
  const logDate = toLogicalDate(date);
  const [y, m, d] = logDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCDay();
};

/**
 * Suma un número de días a un LogicalDate (soporta valores positivos y negativos).
 * Realiza matemática UTC pura, inmune a transiciones de horario de verano (DST) y husos horarios.
 */
export const addDaysToLogicalDate = (date: LogicalDate | string | Date, days: number): LogicalDate => {
  const logDate = toLogicalDate(date);
  const [y, m, d] = logDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const resY = utc.getUTCFullYear();
  const resM = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(utc.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}` as LogicalDate;
};

/**
 * Resta un número de días a un LogicalDate.
 */
export const subDaysFromLogicalDate = (date: LogicalDate | string | Date, days: number): LogicalDate => {
  return addDaysToLogicalDate(date, -days);
};

/**
 * Calcula la diferencia en días entre dateA y dateB (dateA - dateB).
 */
export const diffInDaysLogicalDates = (
  dateA: LogicalDate | string | Date,
  dateB: LogicalDate | string | Date
): number => {
  const [yA, mA, dA] = toLogicalDate(dateA).split('-').map(Number);
  const [yB, mB, dB] = toLogicalDate(dateB).split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcA - utcB) / (24 * 60 * 60 * 1000));
};

/**
 * Compara dos fechas lógicas: -1 si a < b, 0 si a === b, 1 si a > b.
 */
export const compareLogicalDates = (
  dateA: LogicalDate | string | Date,
  dateB: LogicalDate | string | Date
): number => {
  const a = toLogicalDate(dateA);
  const b = toLogicalDate(dateB);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

export const isLogicalDateBefore = (
  dateA: LogicalDate | string | Date,
  dateB: LogicalDate | string | Date
): boolean => {
  return toLogicalDate(dateA) < toLogicalDate(dateB);
};

export const isLogicalDateAfter = (
  dateA: LogicalDate | string | Date,
  dateB: LogicalDate | string | Date
): boolean => {
  return toLogicalDate(dateA) > toLogicalDate(dateB);
};

export const isLogicalDateBetween = (
  date: LogicalDate | string | Date,
  from: LogicalDate | string | Date,
  to: LogicalDate | string | Date
): boolean => {
  const d = toLogicalDate(date);
  return d >= toLogicalDate(from) && d <= toLogicalDate(to);
};

/**
 * Parsea un LogicalDate a un objeto Date en UTC medianoche (00:00:00).
 * Mantiene compatibilidad con APIs que consumen Date.
 */
export const parseLogicalDateUTC = (dateOrStr: string | Date): Date => {
  if (dateOrStr instanceof Date) {
    if (isNaN(dateOrStr.getTime())) return new Date(NaN);
    return new Date(Date.UTC(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate()));
  }
  if (!dateOrStr) return new Date(NaN);

  const logDate = toLogicalDate(dateOrStr);
  const [y, m, d] = logDate.split('-').map(Number);
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(NaN);
};

/**
 * Convierte un Date UTC a formato YYYY-MM-DD.
 */
export const formatLogicalDate = (dateUTC: Date): LogicalDate => {
  if (isNaN(dateUTC.getTime())) return '' as LogicalDate;
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUTC.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as LogicalDate;
};

/**
 * Formatea una fecha para persistir en SQLite (YYYY-MM-DD).
 */
export const formatDateDB = (date: Date | string): LogicalDate => {
  return toLogicalDate(date);
};

/**
 * Genera un ID determinista para un log de hábito: {habitId}_{YYYY-MM-DD}
 */
export const generateLogId = (habitId: string, date: Date | string): string => {
  return `${habitId}_${toLogicalDate(date)}`;
};

/**
 * Formatea la fecha de manera amigable según el idioma actual.
 */
export const formatDateLocally = (date: Date | string): string => {
  const d = date instanceof Date ? date : parseLogicalDateUTC(date);
  const lang = i18n.language?.split('-')[0] || 'es';
  const locale = getLocale();
  if (lang === 'es') {
    return format(d, "EEEE, d 'de' MMMM", { locale });
  }
  return format(d, "EEEE, MMMM d", { locale });
};

/**
 * Formato corto de fecha según el idioma actual.
 */
export const formatShortDate = (date: Date | string): string => {
  const d = date instanceof Date ? date : parseLogicalDateUTC(date);
  const lang = i18n.language?.split('-')[0] || 'es';
  const locale = getLocale();
  if (lang === 'es') {
    return format(d, "dd MMM", { locale });
  }
  return format(d, "MMM dd", { locale });
};

/**
 * Verifica si la fecha es estrictamente posterior a hoy.
 */
export const isFutureDate = (date: Date | string): boolean => {
  const today = getLogicalToday();
  const target = toLogicalDate(date);
  return target > today;
};

/**
 * Devuelve un objeto Date configurado a medianoche UTC para la fecha dada.
 */
export const startOfDayDate = (date: Date | string): Date => {
  return parseLogicalDateUTC(date);
};
