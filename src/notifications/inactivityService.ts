import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useUserStore } from '../../store/useUserStore';
import { usePetStore } from '../../store/usePetStore';
import { PetState, Pet } from '../../types';

// Identificador único para la notificación de inactividad de la mascota
export const PET_INACTIVITY_NOTIFICATION_ID = 'pet_inactivity_reminder';

// Umbral de inactividad por defecto: 2 días (48 horas) en milisegundos
export const INACTIVITY_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * Obtiene el título y cuerpo del mensaje de motivación en base al estado y vida de la mascota.
 * 
 * @param pet Objeto mascota del cual evaluar su estado.
 * @returns Un objeto con el título y el cuerpo del mensaje.
 */
export function getPetMotivationMessage(pet: Pet): { title: string; body: string } {
  const name = 'Tu mascota'; // Alias amigable si no hay un nombre específico en el modelo

  if (pet.vida === 0 || pet.estadoActual === PetState.ABSENT) {
    return {
      title: '¡Oh no!',
      body: `${name} se ha marchado debido a la inactividad. Vuelve para iniciar una nueva aventura.`,
    };
  }

  if (pet.vida <= 25 || pet.estadoActual === PetState.SAD) {
    return {
      title: '⚠️ ¡ALERTA! Tu mascota te necesita urgente',
      body: `😭 ${name} está muy triste y débil (${pet.vida} HP). ¡Si no vuelves a Habitail hoy, podría marcharse para siempre!`,
    };
  }

  if (pet.vida <= 50 || pet.estadoActual === PetState.CONFUSED) {
    return {
      title: '👀 ¿Dónde has estado?',
      body: `🤔 ${name} se siente un poco sola y confundida (${pet.vida} HP). ¡Completa tus hábitos hoy para subir su ánimo!`,
    };
  }

  if (pet.vida <= 75 || pet.estadoActual === PetState.CHEERING) {
    return {
      title: '💪 ¡No te rindas ahora!',
      body: `😊 ${name} te extraña un poco, pero mantiene el ánimo (${pet.vida} HP). ¡Vuelve a registrar tus hábitos de hoy!`,
    };
  }

  // HAPPY (vida > 75)
  return {
    title: '❤️ ¡Tu mascota te está esperando!',
    body: `🌟 ${name} está súper feliz y saludable (${pet.vida} HP). ¡Vuelve y mantén esa racha de hábitos ganadora!`,
  };
}

/**
 * Cancela cualquier recordatorio de inactividad de mascota programado anteriormente.
 */
export async function cancelInactivityReminder(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(PET_INACTIVITY_NOTIFICATION_ID);
    console.log('[InactivityService] Notificación de inactividad previa cancelada.');
  } catch (error) {
    console.error('[InactivityService] Error al cancelar la notificación de inactividad:', error);
  }
}

/**
 * Programa una notificación especial de retención de mascota que se disparará
 * tras un período de inactividad (48 horas por defecto).
 * 
 * @param secondsSecondsToTrigger Tiempo en segundos para disparar la notificación (defecto: 48 horas).
 */
export async function scheduleInactivityReminder(secondsSecondsToTrigger: number = 48 * 60 * 60): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[InactivityService] Notificaciones nativas no soportadas en web. Omitiendo programación de inactividad.');
    return;
  }

  // 1. Obtener el estado actual de la mascota
  const pet = usePetStore.getState().pet;
  if (!pet) {
    console.log('[InactivityService] No se encontró ninguna mascota cargada. Omitiendo programación.');
    return;
  }

  // 2. CONTROL DE ESTADO: Si la vida de la mascota es 0 (ABSENT), NO programamos nada
  if (pet.vida === 0 || pet.estadoActual === PetState.ABSENT) {
    console.log('[InactivityService] Restricción: La vida de la mascota es 0. Se cancela y omite programar la notificación.');
    await cancelInactivityReminder();
    return;
  }

  try {
    // 3. Cancelar cualquier recordatorio anterior de inactividad para asegurar que se reinicie el cronómetro
    // y mantener estrictamente el límite de 1 notificación máxima cada 48 horas.
    await cancelInactivityReminder();

    // 4. Obtener mensaje motivador dinámico según la vida de la mascota
    const { title, body } = getPetMotivationMessage(pet);

    // 5. Configurar el trigger en base a intervalos de tiempo
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsSecondsToTrigger,
      repeats: false, // Disparar una única vez tras el periodo
    };

    // 6. Programar la nueva notificación
    await Notifications.scheduleNotificationAsync({
      identifier: PET_INACTIVITY_NOTIFICATION_ID,
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'pet_inactivity',
          petId: pet.id,
          petVida: pet.vida,
        },
      },
      trigger,
    });

    console.log(
      `[InactivityService] Notificación de mascota programada con éxito para dentro de ` +
      `${secondsSecondsToTrigger} segundos (${(secondsSecondsToTrigger / 3600).toFixed(1)} horas). ` +
      `Estado mascota: ${pet.estadoActual} (${pet.vida} HP).`
    );
  } catch (error) {
    console.error('[InactivityService] Error al programar la notificación de inactividad:', error);
  }
}

/**
 * Función principal que debe ejecutarse cada vez que la app pase a primer plano (foreground).
 * 
 * 1. Lee la propiedad `lastOpenedAt` actual para evaluar inactividad pasada.
 * 2. Actualiza `lastOpenedAt` con el timestamp de apertura actual.
 * 3. Gestiona y reinicia el ciclo de recordatorios de inactividad.
 * 
 * @param customTriggerSeconds Opcional. Permite sobreescribir las 48 horas por un número
 *                             de segundos menor para facilitar pruebas y desarrollo.
 */
export async function handleAppForeground(customTriggerSeconds?: number): Promise<void> {
  console.log('[InactivityService] Procesando evento de App en primer plano...');

  try {
    // 1. Obtener datos de usuario y mascota
    const userStore = useUserStore.getState();
    const user = userStore.user;
    
    if (!user) {
      console.warn('[InactivityService] No se encontró usuario en el store para procesar inactividad. Reintentando después de cargar.');
      return;
    }

    const now = Date.now();
    const previousLastOpenedAt = user.lastOpenedAt;

    // 2. Verificar si ya se cumplieron 2 días (48 horas) de inactividad
    if (previousLastOpenedAt) {
      const elapsedMs = now - previousLastOpenedAt;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      console.log(`[InactivityService] Tiempo transcurrido desde la última apertura: ${elapsedHours.toFixed(2)} horas.`);

      if (elapsedMs >= INACTIVITY_THRESHOLD_MS) {
        console.log('🔔 [InactivityService] ¡El usuario ha estado inactivo más de 48 horas!');
        // Aquí se podría guardar alguna métrica, reiniciar racha general de la app, etc.
      }
    } else {
      console.log('[InactivityService] Primera vez que se registra la apertura de la app.');
    }

    // 3. ACTUALIZACIÓN: Guardar la hora de apertura actual
    await userStore.updateLastOpenedAt();

    // 4. PROGRAMACIÓN: Cancelar anterior y programar nueva alerta de inactividad
    // Si la mascota tiene vida > 0 se programa para dentro de 48 horas (o customTriggerSeconds)
    const triggerSeconds = customTriggerSeconds ?? (48 * 60 * 60);
    await scheduleInactivityReminder(triggerSeconds);

  } catch (error) {
    console.error('[InactivityService] Error crítico al manejar el foreground de la app:', error);
  }
}
