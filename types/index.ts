// src/types/index.ts

export enum Category {
  SALUD = 'SALUD',
  DEPORTE = 'DEPORTE',
  PRODUCTIVIDAD = 'PRODUCTIVIDAD',
  BIENESTAR = 'BIENESTAR',
  FINANZAS = 'FINANZAS',
  APRENDIZAJE = 'APRENDIZAJE',
}

export enum Frequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum Priority {
  ESSENTIAL = 'ESSENTIAL', // ±20 salud mascota
  NORMAL = 'NORMAL',       // ±10 salud mascota
  FLEXIBLE = 'FLEXIBLE',   // ±5 salud mascota
}

export enum PetState {
  ABSENT = 'ABSENT',       // vida = 0
  SAD = 'SAD',             // vida 1-25
  CONFUSED = 'CONFUSED',   // vida 26-50
  CHEERING = 'CHEERING',   // vida 51-75
  HAPPY = 'HAPPY',         // vida 76-100
}

export enum VerificationType {
  BOOLEAN = 'BOOLEAN',
  NUMERIC = 'NUMERIC',
  TIMER = 'TIMER'
}

/**
 * LogicalDate: Día calendario del usuario en formato exacto YYYY-MM-DD.
 * Inmune a desfases horarios y zonas horarias.
 */
export type LogicalDate = string;

/**
 * Instant: Timestamp real ISO 8601 con fecha, hora y zona horaria (UTC o con offset)
 * para eventos técnicos y registros que requieren precisión temporal.
 */
export type Instant = string;

export interface User {
  id: string;
  username: string; // From ER
  email?: string; // From ER
  avatar?: string; // From ER
  fechaRegistro: Instant; // From ER
  puntos: number; // From ER
  onboardingCompleted: boolean; // From Frontend
  lastPenaltyAppliedDate?: LogicalDate; // App Init Job
  inventario?: string[]; // IDs de items comprados
  badges?: string[]; // IDs de insignias desbloqueadas
  lastOpenedAt?: number; // Timestamp de la última vez que abrió la app (Fase 6)
}

export interface Pet {
  id: string;
  userId: string;
  vida: number; // 0-100
  nivel: number;
  xp: number;
  xpParaSiguienteNivel: number;
  estadoActual: PetState;
  skinEquipada: string;
  accesorios: string[];
}

export interface Habit {
  id: string;
  userId: string;
  nombre: string;
  descripcion?: string;
  categoria: Category | string;
  icono: string;
  colorHex: string;
  frecuencia: Frequency | string;
  diasSemana: number[]; // Array of numbers
  horaRecordatorio?: string;
  tipoVerificacion: VerificationType | string;
  nivelPrioridad: Priority | string;
  fechaInicio: LogicalDate;
  fechaFin?: LogicalDate;
  activo: boolean;

  // English aliases / Gamification properties (Phase 6 Notifications requirement)
  name?: string;
  reminderTime?: string;
  completedDays?: string[];
  
  // Historical schedule configuration
  scheduleHistory?: HabitScheduleHistory[];
}

export interface HabitScheduleHistory {
  id: string;
  habitId: string;
  frecuencia: Frequency | string;
  diasSemana: number[];
  validFrom: LogicalDate;
  validUntil: LogicalDate | null;
  activo: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  fecha: LogicalDate;
  completado: boolean;
  valor?: number;
  nota?: string;
  timestampRegistro: Instant;
}

export interface SuggestedHabit {
  id: string;
  nombre: string;
  categoria: Category | string;
  icono: string;
  descripcion: string;
  locale: string;
}

export interface UserInterest {
  id: string;
  userId: string;
  categoria: Category | string;
}

export interface GamificationEvent {
  eventKey: string;
  userId: string;
  petId: string;
  habitId: string | null;
  logicalDate: LogicalDate;
  eventType: string;
  healthDelta: number;
  pointsDelta: number;
  createdAt: Instant;
  isReverted: boolean;
  revertedAt?: Instant | null;
}
