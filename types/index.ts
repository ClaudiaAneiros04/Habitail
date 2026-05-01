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

export interface User {
  id: string;
  username: string; // From ER
  email?: string; // From ER
  avatar?: string; // From ER
  fechaRegistro: string; // From ER
  puntos: number; // From ER
  onboardingCompleted: boolean; // From Frontend
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
  fechaInicio: string;
  fechaFin?: string;
  activo: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  fecha: string;
  completado: boolean;
  valor?: number;
  nota?: string;
  timestampRegistro: string;
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
