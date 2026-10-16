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
import { PetRow, GamificationEventRow } from '../db/schema';
import { Habit, User, Pet } from '../types';

const logRepo = new LogRepository();

export const runDailyPenaltyJob = async (params?: {
  user?: User | null;
  habits?: Habit[];
  pet?: Pet | null;
  updateUser?: (updates: Partial<User>) => Promise<void>;
  updateHealth?: (delta: number) => Promise<void>;
}): Promise<boolean> => {
  const user: User | null = params?.user ?? (useUserStore.getState ? useUserStore.getState().user : (useUserStore as any)().user);
  const habits: Habit[] = params?.habits ?? (useHabitStore.getState ? useHabitStore.getState().habits : (useHabitStore as any)().habits);
  const pet: Pet | null = params?.pet ?? (usePetStore.getState ? usePetStore.getState().pet : (usePetStore as any)().pet);

  const updateUserFn = params?.updateUser ?? (useUserStore.getState ? useUserStore.getState().updateUser : (useUserStore as any)().updateUser);
  const updateHealthFn = params?.updateHealth ?? (usePetStore.getState ? usePetStore.getState().updateHealth : (usePetStore as any)().updateHealth);

  if (!user || !pet || !habits || habits.length === 0) return false;

  const todayString = getLogicalToday();
  const yesterday = subDaysFromLogicalDate(todayString, 1);

  let db: SQLiteDatabase | null = null;
  try {
    db = await getDb();
  } catch (dbError) {
    db = null;
  }

  // 1. Obtener la fecha más antigua de inicio de los hábitos
  const habitsWithStartDate = habits.filter((h: Habit) => !!h.fechaInicio);
  const firstHabitDate = habitsWithStartDate.length > 0
    ? habitsWithStartDate
        .map((h: Habit) => toLogicalDate(h.fechaInicio!))
        .sort((a: string, b: string) => compareLogicalDates(a, b))[0]
    : null;

  const userRegistrationDate = user.fechaRegistro ? toLogicalDate(user.fechaRegistro) : null;
  let startEvaluationDate: string = firstHabitDate ?? userRegistrationDate ?? yesterday;

  if (firstHabitDate && userRegistrationDate) {
    startEvaluationDate = compareLogicalDates(firstHabitDate, userRegistrationDate) < 0
      ? firstHabitDate
      : userRegistrationDate;
  }

  // 2. Comprobar en SQLite cuál fue el ÚLTIMO día realmente evaluado
  if (db) {
    const lastEvent = await db.getFirstAsync<{ logicalDate: string }>(
      `SELECT logicalDate FROM gamification_events 
       WHERE eventType = 'DAILY_PENALTY' 
       ORDER BY logicalDate DESC LIMIT 1`
    );

    if (lastEvent && lastEvent.logicalDate) {
      // Si ya hay eventos en la BD, comenzamos desde el día siguiente al último evaluado
      const nextDayToEvaluate = addDaysToLogicalDate(lastEvent.logicalDate, 1);
      if (compareLogicalDates(nextDayToEvaluate, startEvaluationDate) > 0) {
        startEvaluationDate = nextDayToEvaluate;
      }
    }
  }

  // Si la fecha a evaluar es posterior a ayer (ej. ya todo está al día), no hay nada que penalizar
  if (compareLogicalDates(startEvaluationDate, yesterday) > 0) {
    return false;
  }

  let currentVida = pet.vida;
  let currentDate = startEvaluationDate;
  let penaltiesAppliedCount = 0;

  // 3. Iterar día por día desde el día pendiente más antiguo hasta ayer
  while (compareLogicalDates(currentDate, yesterday) <= 0) {
    const eventKey = `penalty:daily:${currentDate}`;

    let alreadyProcessed = false;
    if (db) {
      const existingEvent = await db.getFirstAsync<GamificationEventRow>(
        'SELECT eventKey FROM gamification_events WHERE eventKey = ?',
        [eventKey]
      );
      if (existingEvent) {
        alreadyProcessed = true;
      }
    }

    if (!alreadyProcessed) {
      if (currentVida > 0) {
        const expectedHabits = getHabitsExpectedOnDate(habits, currentDate);
        const missedHabits = await logRepo.getMissedHabitsForDate(currentDate, expectedHabits);
        const delta = missedHabits.length > 0 ? calculatePenaltyDelta(missedHabits) : 0;

        if (db) {
          await db.withTransactionAsync(async () => {
            if (delta < 0 && currentVida > 0) {
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
              penaltiesAppliedCount++;
            } else {
              // Registro neutro si no hubo hábitos incumplidos
              await db!.runAsync(
                `INSERT INTO gamification_events
                 (eventKey, userId, petId, habitId, logicalDate, eventType, healthDelta, appliedHealthDelta, pointsDelta, createdAt, isReverted)
                 VALUES (?, ?, ?, NULL, ?, 'DAILY_PENALTY', 0, 0, 0, ?, 0)`,
                [eventKey, user.id, pet.id, currentDate, getCurrentInstant()]
              );
            }
          });
        } else {
          if (delta < 0 && currentVida > 0) {
            const nuevaVida = clampHealth(currentVida + delta);
            await updateHealthFn(delta);
            currentVida = nuevaVida;
            penaltiesAppliedCount++;
          }
        }
      } else {
        // Si la mascota ya llegó a 0 HP en días anteriores, sellamos los días restantes
        // para que cuando la revivas no vuelva a recibir daño de estas fechas pasadas
        if (db) {
          await db.runAsync(
            `INSERT INTO gamification_events
             (eventKey, userId, petId, habitId, logicalDate, eventType, healthDelta, appliedHealthDelta, pointsDelta, createdAt, isReverted)
             VALUES (?, ?, ?, NULL, ?, 'DAILY_PENALTY', 0, 0, 0, ?, 0)`,
            [eventKey, user.id, pet.id, currentDate, getCurrentInstant()]
          );
        }
      }
    }

    currentDate = addDaysToLogicalDate(currentDate, 1);
  }

  // 4. Actualizar stores y usuarios tras completar la revisión
  if (db) {
    await db.runAsync(
      'UPDATE users SET lastPenaltyAppliedDate = ? WHERE id = ?',
      [yesterday, user.id]
    );
    if (usePetStore.getState) {
      await usePetStore.getState().loadPet();
    }
  }
  await updateUserFn({ lastPenaltyAppliedDate: yesterday });

  return penaltiesAppliedCount > 0;
};

export const useDailyPenaltyJob = () => {
  const userStore = useUserStore();
  const habitStore = useHabitStore();
  const petStore = usePetStore();

  const storeUser = userStore?.user;
  const updateUser = userStore?.updateUser;
  const habits = habitStore?.habits;
  const petId = petStore?.pet?.id;
  const updateHealth = petStore?.updateHealth;

  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!storeUser || !petId || !habits || habits.length === 0) return;

    if (isRunningRef.current) return;
    isRunningRef.current = true;

    runDailyPenaltyJob({
      user: storeUser,
      habits,
      pet: petStore?.pet,
      updateUser,
      updateHealth,
    })
      .catch((err) => {
        console.error('[useDailyPenaltyJob] Error en hook:', err);
      })
      .finally(() => {
        isRunningRef.current = false;
      });
  }, [storeUser, petId, habits, updateUser, updateHealth]);
};