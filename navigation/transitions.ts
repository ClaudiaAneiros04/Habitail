import { AccessibilityInfo } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Duración estándar de las transiciones en milisegundos.
 * Suficiente para percibir el movimiento sin añadir latencia perceptible.
 */
const TRANSITION_DURATION_MS = 280;

// ─────────────────────────────────────────────────────────────────────────────
// Estado de accesibilidad (reduce-motion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flag global que cachea la preferencia del sistema para reducir movimiento.
 * Se inicializa de forma asíncrona al cargar el módulo y se actualiza
 * reactivamente ante cambios del usuario.
 *
 * Cuando está activo, todas las transiciones devuelven `animation: 'none'`
 * para cumplir con las directrices de accesibilidad.
 */
let _reduceMotionEnabled = false;

// Inicialización asíncrona al importar el módulo
AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => {
    _reduceMotionEnabled = enabled;
  })
  .catch(() => {
    // En plataformas donde no está disponible, mantenemos false.
  });

// Suscripción reactiva: si el usuario cambia la preferencia en caliente
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
  _reduceMotionEnabled = enabled;
});

// ─────────────────────────────────────────────────────────────────────────────
// Variantes de transición
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transición de deslizamiento desde la derecha.
 *
 * Uso recomendado: navegación hacia pantallas de detalle dentro del mismo
 * flujo jerárquico (HabitDetail, ShopItem, HabitLibrary).
 *
 * Utiliza la animación nativa `slide_from_right` de react-native-screens,
 * que es la transición estándar de iOS y material-motion en Android.
 * Si `reduceMotion` está activo, devuelve `animation: 'none'`.
 *
 * @returns Opciones parciales de NativeStackNavigationOptions.
 */
export function slideFromRight(): NativeStackNavigationOptions {
  if (_reduceMotionEnabled) {
    return { animation: 'none' };
  }

  return {
    animation: 'slide_from_right',
    animationDuration: TRANSITION_DURATION_MS,
  };
}

/**
 * Transición de fade + escala ligera.
 *
 * Uso recomendado: pantallas modales o flujos que no representan un drill-down
 * jerárquico (formularios de creación, onboarding, permisos).
 *
 * Utiliza la animación nativa `fade_from_bottom` de react-native-screens,
 * que combina un fade con un desplazamiento vertical sutil, emulando
 * el patrón de "modal sheet" de las plataformas nativas.
 * Si `reduceMotion` está activo, devuelve `animation: 'none'`.
 *
 * @returns Opciones parciales de NativeStackNavigationOptions.
 */
export function fadeScale(): NativeStackNavigationOptions {
  if (_reduceMotionEnabled) {
    return { animation: 'none' };
  }

  return {
    animation: 'fade_from_bottom',
    animationDuration: TRANSITION_DURATION_MS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets por tipo de stack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preset para stacks de tipo "detail" (drill-down jerárquico).
 * Aplica `slideFromRight` como `screenOptions` por defecto del Stack.
 *
 * Ejemplo de uso:
 * ```tsx
 * <Stack screenOptions={detailStackPreset()}>
 *   <Stack.Screen name="habit/[id]" />
 * </Stack>
 * ```
 */
export function detailStackPreset(): NativeStackNavigationOptions {
  return {
    ...slideFromRight(),
    headerShown: false,
  };
}

/**
 * Preset para stacks de tipo "modal" (formularios, onboarding).
 * Aplica `fadeScale` como `screenOptions` por defecto del Stack.
 *
 * Ejemplo de uso:
 * ```tsx
 * <Stack screenOptions={modalStackPreset()}>
 *   <Stack.Screen name="add-habit/basic-info" />
 * </Stack>
 * ```
 */
export function modalStackPreset(): NativeStackNavigationOptions {
  return {
    ...fadeScale(),
    headerShown: false,
  };
}
