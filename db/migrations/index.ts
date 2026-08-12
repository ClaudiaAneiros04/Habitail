import { Migration } from './types';
import { migrationV1 } from './v1_initial_schema';
import { migrationV2 } from './v2_user_penalty_and_inventory';
import { migrationV3 } from './v3_habit_logs_indices';
import { migrationV4 } from './v4_habit_schedule_history';

export * from './types';
export * from './v1_initial_schema';
export * from './v2_user_penalty_and_inventory';
export * from './v3_habit_logs_indices';
export * from './v4_habit_schedule_history';

/**
 * Registro ordenado de todas las migraciones del sistema.
 * Deben mantenerse estrictamente en orden ascendente por versión.
 */
export const migrations: readonly Migration[] = [
  migrationV1,
  migrationV2,
  migrationV3,
  migrationV4,
];

/**
 * Versión objetivo del esquema más reciente.
 */
export const LATEST_SCHEMA_VERSION = migrations.length > 0 
  ? migrations[migrations.length - 1].version 
  : 0;
