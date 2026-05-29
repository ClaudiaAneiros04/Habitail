import { useEffect, useRef } from 'react';
import { format, startOfYesterday } from 'date-fns';
import { useUserStore } from '../store/useUserStore';
import { useHabitStore } from '../store/useHabitStore';
import { usePetStore } from '../store/usePetStore';
import { LogRepository } from '../storage/LogRepository';
import { getHabitsForToday } from '../utils/frequencyEngine';
import { calculatePenaltyDelta } from '../utils/petLogic';

const logRepo = new LogRepository();

export const useDailyPenaltyJob = () => {
  const { user, updateUser } = useUserStore();
  const { habits } = useHabitStore();
  const { pet, updateHealth } = usePetStore();

  // Referencias para controlar reentradas concurrentes y asegurar la idempotencia
  const isRunningRef = useRef(false);
  const lastRunDateRef = useRef<string | null>(null);

  useEffect(() => {
    // Asegurarse de que tenemos usuario, mascota y hábitos cargados
    if (!user || !pet || !habits) return;

    const runJob = async () => {
      const todayString = format(new Date(), 'yyyy-MM-dd');
      
      // 1. Si ya se ejecutó hoy en esta instancia o está corriendo -> no hacer nada
      if (lastRunDateRef.current === todayString || isRunningRef.current) {
        return;
      }

      // 2. Si el store del usuario ya indica que se ejecutó hoy -> actualizar ref y no hacer nada
      if (user.lastPenaltyAppliedDate === todayString) {
        lastRunDateRef.current = todayString;
        return;
      }

      isRunningRef.current = true;

      try {
        // 3. Si la mascota ya tiene 0 de vida, solo actualizamos la fecha sin recalcular
        if (pet.vida === 0) {
          await updateUser({ lastPenaltyAppliedDate: todayString });
          lastRunDateRef.current = todayString;
          return;
        }

        // 4. Obtener todos los hábitos activos que debían cumplirse ayer
        const yesterday = startOfYesterday();
        const yesterdayString = format(yesterday, 'yyyy-MM-dd');
        const expectedHabitsYesterday = getHabitsForToday(habits, yesterday);

        // 5. Para cada hábito, consultar si existe un HabitLog con completado = true para la fecha de ayer
        const missedHabits = await logRepo.getMissedHabitsForDate(yesterdayString, expectedHabitsYesterday);

        if (missedHabits.length > 0) {
          // 6. Calcular el delta negativo
          const delta = calculatePenaltyDelta(missedHabits);
          
          // 7. Aplicar vida y actualizar petStore
          if (delta < 0) {
            await updateHealth(delta);
          }
        }

        // 8. Registrar lastPenaltyAppliedDate = today en userStore y base de datos
        await updateUser({ lastPenaltyAppliedDate: todayString });
        lastRunDateRef.current = todayString;
      } catch (error) {
        console.error('[useDailyPenaltyJob] Error durante la ejecución del job de penalización:', error);
      } finally {
        isRunningRef.current = false;
      }
    };

    runJob();
  }, [user, pet, habits, updateUser, updateHealth]);
};
