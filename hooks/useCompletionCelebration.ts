import { useState, useEffect, useRef, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import { formatDateDB } from '../utils/dateUtils';

/**
 * Parámetros que el hook necesita del contexto de HomeScreen.
 * @property completedCount - Número de hábitos completados hoy.
 * @property totalCount     - Número total de hábitos programados para hoy.
 * @property selectedDate   - Fecha actualmente seleccionada en la UI.
 */
interface CompletionCelebrationParams {
  completedCount: number;
  totalCount: number;
  selectedDate: Date;
}

/**
 * Valor devuelto por el hook.
 * @property shouldFire            - true cuando la animación de confetti debe dispararse.
 * @property isReduceMotion        - true si el usuario tiene activada la opción de reducir movimiento.
 * @property onCelebrationComplete - Callback para que el componente de confetti notifique que terminó.
 */
interface CompletionCelebrationReturn {
  shouldFire: boolean;
  isReduceMotion: boolean;
  onCelebrationComplete: () => void;
}

/**
 * Hook que orquesta la celebración de confetti al completar todos los hábitos del día.
 *
 * Reglas de disparo:
 * - Solo dispara cuando `completedCount === totalCount` y `totalCount > 0`.
 * - Solo dispara si la fecha seleccionada es HOY (no en días pasados).
 * - Se dispara una única vez por día calendario: si el usuario desmarca y re-marca
 *   el último hábito, NO vuelve a dispararse.
 * - Respeta `AccessibilityInfo.isReduceMotionEnabled()` y expone el flag para
 *   que el componente visual adapte su comportamiento.
 *
 * @param params - Contadores de progreso y fecha seleccionada.
 * @returns Estado de disparo, flag de accesibilidad y callback de finalización.
 */
export function useCompletionCelebration({
  completedCount,
  totalCount,
  selectedDate,
}: CompletionCelebrationParams): CompletionCelebrationReturn {
  // Fecha (YYYY-MM-DD) del último día en que ya se celebró, para evitar re-disparos.
  const celebratedDateRef = useRef<string | null>(null);

  // Flag que indica al componente ConfettiOverlay que debe animarse.
  const [shouldFire, setShouldFire] = useState(false);

  // Preferencia de accesibilidad: reducir movimiento.
  const [isReduceMotion, setIsReduceMotion] = useState(false);

  // ── Accesibilidad ──
  // Consultar la preferencia al montar y suscribirse a cambios.
  useEffect(() => {
    const checkReduceMotion = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        setIsReduceMotion(enabled);
      } catch {
        // En plataformas donde no está disponible, asumir false.
        setIsReduceMotion(false);
      }
    };

    checkReduceMotion();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => setIsReduceMotion(enabled),
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // ── Lógica de disparo ──
  useEffect(() => {
    const todayStr = formatDateDB(new Date());
    const selectedStr = formatDateDB(selectedDate);

    // Solo evaluar para el día de hoy (no días pasados ni futuros).
    if (selectedStr !== todayStr) return;

    // Condición de completitud: todos completados y hay al menos uno.
    const allCompleted = completedCount === totalCount && totalCount > 0;

    // Si ya celebramos hoy, no volver a disparar.
    if (allCompleted && celebratedDateRef.current !== todayStr) {
      celebratedDateRef.current = todayStr;
      setShouldFire(true);
    }
  }, [completedCount, totalCount, selectedDate]);

  /**
   * Callback que el componente de confetti invoca al terminar la animación,
   * permitiendo limpiar el estado de disparo.
   */
  const onCelebrationComplete = useCallback(() => {
    setShouldFire(false);
  }, []);

  return { shouldFire, isReduceMotion, onCelebrationComplete };
}
