import { format } from 'date-fns';
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
export const isFutureDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  return check.getTime() > today.getTime();
};

/**
 * Devuelve un clon de la fecha configurada a medianoche (00:00:00).
 */
export const startOfDayDate = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
