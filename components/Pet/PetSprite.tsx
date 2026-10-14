import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  ImageSourcePropType,
} from 'react-native';
import { PetState } from '../../types';

export type PetMood =
  | 'happy'
  | 'cheering'
  | 'confused'
  | 'sad'
  | 'absent'
  | 'ghost'
  | PetState
  | string;

export interface PetSpriteProps {
  /**
   * Estado de ánimo actual de la mascota.
   * - 'happy' (Fila 0)
   * - 'cheering' (Fila 1)
   * - 'confused' (Fila 2)
   * - 'sad' (Fila 3)
   * - 'absent' / 'ghost' (Fila 4)
   */
  mood: PetMood;

  /**
   * Tamaño cuadrado del frame en píxeles (ancho y alto).
   * @default 150
   */
  size?: number;

  /**
   * Duración en milisegundos de cada frame de animación (~6-8 FPS).
   * @default 150 (aprox. 6.7 FPS)
   */
  frameDurationMs?: number;

  /**
   * Archivo de spritesheet local.
   * @default require('../../assets/pet_sprites.png')
   */
  source?: ImageSourcePropType;

  /**
   * Técnica para desplazar el frame:
   * - 'transform' (default): usa transform: [{ translateX }, { translateY }]
   * - 'absolute': usa top / left absolutos
   * @default 'transform'
   */
  positioning?: 'transform' | 'absolute';

  /**
   * Estilo adicional para el contenedor de recorte.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Estilo adicional para la imagen del spritesheet.
   */
  imageStyle?: StyleProp<ImageStyle>;

  /**
   * Identificador para pruebas automatizadas.
   */
  testID?: string;
}

// Configuración fija de la cuadrícula del spritesheet
export const SPRITE_GRID = {
  COLUMNS: 4, // Frames 0 a 3
  ROWS: 5,    // Moods 0 a 4
} as const;

/**
 * Obtiene el índice de fila (0 a 4) según el estado de ánimo (mood).
 */
export function getRowForMood(mood: PetMood): number {
  const normalized = String(mood).trim().toLowerCase();
  switch (normalized) {
    case 'happy':
      return 0;
    case 'cheering':
      return 1;
    case 'confused':
      return 2;
    case 'sad':
      return 3;
    case 'absent':
    case 'ghost':
      return 4;
    default:
      return 0;
  }
}

/**
 * Determina si el estado corresponde a 'ghost' / 'absent',
 * cuya animación debe detenerse en el frame final (frame 3).
 */
export function isGhostMood(mood: PetMood): boolean {
  const normalized = String(mood).trim().toLowerCase();
  return normalized === 'ghost' || normalized === 'absent';
}

const DEFAULT_SPRITESHEET: ImageSourcePropType = require('../../assets/pet_sprites.png');

/**
 * Componente reutilizable PetSprite
 * Renderiza una mascota animada recortando un único spritesheet de 4 columnas x 5 filas.
 */
export const PetSprite: React.FC<PetSpriteProps> = ({
  mood,
  size = 150,
  frameDurationMs = 150,
  source = DEFAULT_SPRITESHEET,
  positioning = 'transform',
  style,
  imageStyle,
  testID = 'pet-sprite',
}) => {
  const [currentFrame, setCurrentFrame] = useState<number>(0);

  // Fila del spritesheet según el estado de ánimo
  const currentRow = getRowForMood(mood);
  const isGhost = isGhostMood(mood);

  // Control de animación con setInterval dentro de useEffect
  useEffect(() => {
    // Requisito 3: Al cambiar 'mood', reiniciar el frame a 0
    setCurrentFrame(0);

    const timer = setInterval(() => {
      setCurrentFrame((prevFrame) => {
        // Requisito 4: Excepción para 'ghost': detenerse en el último frame (frame 3)
        if (isGhost) {
          if (prevFrame >= SPRITE_GRID.COLUMNS - 1) {
            clearInterval(timer);
            return SPRITE_GRID.COLUMNS - 1; // Permanece en 3
          }
          return prevFrame + 1;
        }

        // Bucle infinito continuo para el resto de estados de ánimo (0 -> 1 -> 2 -> 3 -> 0)
        return (prevFrame + 1) % SPRITE_GRID.COLUMNS;
      });
    }, frameDurationMs);

    return () => {
      clearInterval(timer);
    };
  }, [mood, isGhost, frameDurationMs]);

  // Dimensiones totales del spritesheet escalado
  const sheetWidth = size * SPRITE_GRID.COLUMNS; // size * 4
  const sheetHeight = size * SPRITE_GRID.ROWS;    // size * 5

  // Desplazamiento según el frame y fila visible (evitamos -0 para comparaciones limpias)
  const translateX = currentFrame === 0 ? 0 : -currentFrame * size;
  const translateY = currentRow === 0 ? 0 : -currentRow * size;

  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Mascota con estado de ánimo ${mood}, frame ${currentFrame}`}
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <Image
        testID={`${testID}-image`}
        source={source}
        resizeMode="stretch"
        style={[
          styles.sheet,
          {
            width: sheetWidth,
            height: sheetHeight,
          },
          positioning === 'transform'
            ? {
                top: 0,
                left: 0,
                transform: [{ translateX }, { translateY }],
              }
            : {
                left: translateX,
                top: translateY,
              },
          imageStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
  },
});

export default PetSprite;
