import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useUserStore } from '../store/useUserStore';
import { usePetStore } from '../store/usePetStore';
import { PetState, Pet } from '../types';

// Identificador único para la notificación de inactividad de la mascota
export const PET_INACTIVITY_NOTIFICATION_ID = 'pet_inactivity_reminder';

// Umbral de recordatorio de retención de alto impacto: 48 horas (2 días) en milisegundos
export const INACTIVITY_THRESHOLD_MS = 48 * 60 * 60 * 1000;
export const INACTIVITY_REMINDER_THRESHOLD_MS = 48 * 60 * 60 * 1000;

// Umbral de marcha definitiva / pérdida irreversible: 72 horas (3 días) en milisegundos
export const INACTIVITY_TERMINAL_THRESHOLD_MS = 72 * 60 * 60 * 1000;

/**
 * Obtiene el título y cuerpo del mensaje de motivación en base al estado y vida de la mascota.
 * Mensajería ajustada a la pérdida irreversible: si la mascota fallece / se marcha,
 * se comunica expresamente que la marcha es definitiva y que requiere reinicio o adopción.
 *
 * @param pet Objeto mascota del cual evaluar su estado.
 * @returns Un objeto con el título y el cuerpo del mensaje.
 */
export function getPetMotivationMessage(pet: Pet): { title: string; body: string } {
  const name = 'Tu mascota';

  if (pet.vida === 0 || pet.estadoActual === PetState.ABSENT) {
    return {
      title: 'Ha partido definitivamente',
      body: `${name} se ha marchado para siempre debido a la prolongada inactividad. Su partida es definitiva. Inicia una nueva partida o adopción para comenzar de nuevo.`,
    };
  }

  if (pet.vida <= 25 || pet.estadoActual === PetState.SAD) {
    return {
      title: '⚠️ ¡ALERTA DEFINITIVA! Peligro inminente',
      body: `😭 ${name} está muy triste y débil (${pet.vida} HP). ¡Si alcanzas las 72 horas de inactividad se marchará para siempre y no podrá recuperarse jamás!`,
    };
  }

  if (pet.vida <= 50 || pet.estadoActual === PetState.CONFUSED) {
    return {
      title: '👀 ¿Dónde has estado?',
      body: `🤔 ${name} se siente un poco sola y confundida (${pet.vida} HP). ¡Completa tus hábitos hoy para protegerla!`,
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
 * Si la mascota está en vida 0 o estado terminal (ABSENT), cancela y omite programar.
 * 
 * @param secondsToTrigger Tiempo en segundos para disparar la notificación (defecto: 48 horas).
 */
export async function scheduleInactivityReminder(secondsToTrigger: number = 48 * 60 * 60): Promise<void> {
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
    // 3. Cancelar cualquier recordatorio anterior de inactividad para reiniciar el conteo
    await cancelInactivityReminder();

    // 4. Obtener mensaje motivador dinámico según la vida de la mascota
    const { title, body } = getPetMotivationMessage(pet);

    // 5. Configurar el trigger
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsToTrigger,
      repeats: false,
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
      `${secondsToTrigger} segundos (${(secondsToTrigger / 3600).toFixed(1)} horas). ` +
      `Estado mascota: ${pet.estadoActual} (${pet.vida} HP).`
    );
  } catch (error) {
    console.error('[InactivityService] Error al programar la notificación de inactividad:', error);
  }
}

/**
 * Función principal que debe ejecutarse cada vez que la app pase a primer plano (foreground).
 * 
 * Reglas de Dominio:
 * 1. Leer el `lastOpenedAt` previo persistido.
 * 2. Calcular la inactividad antes de sobrescribir la marca de tiempo.
 * 3. Si `inactividad >= 72h` y la mascota aún tiene `vida > 0`:
 *    - Transición terminal definitiva: `vida = 0` y `estadoActual = ABSENT`.
 *    - La mascota se marcha para siempre de forma atómica e idempotente.
 * 4. Si la mascota ya estaba en vida 0, no re-ejecutar eventos de daño ni alterar el estado.
 * 5. Si `48h <= inactividad < 72h`: se dispara únicamente aviso de retención sin alterar vida.
 * 6. Actualizar `lastOpenedAt` con la fecha y hora actual en SQLite.
 * 7. Programar o limpiar recordatorios según corresponda.
 * 
 * @param customTriggerSeconds Opcional. Segundos para el recordatorio programado.
 * @param nowTimestamp Opcional. Sobrescribe la hora actual para facilitar tests unitarios.
 */
export async function handleAppForeground(
  customTriggerSeconds?: number,
  nowTimestamp?: number
): Promise<void> {
  console.log('[InactivityService] Procesando evento de App en primer plano...');

  try {
    const userStore = useUserStore.getState();
    const petStore = usePetStore.getState();
    const user = userStore.user;
    
    if (!user) {
      console.warn('[InactivityService] No se encontró usuario en el store para procesar inactividad. Reintentando después de cargar.');
      return;
    }

    const now = nowTimestamp ?? Date.now();
    const previousLastOpenedAt = user.lastOpenedAt;

    // 1 & 2. Calcular inactividad previa antes de sobrescribir
    if (previousLastOpenedAt) {
      const elapsedMs = now - previousLastOpenedAt;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      console.log(`[InactivityService] Tiempo transcurrido desde la última apertura: ${elapsedHours.toFixed(2)} horas.`);

      // Regla: 72 horas o más -> Marcha irreversible
      if (elapsedMs >= INACTIVITY_TERMINAL_THRESHOLD_MS) {
        const pet = petStore.pet;
        if (pet && pet.vida > 0) {
          console.log('💀 [InactivityService] Inactividad >= 72 horas detectada. Transición terminal definitiva: vida = 0, ABSENT.');
          await petStore.updatePet({ vida: 0, estadoActual: PetState.ABSENT });
          await cancelInactivityReminder();
        } else {
          console.log('[InactivityService] Inactividad >= 72 horas detectada, la mascota ya se encontraba en estado terminal.');
        }
      } 
      // Regla: 48 horas a 71h 59m -> Recordatorio de retención sin modificar vida
      else if (elapsedMs >= INACTIVITY_REMINDER_THRESHOLD_MS) {
        console.log('🔔 [InactivityService] Inactividad >= 48 horas detectada: Alerta de retención de alto impacto. Vida intacta.');
      }
    } else {
      console.log('[InactivityService] Primera vez que se registra la apertura de la app.');
    }

    // 3. Actualizar lastOpenedAt con la fecha y hora actual en SQLite
    await userStore.updateLastOpenedAt();

    // 4. Programar o limpiar recordatorios
    const currentPet = usePetStore.getState().pet;
    if (!currentPet || currentPet.vida === 0 || currentPet.estadoActual === PetState.ABSENT) {
      await cancelInactivityReminder();
    } else {
      const triggerSeconds = customTriggerSeconds ?? (48 * 60 * 60);
      await scheduleInactivityReminder(triggerSeconds);
    }

  } catch (error) {
    console.error('[InactivityService] Error crítico al manejar el foreground de la app:', error);
  }
}
