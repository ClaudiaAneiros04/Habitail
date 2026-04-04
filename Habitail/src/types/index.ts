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

export interface Habit {
  id: string;
  userId: string;
  nombre: string;
  descripcion?: string;
  categoria: Category;
  icono: string;
  color: string;
  frecuencia: Frequency;
  diasSemana: number[]; // 0=Domingo ... 6=Sábado
  horaRecordatorio?: string; // "HH:mm"
  tipoVerificacion: 'checkbox'; // MVP solo checkbox
  nivelPrioridad: Priority;
  fechaInicio: string; // ISO date string
  fechaFin?: string;
  activo: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  fecha: string; // ISO date string "YYYY-MM-DD"
  completado: boolean;
  nota?: string;
  timestampRegistro: string; // ISO datetime
}

export interface User {
  id: string;
  nombre: string;
  onboardingCompleted: boolean;
  lastOpenedAt: string; // ISO datetime
  puntos: number;
  createdAt: string;
}

export interface Pet {
  id: string;
  userId: string;
  nombre: string;
  vida: number; // 0-100
  nivel: number;
  xp: number;
  skinActual: string;
  accesorioActual?: string;
  state: PetState;
}
