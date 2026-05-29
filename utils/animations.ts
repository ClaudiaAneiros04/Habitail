import { Animated, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

// ─────────────────────────────────────────────────────────────────────────────
// Estado de accesibilidad (reduce-motion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flag que cachea la preferencia del sistema para reducir movimiento.
 * Se inicializa de forma asíncrona al cargar el módulo y se actualiza
 * reactivamente ante cambios del usuario.
 */
let _reduceMotionEnabled = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    _reduceMotionEnabled = enabled;
  })
  .catch(() => {
    // En plataformas donde no está disponible, mantenemos false.
  });

AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
  _reduceMotionEnabled = enabled;
});

// ─────────────────────────────────────────────────────────────────────────────
// Shake animation
// ─────────────────────────────────────────────────────────────────────────────

/** Amplitud del desplazamiento horizontal en puntos. */
const SHAKE_AMPLITUDE = 10;

/** Duración total de la secuencia de shake en milisegundos. */
const SHAKE_DURATION = 400;

/** Número de oscilaciones completas (ida y vuelta). */
const SHAKE_OSCILLATIONS = 3;

/**
 * Ejecuta una animación de "shake" horizontal sobre un `Animated.Value`.
 *
 * El valor animado debe usarse como `translateX` en el estilo del componente
 * que se quiere sacudir. La función NO conoce reglas de negocio: es el
 * componente consumidor quien decide cuándo invocarla.
 *
 * Acompaña la animación con un feedback háptico leve
 * (`ImpactFeedbackStyle.Light`) para reforzar la sensación táctil.
 *
 * Si `reduceMotion` está activo en el sistema operativo:
 * - Se omite la animación visual (el valor permanece en 0).
 * - El feedback háptico SÍ se ejecuta, ya que es un canal sensorial
 *   diferente que sigue siendo útil para usuarios con sensibilidad al movimiento.
 *
 * @param animatedValue - `Animated.Value` que controla el `translateX` del componente.
 *                        Se resetea automáticamente a 0 al finalizar.
 * @returns Promesa que se resuelve cuando la animación termina.
 *
 * @example
 * ```tsx
 * const shakeX = useRef(new Animated.Value(0)).current;
 *
 * const handleBlockedNavigation = () => {
 *   shakeAnimation(shakeX);
 * };
 *
 * return (
 *   <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
 *     <Button title="Guardar" onPress={handleBlockedNavigation} />
 *   </Animated.View>
 * );
 * ```
 */
export function shakeAnimation(animatedValue: Animated.Value): Promise<void> {
  // Feedback háptico: se dispara siempre (independiente de reduce-motion)
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Silenciar error en plataformas sin soporte háptico (ej. simulador, web).
  });

  // Si reduce-motion está activo, no animar visualmente
  if (_reduceMotionEnabled) {
    animatedValue.setValue(0);
    return Promise.resolve();
  }

  // Generar la secuencia de valores para las oscilaciones:
  // [+amp, -amp, +amp, -amp, ..., 0]
  // Cada segmento dura SHAKE_DURATION / (SHAKE_OSCILLATIONS * 2 + 1)
  const totalSegments = SHAKE_OSCILLATIONS * 2 + 1;
  const segmentDuration = SHAKE_DURATION / totalSegments;

  const sequence: Animated.CompositeAnimation[] = [];

  for (let i = 0; i < SHAKE_OSCILLATIONS; i++) {
    // Ida: desplazar a la derecha
    sequence.push(
      Animated.timing(animatedValue, {
        toValue: SHAKE_AMPLITUDE,
        duration: segmentDuration,
        useNativeDriver: true,
      }),
    );
    // Vuelta: desplazar a la izquierda
    sequence.push(
      Animated.timing(animatedValue, {
        toValue: -SHAKE_AMPLITUDE,
        duration: segmentDuration,
        useNativeDriver: true,
      }),
    );
  }

  // Volver al centro
  sequence.push(
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: segmentDuration,
      useNativeDriver: true,
    }),
  );

  return new Promise<void>((resolve) => {
    Animated.sequence(sequence).start(({ finished }) => {
      // Garantizar que el valor quede en 0 incluso si la animación se interrumpe
      if (!finished) {
        animatedValue.setValue(0);
      }
      resolve();
    });
  });
}
