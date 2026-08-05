import * as SQLite from 'expo-sqlite';

/**
 * Representa una migración de esquema versionada en SQLite.
 */
export interface Migration {
  /**
   * Número de versión secuencial y único de la migración (1, 2, 3, etc.).
   */
  version: number;

  /**
   * Nombre identificativo o descripción breve de la migración.
   */
  name: string;

  /**
   * Función asíncrona que aplica los cambios de esquema correspondientes.
   */
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}
