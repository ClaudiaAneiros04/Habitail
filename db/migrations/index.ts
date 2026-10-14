import { Migration } from './types';
import { migrationV1 } from './v1_initial_schema';
import { migrationV2 } from './v2_user_penalty_and_inventory';
import { migrationV3 } from './v3_habit_logs_indices';
import { migrationV4 } from './v4_habit_schedule_history';
import { migrationV5 } from './v5_habit_logs_unique';
import { migrationV6 } from './v6_historical_schedule_and_logical_dates';
import { migrationV7 } from './v7_gamification_events';
import { migrationV8 } from './v8_user_last_opened_at';

export * from './types';
export * from './v1_initial_schema';
export * from './v2_user_penalty_and_inventory';
export * from './v3_habit_logs_indices';
export * from './v4_habit_schedule_history';
export * from './v5_habit_logs_unique';
export * from './v6_historical_schedule_and_logical_dates';
export * from './v7_gamification_events';
export * from './v8_user_last_opened_at';

/**
 * Registro ordenado de todas las migraciones del sistema.
 * Deben mantenerse estrictamente en orden ascendente por versión.
 */
export const migrations: readonly Migration[] = [
  migrationV1,
  migrationV2,
  migrationV3,
  migrationV4,
  migrationV5,
  migrationV6,
  migrationV7,
  migrationV8,
];

/**
 * Versión objetivo del esquema más reciente.
 */
export const LATEST_SCHEMA_VERSION = migrations.length > 0 
  ? migrations[migrations.length - 1].version 
  : 0;
