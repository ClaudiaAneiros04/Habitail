import { format, parseISO, isValid } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import i18n from '../i18n';

const locales: Record<string, any> = {
  es,
  en: enUS,
};

const getLocale = () => {
  const lang = i18n.language?.split('-')[0] || 'es';
  return locales[lang] || es;
};


/**
 * Devuelve la cadena "YYYY-MM-DD" para el día de hoy según la zona local del usuario.
 */
export const getLogicalToday = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Parsea una fecha (formato YYYY-MM-DD o ISO completo con T)
 * y devuelve un objeto Date representando la medianoche (00:00:00) en UTC.
 * Esto asegura consistencia total sin importar la zona horaria.
 */
export const parseLogicalDateUTC = (dateOrStr: string | Date): Date => {
  if (dateOrStr instanceof Date) {
    // Si ya es un Date (ej. `new Date()`), extraemos su año/mes/día local y lo convertimos a UTC
    return new Date(Date.UTC(dateOrStr.getFullYear(), dateOrStr.getMonth(), dateOrStr.getDate()));
  }
  if (!dateOrStr) return new Date(NaN);
  
  const cleanStr = dateOrStr.includes('T') ? dateOrStr.split('T')[0] : dateOrStr;
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed en JS
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(Date.UTC(year, month, day));
    }
  }
  
  const parsed = parseISO(dateOrStr);
  if (isValid(parsed)) {
    // Si parseISO lo interpretó, construimos un UTC medianoche con esos componentes.
    // Usamos métodos locales de `parsed` porque parseISO podría haber devuelto la fecha en local
    // si la string no tenía zona horaria.
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return new Date(NaN);
};

/**
 * Convierte un objeto Date (construido por parseLogicalDateUTC) a formato YYYY-MM-DD.
 */
export const formatLogicalDate = (dateUTC: Date): string => {
  if (isNaN(dateUTC.getTime())) return '';
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUTC.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Formatea una fecha para ser usada en la base de datos (YYYY-MM-DD).
 * Se mantiene por compatibilidad. Si el Date es UTC medianoche, se usará formatLogicalDate.
 * Si es new Date(), extraerá correctamente.
 */
export const formatDateDB = (date: Date | string): string => {
  if (typeof date === 'string') return date.includes('T') ? date.split('T')[0] : date;
  // Si la hora es estrictamente 00:00:00 y no tiene offset perceptible en UTC, asumimos que es UTC-based
  // Para evitar bugs, delegamos en la conversión estándar.
  return formatLogicalDate(parseLogicalDateUTC(date));
};

/**
 * Genera un ID determinista para un log de hábito.
 * Formato: {habitId}_{YYYY-MM-DD}
 */
export const generateLogId = (habitId: string, date: Date | string): string => {
  return `${habitId}_${formatDateDB(date)}`;
};

/**
 * Formatea la fecha de manera amigable según el idioma actual.
 * Ej: Lunes, 24 de Abril (ES) / Monday, April 24 (EN)
 */
export const formatDateLocally = (date: Date): string => {
  const lang = i18n.language?.split('-')[0] || 'es';
  const locale = getLocale();
  if (lang === 'es') {
    return format(date, "EEEE, d 'de' MMMM", { locale });
  }
  return format(date, "EEEE, MMMM d", { locale });
};

/**
 * Formato corto de fecha según el idioma actual.
 * Ej: 24 Abr (ES) / Apr 24 (EN)
 */
export const formatShortDate = (date: Date): string => {
  const lang = i18n.language?.split('-')[0] || 'es';
  const locale = getLocale();
  if (lang === 'es') {
    return format(date, "dd MMM", { locale });
  }
  return format(date, "MMM dd", { locale });
};

/**
 * Verifica si la fecha proporcionada representa un día estrictamente
 * posterior al día de hoy. Considera solo la fecha (día exacto).
 */
export const isFutureDate = (date: Date | string): boolean => {
  const todayUTC = parseLogicalDateUTC(new Date());
  const checkUTC = parseLogicalDateUTC(date);
  return checkUTC.getTime() > todayUTC.getTime();
};

/**
 * Devuelve un clon de la fecha configurada a medianoche (00:00:00).
 */
export const startOfDayDate = (date: Date | string): Date => {
  return parseLogicalDateUTC(date);
};
