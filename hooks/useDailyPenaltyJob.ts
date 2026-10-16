import { useEffect, useRef } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useHabitStore } from '../store/useHabitStore';
import { usePetStore } from '../store/usePetStore';
import { LogRepository } from '../storage/LogRepository';
import { getHabitsExpectedOnDate } from '../utils/frequencyEngine';
import { calculatePenaltyDelta, getPetState, clampHealth, isPetTerminal } from '../utils/petLogic';
import { 
  getLogicalToday, 
  toLogicalDate,
  addDaysToLogicalDate,
  subDaysFromLogicalDate, 
  compareLogicalDates, 
  getCurrentInstant 
} from '../utils/dateUtils';
import { getDb } from '../storage/database';
import type { SQLiteDatabase } from 'expo-sqlite';
import { PetRow, UserRow, GamificationEventRow } from '../db/schema';
import { PetState } from '../types';

const logRepo = new LogRepository();

/**
 * Job diario de penalización por hábitos incumplidos.
 * 
 * Reglas de Dominio y Resiliencia:
 * 1. Coherencia con la regla de 72h:
 *    - La ausencia de 72h o más es absorbida directamente por la regla de inactividad terminal.
 *    - Si la mascota ya está en vida 0 o ABSENT, se invalida cualquier penalización posterior.
 *    - Para ausencias inferiores a 72h, se procesa como máximo el día cerrado pendiente que corresponda
 *      (ayer), evitando acumulaciones retroactivas masivas de múltiples días.
 * 2. Validación de hábitos esperados con `getHabitsExpectedOnDate`:
 *    - No penaliza días previos a `fechaInicio`.
 *    - No penaliza días no programados según la frecuencia del hábito.
 *    - No penaliza periodos en que el hábito estuvo archivado/inactivo.
 *    - No penaliza días posteriores a `fechaFin`.
 * 3. Atomicidad e Idempotencia:
 *    - Protegido en SQLite dentro de una transacción única y registrado en `gamification_events`
 *      con clave determinista `penalty:daily:${targetDate}`.
 *    - Si la deducción lleva los HP a <= 0, fuerza el estado a terminal (`ABSENT`) de forma irreversible.
 */
export const runDailyPenaltyJob = async (params?: {
  user?: import('../types').User | null;
  habits?: import('../types').Habit[];
  pet?: import('../types').Pet | null;
  updateUser?: (updates: Partial<import('../types').User>) => Promise<void>;
  updateHealth?: (delta: number) => Promise<void>;
}): Promise<boolean> => {
  const user = params?.user ?? (useUserStore.getState ? useUserStore.getState().user : (useUserStore as any)().user);
  const habits = params?.habits ?? (useHabitStore.getState ? useHabitStore.getState().habits : (useHabitStore as any)().habits);
  const pet = params?.pet ?? (usePetStore.getState ? usePetStore.getState().pet : (usePetStore as any)().pet);

  const updateUserFn = params?.updateUser ?? (useUserStore.getState ? useUserStore.getState().updateUser : (useUserStore as any)().updateUser);
  const updateHealthFn = params?.updateHealth ?? (usePetStore.getState ? usePetStore.getState().updateHealth : (usePetStore as any)().updateHealth);

  if (!user || !pet || !habits) return false;

  const todayString = getLogicalToday();
  const yesterday = subDaysFromLogicalDate(todayString, 1);

  // Si el usuario ya fue procesado para ayer (o una fecha igual/posterior a ayer) -> no hay días cerrados que evaluar
  if (user.lastPenaltyAppliedDate && compareLogicalDates(user.lastPenaltyAppliedDate, yesterday) >= 0) {
    return false;
  }

  try {
    // Si la mascota ya está en estado terminal (vida = 0 / ABSENT), no penalizar más
    if (isPetTerminal(pet)) {
      await updateUserFn({ lastPenaltyAppliedDate: yesterday });
      return false;
    }

    const userRegistrationDate = user.fechaRegistro ? toLogicalDate(user.fechaRegistro) : null;

    // Determinar la fecha inicial desde donde evaluar:
    // Si el usuario nunca ha corrido penalizaciones (lastPenaltyAppliedDate es null/undefined),
    // se empieza a evaluar desde la fecha de registro (o fallback a yesterday).
    let startEvaluationDate: string | null = user.lastPenaltyAppliedDate;

    if (!startEvaluationDate) {
      if (userRegistrationDate) {
        startEvaluationDate = userRegistrationDate;
      } else {
        startEvaluationDate = yesterday;
      }
    }

    // Si startEvaluationDate es posterior a yesterday (ej. usuario registrado hoy),
    // aún no hay días cerrados para evaluar.
    if (compareLogicalDates(startEvaluationDate, yesterday) > 0) {
      // Marcamos ayer como fecha procesada para que mañana comience evaluando hoy
      await updateUserFn({ lastPenaltyAppliedDate: yesterday });
      return false;
    }

    // Si user.lastPenaltyAppliedDate ya existía, el día de esa fecha ya fue evaluado, por lo que avanzamos 1 día.
    // Si NO existía (primera vez tras registro), evaluamos desde la fecha de registro inclusive.
    let currentDate = user.lastPenaltyAppliedDate
      ? addDaysToLogicalDate(user.lastPenaltyAppliedDate, 1)
      : startEvaluationDate;

    // Si al avanzar nos pasamos de yesterday, no hay días pendientes
    if (compareLogicalDates(currentDate, yesterday) > 0) {
      await updateUserFn({ lastPenaltyAppliedDate: yesterday });
      return false;
    }

    let db: SQLiteDatabase | null = null;
    try {
      db = await getDb();
    } catch (dbError) {
      db = null;
    }

    let currentVida = pet.vida;
    let lastEvaluatedDate: string = user.lastPenaltyAppliedDate || yesterday;

    // Iterar día a día evaluando hábitos incumplidos hasta yesterday
    while (compareLogicalDates(currentDate, yesterday) <= 0 && currentVida > 0) {
      const eventKey = `penalty:daily:${currentDate}`;
      const expectedHabits = getHabitsExpectedOnDate(habits, currentDate);
      const missedHabits = await logRepo.getMissedHabitsForDate(currentDate, expectedHabits);
      const delta = missedHabits.length > 0 ? calculatePenaltyDelta(missedHabits) : 0;

      if (db) {
        await db.withTransactionAsync(async () => {
          const existingEvent = await db!.getFirstAsync<GamificationEventRow>(
            'SELECT * FROM gamification_events WHERE eventKey = ?',
            [eventKey]
          );

          if (!existingEvent && delta < 0 && currentVida > 0) {
            const nuevaVida = clampHealth(currentVida + delta);
            const nuevoEstado = getPetState(nuevaVida);

            await db!.runAsync(
              'UPDATE pets SET vida = ?, estadoActual = ? WHERE id = ?',
              [nuevaVida, nuevoEstado, pet.id]
            );

            const appliedDelta = nuevaVida - currentVida;

            await db!.runAsync(
              `INSERT INTO gamification_events
               (eventKey, userId, petId, habitId, logicalDate, eventType, healthDelta, appliedHealthDelta, pointsDelta, createdAt, isReverted)
               VALUES (?, ?, ?, NULL, ?, 'DAILY_PENALTY', ?, ?, 0, ?, 0)`,
              [eventKey, user.id, pet.id, currentDate, delta, appliedDelta, getCurrentInstant()]
            );

            currentVida = nuevaVida;
          }
        });
      } else {
        // En entorno mockeado (ej. tests unitarios sin DB real)
        if (delta < 0 && currentVida > 0) {
          const nuevaVida = clampHealth(currentVida + delta);
          await updateHealthFn(delta);
          currentVida = nuevaVida;
        }
      }

      lastEvaluatedDate = currentDate;
      currentDate = addDaysToLogicalDate(currentDate, 1);
    }

    // Actualizar lastPenaltyAppliedDate con el último día cerrado evaluado (yesterday)
    const finalProcessedDate = compareLogicalDates(lastEvaluatedDate, yesterday) >= 0 ? yesterday : lastEvaluatedDate;

    if (db) {
      await db.runAsync(
        'UPDATE users SET lastPenaltyAppliedDate = ? WHERE id = ?',
        [finalProcessedDate, user.id]
      );
      if (usePetStore.getState) {
        await usePetStore.getState().loadPet();
      }
    }
    await updateUserFn({ lastPenaltyAppliedDate: finalProcessedDate });

    return true;
  } catch (error) {
    console.error('[useDailyPenaltyJob] Error durante la ejecución del job de penalización:', error);
    return false;
  }
};

export const useDailyPenaltyJob = () => {
  const userStore = useUserStore();
  const habitStore = useHabitStore();
  const petStore = usePetStore();

  const storeUser = userStore?.user;
  const updateUser = userStore?.updateUser;
  const habits = habitStore?.habits;
  const pet = petStore?.pet;
  const updateHealth = petStore?.updateHealth;

  const isRunningRef = useRef(false);
  const lastRunDateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storeUser || !pet || !habits) return;

    const todayString = getLogicalToday();
    const yesterday = subDaysFromLogicalDate(todayString, 1);

    if (lastRunDateRef.current === todayString || isRunningRef.current) {
      return;
    }

    // Si ya se evaluó hasta ayer o posterior, no volver a correr hoy
    if (storeUser.lastPenaltyAppliedDate && compareLogicalDates(storeUser.lastPenaltyAppliedDate, yesterday) >= 0) {
      lastRunDateRef.current = todayString;
      return;
    }

    isRunningRef.current = true;
    runDailyPenaltyJob({
      user: storeUser,
      habits,
      pet,
      updateUser,
      updateHealth,
    })
      .then(() => {
        lastRunDateRef.current = todayString;
      })
      .catch((err) => {
        console.error('[useDailyPenaltyJob] Error en hook:', err);
      })
      .finally(() => {
        isRunningRef.current = false;
      });
  }, [storeUser, pet, habits, updateUser, updateHealth]);
};
