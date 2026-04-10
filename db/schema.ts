/**
 * @file db/schema.ts
 * @description Definición de los esquemas y tipos de datos principales para la aplicación Habitail.
 * Estos tipos aseguran la consistencia de los datos en toda la aplicación y facilitan
 * el almacenamiento de datos (ej. AsyncStorage, SQLite, API o local json).
 */

/**
 * Representa la frecuencia con la que se debe realizar un hábito.
 */
export enum HabitFrequency {
  DAILY = 'DAILY',           // Todos los días
  WEEKLY = 'WEEKLY',         // Ciertas veces a la semana
  MONTHLY = 'MONTHLY',       // Ciertas veces al mes
  CUSTOM = 'CUSTOM'          // Días específicos de la semana
}

/**
 * Representa el tipo de verificación o medición de un hábito.
 */
export enum VerificationType {
  BOOLEAN = 'BOOLEAN',       // Simple Sí/No (Completado o no)
  NUMERIC = 'NUMERIC',       // Basado en una cantidad (ej. beber 2 litros de agua)
  TIMER = 'TIMER'            // Basado en tiempo (ej. leer por 30 minutos)
}

/**
 * Representa el nivel de prioridad de un hábito.
 */
export enum PriorityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Días de la semana para definir frecuencias personalizadas.
 */
export enum DayOfWeek {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 0
}

/**
 * Interfaz principal que define la estructura de un Hábito.
 */
export interface Habit {
  /** Identificador único del hábito (UUID recomendado) */
  id: string;
  
  /** Identificador del usuario al que pertenece el hábito */
  userId: string;
  
  /** Nombre o título del hábito */
  nombre: string;
  
  /** Descripción detallada opcional del hábito */
  descripcion?: string;
  
  /** Categoría a la que pertenece (ej. 'Salud', 'Productividad') */
  categoria: string;
  
  /** Nombre del icono representativo (referencia para la UI, ej. iconos de Ionicons) */
  icono: string;
  
  /** Color en formato hexadecimal para la UI (ej. '#FF5733') */
  color: string;
  
  /** Frecuencia de repetición del hábito */
  frecuencia: HabitFrequency;
  
  /** 
   * Días de la semana en los que aplica (si la frecuencia es CUSTOM).
   * Puede estar vacío para frecuencias como DAILY.
   */
  diasSemana: DayOfWeek[];
  
  /** Hora de recordatorio en formato 'HH:mm' (ej. '08:30'). Opcional. */
  horaRecordatorio?: string;
  
  /** Método de evaluación del progreso del hábito */
  tipVerificacion: VerificationType;
  
  /** Nivel de importancia del hábito */
  nivelPrioridad: PriorityLevel;
  
  /** 
   * Fecha de inicio en formato ISO 8601 string (ej. '2023-10-25T00:00:00.000Z'). 
   * Permite una fácil serialización/deserialización a JSON.
   */
  fechaInicio: string;
  
  /** 
   * Fecha de finalización u objetivo en formato ISO 8601 string. 
   * Opcional si es un hábito que se mantiene de forma indefinida. 
   */
  fechaFin?: string;
  
  /** Indica si el hábito está actualmente en curso (true) o archivado/pausado (false) */
  activo: boolean;
}

/**
 * Interfaz que representa el registro o log de actividad de un hábito.
 */
export interface HabitLog {
  /** Identificador único del registro (UUID recomendado) */
  id: string;
  
  /** Identificador del hábito asociado */
  habitId: string;
  
  /** Identificador del usuario que realiza el registro */
  userId: string;
  
  /** 
   * Fecha a la que corresponde lógicamente este registro (formato normalizado ej. 'YYYY-MM-DD').
   * Permite buscar rápidamente si un hábito se completó en un día en específico.
   */
  fecha: string;
  
  /** 
   * Estado de completitud del hábito para esta fecha.
   */
  completado: boolean;
  
  /** Notas u observaciones opcionales brindadas por el usuario para este día */
  nota?: string;
  
  /** 
   * Fecha y hora real exacta en la que se creó o actualizó el registro.
   */
  timestampRegistro: string;
}
