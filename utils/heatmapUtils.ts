/**
 * heatmapUtils.ts
 *
 * Funciones puras para construir y transformar los datos del heatmap.
 * ──────────────────────────────────────────────────────────────────────
 * RESPONSABILIDAD ÚNICA: convertir el output crudo del Repository
 * (solo días con logs) en el array completo de 365 entradas que
 * necesita el componente de heatmap, rellenando con value=0 los días
 * sin actividad.
 *
 * No hay I/O, no hay efectos secundarios: todo es transformación pura.
 */

import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from 'date-fns';
import { HeatmapRawRow } from '../storage/LogRepository';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Entrada del heatmap lista para consumir por la UI.
 *
 * value:
 *   0 → sin log registrado para ese día
 *   1 → log existente con completado = false (incumplido)
 *   2 → log existente con completado = true  (completado)
 */
export interface HeatmapEntry {
  /** Fecha en formato YYYY-MM-DD. */
  date: string;
  value: 0 | 1 | 2;
}

/**
 * Rango de fechas YYYY-MM-DD para la ventana del heatmap.
 */
export interface HeatmapDateRange {
  fromDate: string;
  toDate: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Funciones puras
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Construye el rango de fechas estándar del heatmap: los últimos 365 días
 * (hoy incluido), en formato YYYY-MM-DD.
 *
 * Por qué 365 y no 366:
 *   Se elige 364 días hacia atrás + hoy = 365 días totales, ventana de un año
 *   exacto que encaja en la mayoría de componentes de heatmap (52 semanas + 1 día).
 *
 * Caso borde — cruce de año:
 *   `subDays` de date-fns maneja automáticamente el cruce de año, fin de mes
 *   y años bisiestos. No requiere lógica adicional.
 *
 * Caso borde — zona horaria:
 *   `startOfDay(referenceDate)` usa la zona horaria local del dispositivo.
 *   Si el dispositivo cambia de TZ, el fromDate puede variar ligeramente.
 *   Documentado en LEARNING.md — Fase 4 / Heatmap.
 *
 * @param referenceDate - Fecha de referencia («hoy»). Por defecto: new Date().
 * @returns HeatmapDateRange con fromDate y toDate en formato YYYY-MM-DD.
 */
export const buildHeatmapRange = (referenceDate: Date = new Date()): HeatmapDateRange => {
  const today = startOfDay(referenceDate);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  return {
    fromDate: fmt(subDays(today, 364)), // 365 días totales: today - 364 días
    toDate: fmt(today),
  };
};

/**
 * Combina las filas crudas del Repository (solo días CON logs) con el rango
 * completo de fechas, asignando value=0 a los días sin actividad.
 *
 * Algoritmo:
 *   1. Construye un Map<fecha, value> con los resultados SQL para lookup O(1).
 *   2. Genera todos los días del rango con `eachDayOfInterval`.
 *   3. Para cada día, toma el value del Map o asigna 0 si no hay log.
 *
 * Por qué generar los días en TypeScript y no en SQL:
 *   SQLite no tiene una función generadora de secuencias de fechas sin
 *   usar tablas auxiliares o CTEs recursivos. Generar 365 fechas en JS
 *   es O(365) = O(1) en la práctica y más legible.
 *
 * Caso borde — rango vacío (fromDate > toDate):
 *   `eachDayOfInterval` lanza si start > end. Prevenido en buildHeatmapRange,
 *   pero se añade guard por robustez.
 *
 * Caso borde — primer uso de la app (rawRows vacío):
 *   El Map estará vacío; todos los días recibirán value=0. Array válido, sin error.
 *
 * Caso borde — cruce de año en el rango:
 *   `eachDayOfInterval` maneja cambios de año, meses de 28/29/30/31 días
 *   y años bisiestos correctamente a través de date-fns.
 *
 * @param rawRows  - Filas crudas del Repository (solo días con logs).
 * @param fromDate - Fecha inicial del rango (YYYY-MM-DD).
 * @param toDate   - Fecha final del rango (YYYY-MM-DD).
 * @returns Array completo con una entrada por día, ordenado cronológicamente.
 */
export const mergeHeatmapData = (
  rawRows: HeatmapRawRow[],
  fromDate: string,
  toDate: string
): HeatmapEntry[] => {
  // Guard: si el rango es inválido, retornar vacío sin lanzar excepción.
  if (fromDate > toDate) return [];

  // Construir lookup Map con las filas SQL: O(rawRows.length)
  const lookup = new Map<string, 1 | 2>();
  rawRows.forEach((row) => {
    // SQLite devuelve INTEGER como number; el CASE WHEN produce 1 o 2.
    // Castear a 1|2 para satisfacer el tipo HeatmapEntry.value.
    const safeValue = (Number(row.value) === 2 ? 2 : 1) as 1 | 2;
    lookup.set(row.date, safeValue);
  });

  // Generar todos los días del rango: O(365) ≈ O(1)
  const days = eachDayOfInterval({
    start: parseISO(fromDate),
    end: parseISO(toDate),
  });

  // Mapear cada día a su entrada HeatmapEntry
  return days.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const value = lookup.get(dateStr) ?? 0;
    return { date: dateStr, value };
  });
};
