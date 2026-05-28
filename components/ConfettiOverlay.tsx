import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Dimensions,
  Easing,
} from 'react-native';
import { Colors } from '../constants/colors';

/**
 * Paleta de colores para las partículas de confetti.
 * Usa los colores del design system de la app para coherencia visual.
 */
const CONFETTI_COLORS = [
  Colors.primary,    // Indigo
  Colors.secondary,  // Violet
  Colors.accent,     // Rose
  Colors.success,    // Emerald
  Colors.warning,    // Amber
  '#f472b6',         // Pink 400
  '#38bdf8',         // Sky 400
  '#a78bfa',         // Violet 400
];

/** Número de partículas de confetti a generar. */
const PARTICLE_COUNT = 40;

/** Duración base de la animación de caída en milisegundos. */
const BASE_DURATION = 2800;

/** Formas disponibles para las partículas. */
type ParticleShape = 'square' | 'rectangle' | 'circle';
const SHAPES: ParticleShape[] = ['square', 'rectangle', 'circle'];

/**
 * Propiedades precalculadas de una partícula de confetti.
 * Se generan al montar para evitar cálculos en cada frame.
 */
interface ParticleData {
  id: number;
  color: string;
  shape: ParticleShape;
  size: number;
  startX: number;
  /** Desplazamiento horizontal máximo durante la oscilación lateral. */
  swayAmplitude: number;
  /** Velocidad relativa de caída (multiplicador sobre la duración base). */
  speedFactor: number;
  /** Retraso en ms antes de que la partícula empiece a caer. */
  delay: number;
}

/**
 * Props del componente ConfettiOverlay.
 * @property visible        - Cuando pasa a true, se dispara la animación.
 * @property isReduceMotion - Si true, muestra una alternativa estática accesible.
 * @property onComplete     - Callback al finalizar toda la animación.
 */
interface ConfettiOverlayProps {
  visible: boolean;
  isReduceMotion: boolean;
  onComplete: () => void;
}

/**
 * Genera los datos aleatorios de una partícula.
 * @param id            - Índice de la partícula.
 * @param screenWidth   - Ancho de la pantalla para posicionar horizontalmente.
 */
function generateParticle(id: number, screenWidth: number): ParticleData {
  return {
    id,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    size: 6 + Math.random() * 8,         // 6–14 pt
    startX: Math.random() * screenWidth,
    swayAmplitude: 20 + Math.random() * 40, // 20–60 pt de oscilación
    speedFactor: 0.7 + Math.random() * 0.6, // 0.7x–1.3x de la duración base
    delay: Math.random() * 400,              // 0–400 ms de retraso escalonado
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente interno: partícula individual animada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza y anima una sola partícula de confetti.
 * Cada partícula tiene su propio Animated.Value para caída, rotación,
 * oscilación lateral y opacidad, ejecutándose de forma independiente.
 */
function ConfettiParticle({
  data,
  screenHeight,
  onFinish,
}: {
  data: ParticleData;
  screenHeight: number;
  onFinish: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = BASE_DURATION * data.speedFactor;

    Animated.sequence([
      // Retraso escalonado para que no salgan todas a la vez
      Animated.delay(data.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.in(Easing.quad), // Aceleración progresiva (gravedad)
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  // Traslación vertical: de -20 (fuera de pantalla arriba) a screenHeight + 20
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, screenHeight + 20],
  });

  // Oscilación lateral sinusoidal (3 ciclos completos durante la caída)
  const translateX = progress.interpolate({
    inputRange: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
    outputRange: [
      0,
      data.swayAmplitude,
      0,
      -data.swayAmplitude,
      0,
      data.swayAmplitude * 0.5,
      0,
    ],
  });

  // Rotación continua: 0 a ~720° (2 vueltas completas)
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${720 + Math.random() * 360}deg`],
  });

  // Opacidad: totalmente visible hasta el 70%, luego fade out
  const opacity = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  // Forma de la partícula
  const shapeStyle = (() => {
    switch (data.shape) {
      case 'circle':
        return {
          width: data.size,
          height: data.size,
          borderRadius: data.size / 2,
        };
      case 'rectangle':
        return {
          width: data.size * 0.5,
          height: data.size * 1.4,
          borderRadius: 1,
        };
      case 'square':
      default:
        return {
          width: data.size,
          height: data.size,
          borderRadius: 2,
        };
    }
  })();

  return (
    <Animated.View
      style={[
        styles.particle,
        shapeStyle,
        {
          backgroundColor: data.color,
          left: data.startX,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal: ConfettiOverlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overlay de confetti a pantalla completa.
 *
 * - Cuando `visible` pasa a true, genera partículas y las anima cayendo.
 * - `pointerEvents="none"` para no bloquear interacciones del usuario.
 * - Si `isReduceMotion` es true, muestra un banner estático con emoji 🎉
 *   durante 2.5 segundos en lugar de partículas animadas.
 * - Llama a `onComplete` al finalizar la animación o el timeout del banner.
 */
export default function ConfettiOverlay({ visible, isReduceMotion, onComplete }: ConfettiOverlayProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const finishedCount = useRef(0);
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  /**
   * Llamado por cada partícula cuando termina su animación.
   * Cuando todas han terminado, limpia el estado y notifica al padre.
   */
  const handleParticleFinish = useCallback(() => {
    finishedCount.current += 1;
    if (finishedCount.current >= PARTICLE_COUNT) {
      setParticles([]);
      finishedCount.current = 0;
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    if (!visible) return;

    if (isReduceMotion) {
      // Alternativa accesible: banner estático con fade in/out suave
      bannerOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onComplete());
    } else {
      // Generar partículas con datos aleatorios
      finishedCount.current = 0;
      const newParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) =>
        generateParticle(i, screenWidth),
      );
      setParticles(newParticles);
    }
  }, [visible]);

  // Si no hay nada que mostrar, no renderizar nada
  if (!visible && particles.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Modo reduce-motion: banner de felicitación */}
      {isReduceMotion && visible && (
        <Animated.View style={[styles.reducedMotionBanner, { opacity: bannerOpacity }]}>
          <Text style={styles.reducedMotionEmoji}>🎉</Text>
          <Text style={styles.reducedMotionText}>¡Todos completados!</Text>
        </Animated.View>
      )}

      {/* Modo normal: partículas de confetti */}
      {!isReduceMotion &&
        particles.map((p) => (
          <ConfettiParticle
            key={p.id}
            data={p}
            screenHeight={screenHeight}
            onFinish={handleParticleFinish}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
  reducedMotionBanner: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  reducedMotionEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  reducedMotionText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});
