import { ImageSourcePropType } from 'react-native';
import { PetState } from '../types';

export type PetAsset = 
  | { type: 'image'; source: ImageSourcePropType }
  | { type: 'emoji'; emoji: string; backgroundColor: string };

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
