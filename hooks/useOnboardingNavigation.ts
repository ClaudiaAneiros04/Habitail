import { useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { getOnboardingStatus, determineInitialRoute } from '../services/onboardingService';

/**
 * Interfaz de retorno para el Hook de navegación del onboarding.
 */
export interface UseOnboardingNavigationReturn {
  /**
   * Indica si la app está cargando y evaluando el estado del onboarding en el almacenamiento.
   */
  isLoading: boolean;
  /**
   * Valor booleano que refleja si el onboarding ya fue completado.
   */
  onboardingCompleted: boolean;
  /**
   * Función para realizar manualmente la verificación del estado y redirigir al usuario si es necesario.
   */
  checkAndRedirect: () => Promise<void>;
}

/**
 * Hook personalizado que implementa el control de flujo y navegación del Onboarding
 * para el enrutador de Expo Router.
 * 
 * Este hook automatiza la redirección si el usuario intenta acceder a la aplicación principal
 * sin haber completado previamente el onboarding, o viceversa (evita volver al onboarding
 * si ya ha sido completado).
 * 
 * @param {boolean} [autoRedirect=true] - Define si la redirección automática debe ocurrir al montar el hook o al cambiar de segmento.
 * @returns {UseOnboardingNavigationReturn} El estado del onboarding y funciones auxiliares de control.
 */
export const useOnboardingNavigation = (autoRedirect: boolean = true): UseOnboardingNavigationReturn => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  
  const router = useRouter();
  const segments = useSegments();

  /**
   * Evalúa el estado del onboarding desde AsyncStorage y realiza la redirección conceptual correspondiente.
   */
  const checkAndRedirect = async () => {
    setIsLoading(true);
    try {
      const completed = await getOnboardingStatus();
      setOnboardingCompleted(completed);

      if (autoRedirect) {
        // Obtener la ruta de destino adecuada en base al estado de finalización
        const targetRoute = determineInitialRoute(completed);
        
        // Identificar el segmento de ruta actual del usuario para evitar bucles infinitos de redirección
        const inOnboardingGroup = segments[0] === 'onboarding' || segments.includes('onboarding');

        if (!completed && !inOnboardingGroup) {
          // El onboarding no se ha completado y el usuario intenta acceder a la app principal: redirigir a onboarding
          console.log('[useOnboardingNavigation] Redirigiendo al flujo de Onboarding.');
          router.replace(targetRoute as any);
        } else if (completed && inOnboardingGroup) {
          // El onboarding ya está completado pero el usuario está en una pantalla de onboarding: redirigir a app principal
          console.log('[useOnboardingNavigation] Onboarding ya completado. Redirigiendo a la App Principal.');
          router.replace(targetRoute as any);
        }
      }
    } catch (error) {
      console.error('[useOnboardingNavigation] Error al ejecutar la redirección de flujo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Se ejecuta la verificación cada vez que cambian los segmentos de navegación (para proteger rutas dinámicamente)
  useEffect(() => {
    checkAndRedirect();
  }, [segments]);

  return {
    isLoading,
    onboardingCompleted,
    checkAndRedirect,
  };
};
