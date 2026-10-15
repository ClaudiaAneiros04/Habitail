import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHabitStore } from '../store/useHabitStore';
import { useUserStore } from '../store/useUserStore';
import { useLogStore } from '../store/useLogStore';
import { 
  toLogicalDate, 
  getLogicalToday, 
  getDayOfWeek, 
  getDaysInMonth, 
  addDaysToLogicalDate, 
  formatDateDB 
} from '../utils/dateUtils';
import { isHabitExpectedOnDate } from '../utils/frequencyEngine';
import { Habit, Frequency } from '../types';
import { getDb, initDb } from '../storage/database';
import { habitCompletionService } from '../services/HabitCompletionService';
import { parseSqliteBoolean } from '../utils/booleanUtils';
import i18n from '../i18n';

// ============================================================================
// Constants
// ============================================================================
export const HABIT_REMINDER_CATEGORY = 'HABIT_REMINDER';
export const ACTION_DONE = 'DONE';
export const ACTION_SNOOZE = 'SNOOZE';
export const SNOOZE_STORAGE_PREFIX = 'habit_snooze_count_';

// ============================================================================
// Types
// ============================================================================
export interface HabitNotificationData {
  habitId: string;
  habitName?: string;
  snoozeCount?: number;
  snoozeDate?: string;
  weekday?: number;
  day?: number;
  targetDate?: string;
  frequency?: string;
  [key: string]: unknown;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Valida un string de hora en formato HH:mm (hora 0..23, minuto 0..59).
 */
export function isValidReminderTime(timeStr?: string | null): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Parsea un string HH:mm y extrae horas y minutos numéricos validados.
 */
export function parseReminderTime(timeStr: string): { hours: number; minutes: number } {
  if (!isValidReminderTime(timeStr)) {
    throw new Error(`Formato de hora de recordatorio inválido: "${timeStr}". Debe ser HH:mm con hora 0..23 y minuto 0..59.`);
  }
  const [hStr, mStr] = timeStr.trim().split(':');
  return {
    hours: parseInt(hStr, 10),
    minutes: parseInt(mStr, 10),
  };
}

/**
 * Conversión explícita entre la convención interna de Habitail (0=Domingo...6=Sábado, con 7=Domingo soportado)
 * y la convención nativa de Expo Notifications (1=Domingo...7=Sábado).
 */
export function habitWeekdayToExpoWeekday(habitWeekday: number): number {
  const normalized = habitWeekday === 7 ? 0 : habitWeekday;
  if (normalized < 0 || normalized > 6) {
    throw new Error(`Día de la semana de Habitail inválido: ${habitWeekday}. Debe estar entre 0 y 6.`);
  }
  return normalized + 1; // 0 (Dom) -> 1, 1 (Lun) -> 2, ..., 6 (Sáb) -> 7
}

/**
 * Conversión explícita de Expo Notifications (1=Domingo...7=Sábado) a Habitail (0=Domingo...6=Sábado).
 */
export function expoWeekdayToHabitWeekday(expoWeekday: number): number {
  if (expoWeekday < 1 || expoWeekday > 7) {
    throw new Error(`Expo weekday inválido: ${expoWeekday}. Debe estar entre 1 y 7.`);
  }
  return expoWeekday - 1; // 1 (Dom) -> 0, ..., 7 (Sáb) -> 6
}

// ============================================================================
// Domain Completion Check
// ============================================================================

/**
 * Comprueba de forma segura si un hábito ya fue completado en una fecha lógica determinada.
 * Consulta prioritariamente SQLite como fuente canónica de verdad.
 */
export async function isHabitCompletedOnDate(
  habitId: string,
  dateStr: string = getLogicalToday()
): Promise<boolean> {
  if (Platform.OS !== 'web') {
    try {
      const db = await getDb();
      const row = await db.getFirstAsync<{ completado: number | boolean | string }>(
        'SELECT completado FROM habit_logs WHERE habitId = ? AND fecha = ?',
        [habitId, dateStr]
      );
      if (row !== null && row !== undefined) {
        return parseSqliteBoolean(row.completado);
      }
    } catch (error) {
      // Si SQLite no está disponible de inmediato, continuar con fallback
    }
  }

  try {
    const logs = useLogStore.getState().logs;
    if (Array.isArray(logs) && logs.length > 0) {
      return logs.some(
        (l) => l.habitId === habitId && toLogicalDate(l.fecha) === dateStr && parseSqliteBoolean(l.completado)
      );
    }
  } catch (storeError) {}

  return false;
}

// ============================================================================
// Snooze State Persistence
// ============================================================================

/**
 * Obtiene el número persistido de posposiciones realizadas para un hábito en una fecha lógica.
 */
export async function getHabitSnoozeCount(habitId: string, dateStr: string = getLogicalToday()): Promise<number> {
  try {
    const key = `${SNOOZE_STORAGE_PREFIX}${habitId}_${dateStr}`;
    const value = await AsyncStorage.getItem(key);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Incrementa y persiste el número de posposiciones para un hábito en una fecha lógica.
 */
export async function incrementHabitSnoozeCount(habitId: string, dateStr: string = getLogicalToday()): Promise<number> {
  try {
    const current = await getHabitSnoozeCount(habitId, dateStr);
    const next = current + 1;
    const key = `${SNOOZE_STORAGE_PREFIX}${habitId}_${dateStr}`;
    await AsyncStorage.setItem(key, String(next));
    return next;
  } catch (error) {
    return 1;
  }
}

/**
 * Cancela cualquier recordatorio pospuesto (snooze) programado para un hábito.
 */
export async function cancelHabitSnooze(habitId: string, dateStr?: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const prefix = dateStr 
      ? `habit:${habitId}:snooze:${dateStr}` 
      : `habit:${habitId}:snooze:`;
    const toCancel = scheduled.filter((n) => n.identifier.startsWith(prefix));
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (error) {
    console.warn(`[NotificationService] Error al cancelar snooze para el hábito ${habitId}:`, error);
  }
}

// ============================================================================
// Canonical Horizon Calculation
// ============================================================================

/**
 * Genera las próximas N ocurrencias para un hábito mensual aplicando la regla canónica de Habitail
 * (si el hábito inició el 29/30/31 y el mes no tiene ese día, corresponde el último día del mes).
 */
export function getUpcomingMonthlyOccurrences(
  habit: Habit,
  fromDateStr: string = getLogicalToday(),
  horizonMonths: number = 6
): string[] {
  const habitStart = toLogicalDate(habit.fechaInicio);
  const creationDay = parseInt(habitStart.split('-')[2], 10);
  const [startYear, startMonth] = fromDateStr.split('-').map(Number);

  const occurrences: string[] = [];
  let currentYear = startYear;
  let currentMonth = startMonth; // 1-indexed

  for (let i = 0; i < horizonMonths + 3 && occurrences.length < horizonMonths; i++) {
    const maxDays = getDaysInMonth(currentYear, currentMonth);
    const expectedDay = Math.min(creationDay, maxDays);
    const occStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(expectedDay).padStart(2, '0')}`;

    if (occStr >= fromDateStr && isHabitExpectedOnDate(habit, occStr)) {
      occurrences.push(occStr);
    }

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return occurrences;
}

// ============================================================================
// Categories Registration
// ============================================================================

/**
 * Registra las categorías de notificaciones interactivas usando traducciones i18n.
 */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Notificaciones nativas no soportadas en web. Omitiendo registro de categorías.');
    return;
  }

  const doneTitle = i18n.t('notifications.reminder.actionDone', { defaultValue: 'Hecho' });
  const snoozeTitle = i18n.t('notifications.reminder.actionSnooze', { defaultValue: 'Posponer' });

  await Notifications.setNotificationCategoryAsync(HABIT_REMINDER_CATEGORY, [
    {
      identifier: ACTION_DONE,
      buttonTitle: doneTitle,
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
        opensAppToForeground: false, 
      },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: snoozeTitle,
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
        opensAppToForeground: false, 
      },
    },
  ]);
  console.log('[NotificationService] Categorías registradas correctamente con i18n.');
}

// ============================================================================
// Action Handlers
// ============================================================================

/**
 * Maneja la acción "DONE" (Hecho).
 * Delega íntegramente en HabitCompletionService.completeHabit para asegurar idempotencia,
 * ledger inmutable y consistencia con la UI.
 */
export async function handleDoneAction(habitId: string): Promise<void> {
  console.log(`[NotificationService] Marcando hábito ${habitId} como completado a través de HabitCompletionService...`);

  try {
    await initDb();
    await useUserStore.getState().loadUser();

    const user = useUserStore.getState().user;
    const userId = user?.id || 'default-user';
    const todayStr = getLogicalToday();

    await habitCompletionService.completeHabit({
      userId,
      habitId,
      logicalDate: todayStr,
      source: 'NOTIFICATION',
    });

    // Cancelar cualquier recordatorio de snooze pendiente para hoy
    await cancelHabitSnooze(habitId, todayStr);

    console.log(`[NotificationService] Hábito ${habitId} completado con éxito vía HabitCompletionService.`);
  } catch (error) {
    console.error(`[NotificationService] Error al completar hábito ${habitId}:`, error);
  }
}

/**
 * Maneja la acción "SNOOZE" (Posponer).
 * Reprograma la notificación para 30 minutos después, limitado a 1 vez por hábito y LogicalDate.
 */
export async function handleSnoozeAction(
  habitId: string, 
  currentSnoozeCount: number,
  originalContent: Notifications.NotificationContent
): Promise<void> {
  const todayStr = getLogicalToday();
  console.log(`[NotificationService] Pospiniendo hábito ${habitId} en fecha ${todayStr}. Contador payload: ${currentSnoozeCount}`);

  // 1. Si el hábito ya fue completado hoy, ignoramos el snooze
  const isAlreadyDone = await isHabitCompletedOnDate(habitId, todayStr);
  if (isAlreadyDone) {
    console.log(`[NotificationService] El hábito ${habitId} ya fue completado hoy. Se ignora la acción de posponer.`);
    return;
  }

  // 2. Comprobar tanto el contador del payload como el persistido en AsyncStorage
  const persistedCount = await getHabitSnoozeCount(habitId, todayStr);
  if (persistedCount >= 1 || currentSnoozeCount >= 1) {
    console.log(`[NotificationService] El hábito ${habitId} ya alcanzó el máximo de 1 posposición hoy (persistido: ${persistedCount}, payload: ${currentSnoozeCount}). Se ignora.`);
    return;
  }

  try {
    const nextSnoozeCount = await incrementHabitSnoozeCount(habitId, todayStr);

    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 60,
      repeats: false,
    };

    const habitName = (originalContent.data as HabitNotificationData)?.habitName as string || 
                      originalContent.body || 
                      '';
    const snoozeTitle = i18n.t('notifications.reminder.snoozeTitle', { defaultValue: 'Recordatorio Pospuesto' });
    const snoozeBody = i18n.t('notifications.reminder.snoozeBody', { 
      name: habitName, 
      defaultValue: originalContent.body || 'Es hora de completar tu hábito.' 
    });

    const snoozeIdentifier = `habit:${habitId}:snooze:${todayStr}`;

    await Notifications.scheduleNotificationAsync({
      identifier: snoozeIdentifier,
      content: {
        title: snoozeTitle,
        body: snoozeBody,
        categoryIdentifier: HABIT_REMINDER_CATEGORY,
        data: {
          ...originalContent.data,
          habitId,
          snoozeCount: nextSnoozeCount,
          snoozeDate: todayStr,
        } as HabitNotificationData,
      },
      trigger,
    });

    console.log(`[NotificationService] Hábito ${habitId} pospuesto exitosamente por 30 minutos (ID: ${snoozeIdentifier}).`);
  } catch (error) {
    console.error(`[NotificationService] Error al posponer hábito ${habitId}:`, error);
  }
}

// ============================================================================
// Listeners Registration
// ============================================================================

/**
 * Configura los listeners para detectar las respuestas e interacciones con las notificaciones.
 */
export function setupNotificationListeners(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  // Configuración de visualización en foreground con verificación de hábitos completados
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as unknown as HabitNotificationData;
      if (data?.habitId) {
        const todayStr = getLogicalToday();
        const completed = await isHabitCompletedOnDate(data.habitId, todayStr);
        if (completed) {
          console.log(`[NotificationService] Notificación suprimida en primer plano: hábito ${data.habitId} ya completado hoy.`);
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
    const actionIdentifier = response.actionIdentifier;
    const notificationData = response.notification.request.content.data as unknown as HabitNotificationData;
    const habitId = notificationData?.habitId;
    
    if (!habitId) {
      console.warn('[NotificationService] Acción recibida pero no se encontró un habitId en los datos.');
      return;
    }

    const todayStr = formatDateDB(new Date());
    await AsyncStorage.setItem(`notification_last_sent_${habitId}`, todayStr);

    if (actionIdentifier === ACTION_DONE) {
      await handleDoneAction(habitId);
    } 
    else if (actionIdentifier === ACTION_SNOOZE) {
      const snoozeCount = notificationData.snoozeCount || 0;
      await handleSnoozeAction(habitId, snoozeCount, response.notification.request.content);
    } 
    else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      console.log(`[NotificationService] Usuario tocó la notificación del hábito ${habitId}.`);
    }
  });

  const receivedListener = Notifications.addNotificationReceivedListener(async (notification) => {
    const notificationData = notification.request.content.data as unknown as HabitNotificationData;
    const habitId = notificationData?.habitId;
    if (habitId) {
      const todayStr = formatDateDB(new Date());
      await AsyncStorage.setItem(`notification_last_sent_${habitId}`, todayStr);
      console.log(`[NotificationService] Notificación recibida para el hábito ${habitId}. Guardada fecha: ${todayStr}`);
    }
  });

  return () => {
    responseListener.remove();
    receivedListener.remove();
  };
}

// ============================================================================
// Notification Scheduling and Management
// ============================================================================

let rescheduleQueue = Promise.resolve();

/**
 * Verifica de forma silenciosa si el usuario ha otorgado permisos de notificación.
 */
export async function hasNotificationPermissionSilently(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('[NotificationService] Error silencioso al verificar permisos de notificación:', error);
    return false;
  }
}

/**
 * Wrapper de seguridad para ejecutar operaciones de notificaciones.
 */
export async function runSafeNotificationOperation<T>(
  operation: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  if (Platform.OS === 'web') {
    return fallbackValue;
  }
  try {
    const hasPermission = await hasNotificationPermissionSilently();
    
    try {
      const habitStore = useHabitStore.getState();
      if (habitStore && typeof habitStore.setNotificationsEnabled === 'function') {
        habitStore.setNotificationsEnabled(hasPermission);
      }
    } catch (storeError) {
      console.warn('[NotificationService] No se pudo sincronizar el estado del permiso con el store:', storeError);
    }

    if (!hasPermission) {
      console.log('[NotificationService] Operación omitida debido a la falta de permisos de notificación.');
      return fallbackValue;
    }

    return await operation();
  } catch (error) {
    console.error('[NotificationService] Excepción capturada y controlada en wrapper de seguridad:', error);
    return fallbackValue;
  }
}

/**
 * Cancela exclusivamente los triggers programados pertenecientes a un hábito específico.
 * Identifica triggers mediante el prefijo namespaced `habit:<habitId>:`, el ID directo o data.habitId.
 * No afecta a otros hábitos ni a notificaciones del sistema como pet:inactivity.
 * 
 * @param habitId ID del hábito cuyo recordatorio se desea cancelar.
 */
export async function cancelHabitReminder(habitId: string): Promise<void> {
  return runSafeNotificationOperation(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const habitPrefix = `habit:${habitId}:`;
    const toCancel = scheduled.filter(
      (n) => n.identifier.startsWith(habitPrefix) || 
             n.identifier === habitId ||
             (n.content?.data as HabitNotificationData)?.habitId === habitId
    );
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    console.log(`[NotificationService] Recordatorio(s) cancelado(s) para el hábito: ${habitId} (${toCancel.length} triggers)`);
  }, undefined);
}

/**
 * Programa los recordatorios de un hábito según su frecuencia y configuración de recordatorio.
 * Respeta la fuente canónica del calendario, la validez del formato HH:mm y la Regla de Oro
 * (no enviar recordatorio hoy si ya se completó antes de la hora).
 *
 * @param habit Objeto hábito con la configuración del recordatorio.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  return runSafeNotificationOperation(async () => {
    const reminderTime = habit.horaRecordatorio || (habit as any).reminderTime;

    if (!habit.activo) {
      console.log(`[NotificationService] El hábito "${habit.nombre || habit.name}" está inactivo. Omitiendo recordatorio.`);
      return;
    }

    if (!reminderTime) {
      console.log(`[NotificationService] El hábito "${habit.nombre || habit.name}" no tiene hora de recordatorio. Omitiendo.`);
      return;
    }

    if (!isValidReminderTime(reminderTime)) {
      console.warn(`[NotificationService] Formato de hora de recordatorio inválido ("${reminderTime}") para el hábito ${habit.id}. Debe ser HH:mm (hora 0..23, minuto 0..59).`);
      return;
    }

    const { hours, minutes } = parseReminderTime(reminderTime);
    const todayStr = getLogicalToday();
    const habitName = habit.nombre || habit.name || '';

    // 1. Cancelar triggers previos de este hábito exclusivamente
    await cancelHabitReminder(habit.id);

    // 2. Comprobar si ya está completado hoy consultando SQLite
    const isCompletedToday = await isHabitCompletedOnDate(habit.id, todayStr);

    // 3. Comprobar si la hora del recordatorio de hoy ya pasó
    const now = new Date();
    const reminderToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    const hasReminderPassedToday = now.getTime() >= reminderToday.getTime();

    // Textos con i18n
    const title = i18n.t('notifications.reminder.title', { defaultValue: '¡Hora de tu hábito!' });
    const body = i18n.t('notifications.reminder.body', {
      name: habitName,
      defaultValue: `Es momento de realizar tu hábito: ${habitName}`,
    });

    const freq = (habit.frecuencia || 'DAILY').toUpperCase();

    // ─────────────────────────────────────────────────────────────────────────
    // FRECUENCIA DAILY
    // ─────────────────────────────────────────────────────────────────────────
    if (freq === Frequency.DAILY || freq === 'DAILY') {
      if (isCompletedToday && !hasReminderPassedToday) {
        // Completado hoy antes de la hora del recordatorio:
        // No alertar hoy, pero mantener programadas las próximas ocurrencias en un horizonte de 7 días
        for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
          const targetDateStr = addDaysToLogicalDate(todayStr, dayOffset);
          if (isHabitExpectedOnDate(habit, targetDateStr)) {
            const [y, m, d] = targetDateStr.split('-').map(Number);
            const targetDate = new Date(y, m - 1, d, hours, minutes, 0, 0);

            await Notifications.scheduleNotificationAsync({
              identifier: `habit:${habit.id}:daily:${targetDateStr}`,
              content: {
                title,
                body,
                categoryIdentifier: HABIT_REMINDER_CATEGORY,
                data: { habitId: habit.id, habitName, targetDate: targetDateStr } as HabitNotificationData,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: targetDate,
              },
            });
          }
        }
        console.log(`[NotificationService] Hábito diario ${habit.id} completado hoy antes de hora. Horizonte de 7 días programado.`);
      } else {
        // Caso normal o la hora ya pasó hoy: trigger diario nativo recurrente
        await Notifications.scheduleNotificationAsync({
          identifier: `habit:${habit.id}:daily`,
          content: {
            title,
            body,
            categoryIdentifier: HABIT_REMINDER_CATEGORY,
            data: { habitId: habit.id, habitName } as HabitNotificationData,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
        console.log(`[NotificationService] Recordatorio diario nativo programado a las ${reminderTime} para: ${habit.id}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FRECUENCIA WEEKLY
    // ─────────────────────────────────────────────────────────────────────────
    else if (freq === Frequency.WEEKLY || freq === 'WEEKLY') {
      const configuredDays = Array.isArray(habit.diasSemana) ? habit.diasSemana : [];
      const currentDayOfWeek = getDayOfWeek(todayStr); // 0=Dom...6=Sáb

      for (const habitDay of configuredDays) {
        const expoWeekday = habitWeekdayToExpoWeekday(habitDay);
        const isToday = currentDayOfWeek === (habitDay === 7 ? 0 : habitDay);

        if (isToday && isCompletedToday && !hasReminderPassedToday) {
          // Si correspondía hoy y ya fue completado antes del recordatorio:
          // Saltamos hoy y agendamos el próximo día correspondiente de la semana entrante como DATE trigger
          const nextDateStr = addDaysToLogicalDate(todayStr, 7);
          const [y, m, d] = nextDateStr.split('-').map(Number);
          const nextDate = new Date(y, m - 1, d, hours, minutes, 0, 0);

          await Notifications.scheduleNotificationAsync({
            identifier: `habit:${habit.id}:weekly:${habitDay}:next`,
            content: {
              title,
              body,
              categoryIdentifier: HABIT_REMINDER_CATEGORY,
              data: { habitId: habit.id, habitName, weekday: habitDay, targetDate: nextDateStr } as HabitNotificationData,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: nextDate,
            },
          });
          console.log(`[NotificationService] Hábito semanal ${habit.id} completado hoy para día ${habitDay}. Próxima ocurrencia programada: ${nextDateStr}`);
        } else {
          // Programar trigger nativo WEEKLY recurrente para este día
          await Notifications.scheduleNotificationAsync({
            identifier: `habit:${habit.id}:weekly:${habitDay}`,
            content: {
              title,
              body,
              categoryIdentifier: HABIT_REMINDER_CATEGORY,
              data: { habitId: habit.id, habitName, weekday: habitDay } as HabitNotificationData,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              weekday: expoWeekday,
              hour: hours,
              minute: minutes,
              repeats: true,
            },
          });
          console.log(`[NotificationService] Recordatorio semanal nativo programado (día ${habitDay}, expo ${expoWeekday}) para: ${habit.id}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FRECUENCIA MONTHLY
    // ─────────────────────────────────────────────────────────────────────────
    else if (freq === Frequency.MONTHLY || freq === 'MONTHLY') {
      const habitStart = toLogicalDate(habit.fechaInicio);
      const creationDay = parseInt(habitStart.split('-')[2], 10);

      if (creationDay <= 28) {
        // El día cabe siempre en todos los meses (1..28)
        const todayDay = parseInt(todayStr.split('-')[2], 10);
        const isTodayMonthly = todayDay === creationDay;

        if (isTodayMonthly && isCompletedToday && !hasReminderPassedToday) {
          // Si correspondía hoy y ya fue completado antes del recordatorio:
          // Calculamos la ocurrencia del próximo mes con DATE trigger
          const upcoming = getUpcomingMonthlyOccurrences(habit, todayStr, 2);
          const nextOccStr = upcoming.find((d) => d > todayStr);
          if (nextOccStr) {
            const [y, m, d] = nextOccStr.split('-').map(Number);
            const nextDate = new Date(y, m - 1, d, hours, minutes, 0, 0);

            await Notifications.scheduleNotificationAsync({
              identifier: `habit:${habit.id}:monthly:${nextOccStr}`,
              content: {
                title,
                body,
                categoryIdentifier: HABIT_REMINDER_CATEGORY,
                data: { habitId: habit.id, habitName, targetDate: nextOccStr } as HabitNotificationData,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: nextDate,
              },
            });
          }
        } else {
          // Programamos el trigger mensual recurrente nativo
          await Notifications.scheduleNotificationAsync({
            identifier: `habit:${habit.id}:monthly:${creationDay}`,
            content: {
              title,
              body,
              categoryIdentifier: HABIT_REMINDER_CATEGORY,
              data: { habitId: habit.id, habitName, day: creationDay } as HabitNotificationData,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              day: creationDay,
              hour: hours,
              minute: minutes,
              repeats: true,
            },
          });
          console.log(`[NotificationService] Recordatorio mensual nativo programado (día ${creationDay}) para: ${habit.id}`);
        }
      } else {
        // Hábitos iniciados 29, 30 o 31:
        // La regla de Habitail los desplaza al último día de meses más cortos (ej: 28/29 feb, 30 abr).
        // Usamos el motor canónico para generar un horizonte razonable de ocurrencias DATE (6 meses):
        const occurrences = getUpcomingMonthlyOccurrences(habit, todayStr, 6);

        for (const occStr of occurrences) {
          if (occStr === todayStr && (isCompletedToday || hasReminderPassedToday)) {
            continue;
          }

          const [y, m, d] = occStr.split('-').map(Number);
          const occDate = new Date(y, m - 1, d, hours, minutes, 0, 0);

          await Notifications.scheduleNotificationAsync({
            identifier: `habit:${habit.id}:monthly:${occStr}`,
            content: {
              title,
              body,
              categoryIdentifier: HABIT_REMINDER_CATEGORY,
              data: { habitId: habit.id, habitName, targetDate: occStr } as HabitNotificationData,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: occDate,
            },
          });
        }
        console.log(`[NotificationService] Hábito mensual 29/30/31 ${habit.id}. Horizonte de ${occurrences.length} ocurrencias DATE programado.`);
      }
    }
  }, undefined);
}

/**
 * Reprograma todas las notificaciones pertenecientes al namespace de hábitos de forma serializada.
 * Cancela ÚNICAMENTE notificaciones cuyo ID empiece por 'habit:' o tengan data de hábito,
 * preservando intactas las notificaciones del sistema como pet:inactivity.
 * 
 * @param habits Lista de hábitos activos a reprogramar.
 */
export function rescheduleAllHabitNotifications(habits: Habit[]): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[NotificationService] Reprogramación no soportada en web.');
    return Promise.resolve();
  }

  rescheduleQueue = rescheduleQueue.then(async () => {
    console.log('[NotificationService] Iniciando reprogramación masiva de recordatorios de hábitos...');
    
    await runSafeNotificationOperation(async () => {
      // 1. Obtener todas las notificaciones agendadas nativamente
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      // 2. Filtrar únicamente las pertenecientes al namespace de hábitos
      const habitNotifications = scheduled.filter(
        (n) => n.identifier.startsWith('habit:') || 
               Boolean((n.content?.data as HabitNotificationData)?.habitId)
      );

      // 3. Cancelar de forma determinista usando Promise.all SOLO las de hábitos
      await Promise.all(habitNotifications.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
      console.log(`[NotificationService] Canceladas ${habitNotifications.length} notificaciones del namespace de hábitos. Las notificaciones del sistema (como pet:inactivity) se mantuvieron intactas.`);

      // 4. Volver a programar recordatorios para cada hábito activo
      for (const habit of habits) {
        if (habit.activo) {
          await scheduleHabitReminder(habit);
        }
      }
      console.log('[NotificationService] Reprogramación masiva de hábitos finalizada con éxito.');
    }, undefined);
  });

  return rescheduleQueue;
}

/**
 * Alias de compatibilidad para rescheduleAllHabitNotifications.
 */
export function rescheduleAllNotifications(habits: Habit[]): Promise<void> {
  return rescheduleAllHabitNotifications(habits);
}

/**
 * Alias de compatibilidad para rescheduleAllHabitNotifications.
 */
export function rescheduleAll(habits: Habit[]): Promise<void> {
  return rescheduleAllHabitNotifications(habits);
}
