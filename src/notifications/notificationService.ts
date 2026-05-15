import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useLogStore } from '../../store/useLogStore';
import { usePetStore } from '../../store/usePetStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useUserStore } from '../../store/useUserStore';
import { useStatsStore } from '../../store/useStatsStore';
import { calcPointsDelta } from '../../utils/pointsEngine';
import { evaluateBadges } from '../../utils/badgeEngine';
import { generateLogId, formatDateDB } from '../../utils/dateUtils';
import { HabitLog } from '../../types';

// ============================================================================
// Constants
// ============================================================================
export const HABIT_REMINDER_CATEGORY = 'HABIT_REMINDER';
export const ACTION_DONE = 'DONE';
export const ACTION_SNOOZE = 'SNOOZE';

// ============================================================================
// Types
// ============================================================================
export interface HabitNotificationData {
  habitId: string;
  snoozeCount?: number;
  [key: string]: unknown;
}

// ============================================================================
// Notification Handler Setup
// ============================================================================

/**
 * Configura cómo se comportan las notificaciones cuando la aplicación
 * está en primer plano (foreground).
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ============================================================================
// Categories Registration
// ============================================================================

/**
 * Registra las categorías de notificaciones interactivas.
 * Debe llamarse tempranamente en el ciclo de vida de la app (ej: App.tsx).
 */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Notificaciones nativas no soportadas en web. Omitiendo registro de categorías.');
    return;
  }

  await Notifications.setNotificationCategoryAsync(HABIT_REMINDER_CATEGORY, [
    {
      identifier: ACTION_DONE,
      buttonTitle: 'Hecho',
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
        // Permite que la acción se ejecute en segundo plano sin abrir la app
        opensAppToForeground: false, 
      },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Posponer',
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
        // Permite que la acción se ejecute en segundo plano sin abrir la app
        opensAppToForeground: false, 
      },
    },
  ]);
  console.log('[NotificationService] Categorías registradas correctamente.');
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Maneja la acción "DONE" (Hecho).
 * Se encarga de marcar el hábito como completado.
 * 
 * @param habitId ID del hábito a completar.
 */
async function handleDoneAction(habitId: string): Promise<void> {
  console.log(`[NotificationService] Marcando hábito ${habitId} como completado...`);
  
  try {
    const today = new Date();
    const dateStr = formatDateDB(today);
    
    // 1. Obtener estado actual
    const user = useUserStore.getState().user;
    const habits = useHabitStore.getState().habits;
    const { logs, addLog } = useLogStore.getState();
    const { updateHealth } = usePetStore.getState();
    const { updatePoints, addBadges } = useUserStore.getState();
    
    const logId = generateLogId(habitId, today);
    
    // Verificar si ya está completado
    const existingLog = logs.find(l => l.habitId === habitId && (l.fecha === dateStr || l.fecha.startsWith(dateStr)));
    if (existingLog && existingLog.completado) {
      console.log(`[NotificationService] El hábito ${habitId} ya estaba completado hoy.`);
      return;
    }

    // 2. Crear log
    const newLog: HabitLog = {
      id: logId,
      habitId,
      userId: user?.id || 'default-user',
      fecha: dateStr,
      completado: true,
      timestampRegistro: new Date().toISOString()
    };

    // 3. Persistir y aplicar gamificación
    await addLog(newLog);
    await updateHealth(10);
    
    const habit = habits.find(h => h.id === habitId);
    if (habit) {
      const points = calcPointsDelta(habit);
      await updatePoints(points);
      
      if (user) {
        const allLogs = [...logs, newLog];
        const newEarnedBadges = evaluateBadges(user as any, habits, allLogs);
        if (newEarnedBadges.length > 0) {
          await addBadges(newEarnedBadges);
        }
      }
    }
    
    useStatsStore.getState().clearAll();
    console.log(`[NotificationService] Hábito ${habitId} marcado con éxito.`);
  } catch (error) {
    console.error(`[NotificationService] Error al completar hábito ${habitId}:`, error);
  }
}

/**
 * Maneja la acción "SNOOZE" (Posponer).
 * Reprograma la notificación para 30 minutos después, limitado a 1 vez por día.
 * 
 * @param habitId ID del hábito a posponer.
 * @param currentSnoozeCount Número de veces que ya se ha pospuesto hoy.
 * @param originalContent El contenido original de la notificación.
 */
async function handleSnoozeAction(
  habitId: string, 
  currentSnoozeCount: number,
  originalContent: Notifications.NotificationContent
): Promise<void> {
  console.log(`[NotificationService] Pospiniendo hábito ${habitId}. Contador actual: ${currentSnoozeCount}`);

  // Limitar a 1 'snooze' por día
  if (currentSnoozeCount >= 1) {
    console.log(`[NotificationService] El hábito ${habitId} ya fue pospuesto hoy. Se ignora la acción.`);
    return;
  }

  try {
    const nextSnoozeCount = currentSnoozeCount + 1;
    
    // Configurar el disparador para dentro de 30 minutos (1800 segundos)
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 60,
      repeats: false,
    };

    // Reprogramamos la notificación reutilizando el título y cuerpo originales
    await Notifications.scheduleNotificationAsync({
      content: {
        title: originalContent.title || 'Recordatorio Pospuesto',
        body: originalContent.body || 'Es hora de completar tu hábito.',
        categoryIdentifier: HABIT_REMINDER_CATEGORY,
        data: {
          ...originalContent.data,
          habitId: habitId,
          snoozeCount: nextSnoozeCount,
        } as HabitNotificationData,
      },
      trigger,
    });

    console.log(`[NotificationService] Hábito ${habitId} pospuesto exitosamente por 30 minutos.`);
  } catch (error) {
    console.error(`[NotificationService] Error al posponer hábito ${habitId}:`, error);
  }
}

// ============================================================================
// Listeners Registration
// ============================================================================

/**
 * Configura los listeners para detectar las respuestas a las notificaciones.
 * Esto captura cuando el usuario toca la notificación principal o uno de los botones de acción.
 * 
 * @returns Una función de limpieza para remover el listener cuando el componente se desmonte.
 */
export function setupNotificationListeners(): () => void {
  if (Platform.OS === 'web') {
    return () => {}; // No-op en web
  }

  const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const actionIdentifier = response.actionIdentifier;
    const notificationData = response.notification.request.content.data as unknown as HabitNotificationData;
    const habitId = notificationData?.habitId;
    
    if (!habitId) {
      console.warn('[NotificationService] Acción recibida pero no se encontró un habitId en los datos.');
      return;
    }

    // Delegamos la lógica dependiendo de la acción presionada
    if (actionIdentifier === ACTION_DONE) {
      await handleDoneAction(habitId);
    } 
    else if (actionIdentifier === ACTION_SNOOZE) {
      const snoozeCount = notificationData.snoozeCount || 0;
      await handleSnoozeAction(habitId, snoozeCount, response.notification.request.content);
    } 
    else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // El usuario tocó la notificación directamente en lugar de los botones
      // TODO: Manejar la navegación a la pantalla de detalle del hábito
      console.log(`[NotificationService] Usuario tocó la notificación del hábito ${habitId}.`);
    }
  });

  // Retornamos la función de limpieza
  return () => {
    responseListener.remove();
  };
}
