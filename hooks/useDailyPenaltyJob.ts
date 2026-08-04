import { useEffect, useRef } from 'react';
import { format, startOfYesterday, startOfDay, isBefore, addDays, parseISO, startOfToday } from 'date-fns';
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
        let lastProcessedDateStr = user.lastPenaltyAppliedDate;

        // Si es un usuario nuevo sin lastPenaltyAppliedDate, marcamos hoy como su inicio
        // para que empiece a ser penalizado por los incumplimientos a partir de mañana.
        if (!lastProcessedDateStr) {
          await updateUser({ lastPenaltyAppliedDate: todayString });
          lastRunDateRef.current = todayString;
          return;
        }

        // Empezamos a revisar a partir del día siguiente al último procesado
        let currentDate = startOfDay(addDays(parseISO(lastProcessedDateStr), 1));
        const today = startOfToday();
        
        let totalDelta = 0;

        // Bucle para procesar cada día desde lastProcessedDate + 1 hasta ayer (inclusive)
        while (isBefore(currentDate, today)) {
          const currentDateString = format(currentDate, 'yyyy-MM-dd');
          
          // Obtener los hábitos esperados para el día específico en el bucle
          const expectedHabits = getHabitsForToday(habits, currentDate);
          
          // Consultar los hábitos que no se cumplieron ese día
          const missedHabits = await logRepo.getMissedHabitsForDate(currentDateString, expectedHabits);
          
          if (missedHabits.length > 0) {
            const delta = calculatePenaltyDelta(missedHabits);
            totalDelta += delta;
          }
          
          // Avanzar al siguiente día
          currentDate = addDays(currentDate, 1);
        }

        // Aplicar la penalización total a la salud si hubo faltas
        if (totalDelta < 0 && pet.vida > 0) {
          await updateHealth(totalDelta);
        }

        // Registrar lastPenaltyAppliedDate = today en userStore y base de datos
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
