import { ImageSourcePropType } from 'react-native';
import { PetState, Priority } from '../types';

export interface HabitCheckInResult {
  id: string;
  prioridad: Priority | string;
  completado: boolean;
}


export type PetAsset = 
  | { type: 'image'; source: ImageSourcePropType }
  | { type: 'emoji'; emoji: string; backgroundColor: string };

/**
 * Asegura que el valor de vida sea un número entero estrictamente en el rango [0, 100].
 * Función pura y centralizada de clamp.
 *
 * @param vida - Valor numérico a normalizar.
 * @returns Entero en el rango [0, 100].
 */
export function clampHealth(vida: number): number {
  if (!Number.isFinite(vida)) return 0;
  return Math.max(0, Math.min(100, Math.round(vida)));
}

/**
 * Determina si un estado es terminal definitivo (la mascota ha partido).
 */
export function isTerminalPetState(state: PetState | string): boolean {
  return state === PetState.ABSENT || state === 'DECEASED';
}

/**
 * Comprueba si una mascota se encuentra en estado terminal definitivo.
 * Una vida de 0 o estado ABSENT/DECEASED es irreversible.
 */
export function isPetTerminal(pet: { vida: number; estadoActual: PetState | string }): boolean {
  return pet.vida === 0 || isTerminalPetState(pet.estadoActual);
}

/**
 * Obtiene el estado emocional de la mascota según su nivel de vida.
 * Función pura que no depende de estado externo.
 * 
 * @param vida - El nivel de vida actual, debe ser un entero entre 0 y 100.
 * @returns El PetState correspondiente.
 * @throws Error descriptivo si la vida no es un entero en el rango [0, 100].
 */
export function getPetState(vida: number): PetState {
  if (!Number.isInteger(vida) || vida < 0 || vida > 100) {
    throw new Error(`El valor de vida debe ser un número entero entre 0 y 100. Valor recibido: ${vida}`);
  }

  if (vida === 0) return PetState.ABSENT;
  if (vida <= 25) return PetState.SAD;
  if (vida <= 50) return PetState.CONFUSED;
  if (vida <= 75) return PetState.CHEERING;
  return PetState.HAPPY;
}

const EMOJI_FALLBACKS: Record<PetState, { emoji: string; backgroundColor: string }> = {
  [PetState.ABSENT]: { emoji: '👻', backgroundColor: '#e2e8f0' },     // slate-200
  [PetState.SAD]: { emoji: '😢', backgroundColor: '#fecaca' },        // red-200
  [PetState.CONFUSED]: { emoji: '😵‍💫', backgroundColor: '#fef08a' }, // yellow-200
  [PetState.CHEERING]: { emoji: '✨', backgroundColor: '#bfdbfe' },    // blue-200
  [PetState.HAPPY]: { emoji: '🥰', backgroundColor: '#bbf7d0' },      // green-200
};

// Variable para activar el uso de sprites cuando estén disponibles.
// Cuando los PNGs finales de 128x128 estén listos en assets/pet/states/,
// simplemente cambia esto a true y descomenta el bloque interior.
const USE_IMAGE_ASSETS = false;

/**
 * Resuelve el asset visual para un PetState dado.
 * Actualmente evalúa si los sprites existen; si no (USE_IMAGE_ASSETS=false),
 * implementa un sistema de placeholders con emojis y color de fondo.
 * Función pura sin efectos secundarios.
 * 
 * @param state - El estado actual de la mascota.
 * @returns PetAsset discriminando entre 'image' y 'emoji'.
 */
export function petAssetResolver(state: PetState): PetAsset {
  if (USE_IMAGE_ASSETS) {
    // Mapeo real de los sprites PNG.
    // Descomentar cuando los archivos existan para evitar errores del bundler Metro.
    /*
    const stateImages: Record<PetState, ImageSourcePropType> = {
      [PetState.ABSENT]: require('../../assets/pet/states/absent.png'),
      [PetState.SAD]: require('../../assets/pet/states/sad.png'),
      [PetState.CONFUSED]: require('../../assets/pet/states/confused.png'),
      [PetState.CHEERING]: require('../../assets/pet/states/cheering.png'),
      [PetState.HAPPY]: require('../../assets/pet/states/happy.png'),
    };
    return { type: 'image', source: stateImages[state] };
    */
  }

  // Fallback garantizado para cada estado obligatorio
  const fallback = EMOJI_FALLBACKS[state] || EMOJI_FALLBACKS[PetState.ABSENT];
  
  return {
    type: 'emoji',
    emoji: fallback.emoji,
    backgroundColor: fallback.backgroundColor,
  };
}

/**
 * Obtiene el delta de salud correspondiente a una prioridad dada.
 * ESSENTIAL = 20, NORMAL = 10, FLEXIBLE = 5.
 * 
 * @param prioridad - La prioridad a evaluar.
 * @param fallback - Valor por defecto a retornar si no se reconoce la prioridad.
 * @returns El valor numérico de la salud.
 */
export function getHealthDeltaForPriority(prioridad?: Priority | string, fallback = 10): number {
  switch (prioridad) {
    case Priority.ESSENTIAL:
    case 'ESSENTIAL':
      return 20;
    case Priority.NORMAL:
    case 'NORMAL':
      return 10;
    case Priority.FLEXIBLE:
    case 'FLEXIBLE':
      return 5;
    default:
      console.warn(`Prioridad desconocida o no definida: ${prioridad}`);
      return fallback;
  }
}

/**
 * Calcula la nueva vida de la mascota tras aplicar los deltas de salud de los check-ins del día.
 * Función pura, no modifica el estado externo.
 * Si la mascota ya tiene vida 0 (estado terminal), la marcha es IRREVERSIBLE y devuelve 0.
 * Un hábito sin log para el día cuenta como fallido (completado: false).
 * 
 * @param vidaActual - El nivel de vida actual antes de aplicar los cambios [0, 100].
 * @param habitos - Lista de resultados de los hábitos activos correspondientes a ese día.
 * @returns El nuevo nivel de vida asegurado en el rango de [0, 100] mediante clamp.
 */
export function applyHealthDelta(vidaActual: number, habitos: HabitCheckInResult[]): number {
  if (vidaActual === 0) {
    return 0;
  }

  if (habitos.length === 0) {
    return clampHealth(vidaActual);
  }

  let deltaTotal = 0;

  for (const habit of habitos) {
    const delta = getHealthDeltaForPriority(habit.prioridad, 0);

    if (habit.completado) {
      deltaTotal += delta;
    } else {
      deltaTotal -= delta;
    }
  }

  const nuevaVida = vidaActual + deltaTotal;
  return clampHealth(nuevaVida);
}

/**
 * Calcula la nueva vida y el estado emocional resultante al aplicar un delta de salud.
 * Implementa la regla estricta de irreversibilidad: una vez en vida 0 o ABSENT,
 * cualquier delta positivo queda bloqueado y se conserva el estado terminal (0, ABSENT).
 *
 * @param currentVida - Nivel de vida actual [0, 100].
 * @param delta - Cambio de vida (+ o -).
 * @param currentEstado - Estado actual opcional para verificación de estado terminal.
 * @returns Objeto con nuevaVida, nuevoEstado y un flag wasTerminal indicando si estaba terminal.
 */
export function calculateNewHealth(
  currentVida: number,
  delta: number,
  currentEstado?: PetState | string
): { nuevaVida: number; nuevoEstado: PetState; wasTerminal: boolean } {
  if (currentVida === 0 || (currentEstado && isTerminalPetState(currentEstado))) {
    return {
      nuevaVida: 0,
      nuevoEstado: PetState.ABSENT,
      wasTerminal: true,
    };
  }

  const nuevaVida = clampHealth(currentVida + delta);
  const nuevoEstado = getPetState(nuevaVida);

  return {
    nuevaVida,
    nuevoEstado,
    wasTerminal: false,
  };
}

/**
 * Calcula el delta negativo total de los hábitos incumplidos del día anterior.
 * Función pura. Prioridad: Esencial = -20, Normal = -10, Flexible = -5.
 * 
 * @param missedHabits - Lista de hábitos que no fueron completados.
 * @returns El delta negativo total (siempre <= 0).
 */
export function calculatePenaltyDelta(missedHabits: import('../types').Habit[]): number {
  let delta = 0;
  for (const habit of missedHabits) {
    delta -= getHealthDeltaForPriority(habit.nivelPrioridad, 0);
  }
  return delta;
}

/**
 * Calcula la progresión de experiencia (XP) y nivel de la mascota.
 * Función pura que acumula XP, evalúa si se superan uno o más umbrales consecutivos,
 * conserva íntegramente el excedente de XP y recalcula el siguiente corte.
 *
 * @param currentNivel - Nivel actual (mínimo 1).
 * @param currentXp - XP acumulado actualmente.
 * @param currentXpParaSiguienteNivel - Umbral de XP para el siguiente nivel.
 * @param gainedXp - Puntos de experiencia a sumar (debe ser >= 0).
 * @returns Objeto con nivel, xp restante y el nuevo xpParaSiguienteNivel.
 */
export function calculateXpProgress(
  currentNivel: number,
  currentXp: number,
  currentXpParaSiguienteNivel: number,
  gainedXp: number
): { nivel: number; xp: number; xpParaSiguienteNivel: number } {
  let nivel = Math.max(1, Math.round(currentNivel || 1));
  let xp = Math.max(0, Math.round(currentXp || 0) + Math.max(0, Math.round(gainedXp || 0)));
  let xpParaSiguienteNivel = Math.max(10, Math.round(currentXpParaSiguienteNivel || 100));

  while (xp >= xpParaSiguienteNivel) {
    xp -= xpParaSiguienteNivel;
    nivel += 1;
    xpParaSiguienteNivel = Math.floor(xpParaSiguienteNivel * 1.5);
  }

  return { nivel, xp, xpParaSiguienteNivel };
}


