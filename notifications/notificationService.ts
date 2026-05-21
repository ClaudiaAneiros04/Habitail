import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLogStore } from '../store/useLogStore';
import { usePetStore } from '../store/usePetStore';
import { useHabitStore } from '../store/useHabitStore';
import { useUserStore } from '../store/useUserStore';
import { useStatsStore } from '../store/useStatsStore';
import { calcPointsDelta } from '../utils/pointsEngine';
import { evaluateBadges } from '../utils/badgeEngine';
import { generateLogId, formatDateDB } from '../utils/dateUtils';
import { HabitLog, Habit } from '../types';
import { initDb } from '../storage/database';
import { LogRepository } from '../storage/LogRepository';

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
    
    // Asegurar que la base de datos está inicializada
    await initDb();
    
    // Cargar y sincronizar stores en background (Zustand context limpio en Headless JS)
    await useUserStore.getState().loadUser();
    await usePetStore.getState().loadPet();
    await useHabitStore.getState().loadHabits();
    
    // 1. Obtener estado actual hidratado
    const user = useUserStore.getState().user;
    const habits = useHabitStore.getState().habits;
    const { addLog, getLogsForDay } = useLogStore.getState();
    const { updateHealth } = usePetStore.getState();
    const { updatePoints, addBadges } = useUserStore.getState();
    
    const logId = generateLogId(habitId, today);
    
    // Consultar logs del día directamente de la base de datos
    const dayLogs = await getLogsForDay(dateStr);
    const existingLog = dayLogs.find(l => l.habitId === habitId && l.completado);
    if (existingLog) {
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
      
      const updatedUser = useUserStore.getState().user;
      if (updatedUser) {
        // Cargar todo el historial para la evaluación de insignias
        const allLogs = await new LogRepository().getAll();
        // Asegurarse de incluir el log que acabamos de guardar (en caso de desfase en la lectura)
        if (!allLogs.some(l => l.id === newLog.id)) {
          allLogs.push(newLog);
        }
        const newEarnedBadges = evaluateBadges(updatedUser as any, habits, allLogs);
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
 * Configura los listeners para detectar las respuestas y recepción de las notificaciones.
 * Esto captura cuando el usuario recibe una notificación en primer plano o interactúa con ella.
 * 
 * @returns Una función de limpieza para remover los listeners cuando el componente se desmonte.
 */
export function setupNotificationListeners(): () => void {
  if (Platform.OS === 'web') {
    return () => {}; // No-op en web
  }

  // Listener para capturar interacciones (cuando el usuario presiona botones o la notificación principal)
  const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const actionIdentifier = response.actionIdentifier;
    const notificationData = response.notification.request.content.data as unknown as HabitNotificationData;
    const habitId = notificationData?.habitId;
    
    if (!habitId) {
      console.warn('[NotificationService] Acción recibida pero no se encontró un habitId en los datos.');
      return;
    }

    // Registramos que se mostró/interactuó con la notificación hoy para cumplir la Regla de Oro
    const todayStr = formatDateDB(new Date());
    await AsyncStorage.setItem(`notification_last_sent_${habitId}`, todayStr);

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

  // Listener para capturar notificaciones recibidas en primer plano (foreground)
  const receivedListener = Notifications.addNotificationReceivedListener(async (notification) => {
    const notificationData = notification.request.content.data as unknown as HabitNotificationData;
    const habitId = notificationData?.habitId;
    if (habitId) {
      const todayStr = formatDateDB(new Date());
      await AsyncStorage.setItem(`notification_last_sent_${habitId}`, todayStr);
      console.log(`[NotificationService] Notificación recibida en primer plano para el hábito ${habitId}. Guardada fecha: ${todayStr}`);
    }
  });

  // Retornamos la función de limpieza
  return () => {
    responseListener.remove();
    receivedListener.remove();
  };
}

// ============================================================================
// Notification Scheduling and Management
// ============================================================================

/**
 * Programa una notificación diaria para un hábito específico a la hora establecida en su configuración.
 * Aplica la "Regla de Oro": no se envía ni se programa para hoy si el hábito ya fue completado
 * hoy o si ya se envió una notificación para este hábito en el día actual. En esos casos,
 * se programa para iniciar el día de mañana de forma segura.
 * 
 * @param habit Objeto hábito que contiene la configuración del recordatorio.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Notificaciones nativas no soportadas en web. Omitiendo programación.');
    return;
  }

  // Obtenemos la hora de recordatorio (admite el campo en español o el alias en inglés)
  const reminderTime = habit.horaRecordatorio || habit.reminderTime;

  if (!habit.activo) {
    console.log(`[NotificationService] El hábito "${habit.nombre || habit.name}" está inactivo. Omitiendo recordatorio.`);
    return;
  }

  if (!reminderTime) {
    console.log(`[NotificationService] El hábito "${habit.nombre || habit.name}" no tiene hora de recordatorio. Omitiendo.`);
    return;
  }

  try {
    const [hourStr, minuteStr] = reminderTime.split(':');
    const hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);

    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`[NotificationService] Formato de hora de recordatorio inválido ("${reminderTime}") para el hábito ${habit.id}.`);
      return;
    }

    const todayStr = formatDateDB(new Date());

    // 1. REGLA DE ORO - Validación A: ¿Ya se completó el hábito hoy?
    // Buscamos en el almacén de logs global y también en el campo opcional completedDays.
    const logs = useLogStore.getState().logs;
    const isCompletedTodayInLogs = logs.some(
      (log) => log.habitId === habit.id && log.fecha === todayStr && log.completado
    );
    const isCompletedTodayInProps = habit.completedDays?.includes(todayStr) || false;
    const isAlreadyCompletedToday = isCompletedTodayInLogs || isCompletedTodayInProps;

    // 2. REGLA DE ORO - Validación B: ¿Ya se envió la notificación hoy?
    const lastSentKey = `notification_last_sent_${habit.id}`;
    const lastSentDate = await AsyncStorage.getItem(lastSentKey);
    const isAlreadySentToday = lastSentDate === todayStr;

    // Cancelamos cualquier notificación previa para este hábito para evitar duplicados
    await cancelHabitReminder(habit.id);

    if (isAlreadyCompletedToday || isAlreadySentToday) {
      console.log(
        `[NotificationService] REGLA DE ORO: Saltando recordatorio de hoy para el hábito "${habit.nombre || habit.name}". ` +
        `Motivo: Completado hoy = ${isAlreadyCompletedToday}, Notificado hoy = ${isAlreadySentToday}.`
      );

      // Si ya se cumplió la regla de oro para hoy, programamos un disparador único para MAÑANA a la misma hora.
      // De esta forma, aseguramos que la primera notificación real le llegue mañana sin molestar hoy.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hours, minutes, 0, 0);

      await Notifications.scheduleNotificationAsync({
        identifier: habit.id,
        content: {
          title: '¡Hora de tu hábito!',
          body: `No olvides realizar tu hábito hoy: ${habit.nombre || habit.name}`,
          categoryIdentifier: HABIT_REMINDER_CATEGORY,
          data: { habitId: habit.id } as HabitNotificationData,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: tomorrow,
        },
      });

      console.log(`[NotificationService] Recordatorio programado para mañana (${tomorrow.toLocaleString()}) para el hábito: ${habit.id}`);
    } else {
      // Programamos una notificación recurrente diaria normal
      await Notifications.scheduleNotificationAsync({
        identifier: habit.id,
        content: {
          title: '¡Hora de tu hábito!',
          body: `Es momento de realizar tu hábito: ${habit.nombre || habit.name}`,
          categoryIdentifier: HABIT_REMINDER_CATEGORY,
          data: { habitId: habit.id } as HabitNotificationData,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

      console.log(`[NotificationService] Recordatorio diario programado con éxito a las ${reminderTime} para el hábito: ${habit.id}`);
    }
  } catch (error) {
    console.error(`[NotificationService] Error al programar recordatorio para el hábito ${habit.id}:`, error);
  }
}

/**
 * Elimina la notificación programada de un hábito específico usando su identificador.
 * 
 * @param habitId ID del hábito cuyo recordatorio se desea cancelar.
 */
export async function cancelHabitReminder(habitId: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Cancelar recordatorio no soportado en web.');
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(habitId);
    console.log(`[NotificationService] Recordatorio cancelado con éxito para el hábito: ${habitId}`);
  } catch (error) {
    console.error(`[NotificationService] Error al cancelar recordatorio para el hábito ${habitId}:`, error);
  }
}

/**
 * Cancela todas las notificaciones activas y vuelve a programarlas.
 * Útil para cuando el usuario edita sus hábitos globales o inicia la aplicación.
 * 
 * @param habits Lista de todos los hábitos a reprogramar.
 */
export async function rescheduleAll(habits: Habit[]): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Reprogramación no soportada en web.');
    return;
  }

  console.log('[NotificationService] Iniciando reprogramación masiva de recordatorios...');
  try {
    // 1. Cancelamos absolutamente todas las notificaciones programadas
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationService] Todas las notificaciones programadas han sido canceladas.');

    // 2. Volvemos a programar recordatorios para cada hábito activo
    for (const habit of habits) {
      if (habit.activo) {
        await scheduleHabitReminder(habit);
      }
    }
    console.log('[NotificationService] Reprogramación masiva finalizada con éxito.');
  } catch (error) {
    console.error('[NotificationService] Error durante la reprogramación masiva:', error);
  }
}
