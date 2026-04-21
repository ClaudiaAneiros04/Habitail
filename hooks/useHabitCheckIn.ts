import { useCallback } from 'react';
import { useLogStore } from '../store/useLogStore';
import { usePetStore } from '../store/usePetStore';
import { HabitLog } from '../types';
import { formatISO, startOfDay, parseISO } from 'date-fns';

/**
 * Hook principal y modular para gestionar el Check-In (completar/desmarcar) de los hábitos.
 * 
 * Se encarga de la lógica de negocio e integridad de datos subyacente sin mezclarse
 * con componentes de interfaz de usuario. Centraliza las operaciones de:
 * - Persistencia del estado histórico a través de logStore.
 * - Conexión automática con el sistema de gamificación (petStore).
 * - Verificación determinista del estado para un día en particular.
 */
export const useHabitCheckIn = () => {
  const { logs, addLog } = useLogStore();
  const { updateHealth } = usePetStore();

  /**
   * Genera un ID determinista para el registro (log) de un día específico.
   * Esto garantiza que si se vuelve a marcar/desmarcar en el mismo día, 
   * se sobrescriba el log existente en lugar de generar duplicados en la base de datos.
   * 
   * @param habitId - El identificador del hábito.
   * @param targetDate - La fecha objetivo del registro.
   * @returns string - Un ID único determinista basado en el hábito y el inicio del día.
   */
  const generateLogId = (habitId: string, targetDate: Date): string => {
    return `log_${habitId}_${startOfDay(targetDate).getTime()}`;
  };

  /**
   * Obtiene el estado actual (completado o no) de un hábito en una fecha determinada.
   * Filtra los logs globales almacenados en memoria para encontrar la coincidencia exacta
   * basada en el ID del hábito y el día en cuestión, ignorando la hora del día.
   * 
   * @param habitId - El identificador único del hábito.
   * @param fecha - La fecha en la que se quiere verificar el estado.
   * @returns boolean - true si existe un registro y está completado, false en cualquier otro caso.
   */
  const getStatusForDay = useCallback((habitId: string, fecha: Date): boolean => {
    const targetISO = startOfDay(fecha).toISOString();
    
    // Busca en el estado global el log que concuerde en fecha y ID de hábito
    const log = logs.find(l => {
      if (l.habitId !== habitId) return false;
      const logISO = startOfDay(parseISO(l.fecha)).toISOString();
      return logISO === targetISO;
    });

    return log ? log.completado : false;
  }, [logs]);

  /**
   * Marca un hábito como completado en una fecha dada.
   * Revisa primero si no estaba ya completado para evitar actualizaciones superfluas.
   * De no estarlo, crea o actualiza un registro de log como completado, lo persiste 
   * en el estado global persistente (logStore) e impacta la gamificación sumando salud.
   * 
   * @param habitId - El identificador único del hábito.
   * @param fecha - La fecha calendario en la que se completó el hábito.
   */
  const markComplete = useCallback(async (habitId: string, fecha: Date) => {
    // 1. Verificamos el estado actual para evitar procesos redundantes
    const status = getStatusForDay(habitId, fecha);
    if (status) return; // Ya está completado en esa fecha, abortar

    // 2. Crear la entidad de registro (log)
    const newLog: HabitLog = {
      id: generateLogId(habitId, fecha),
      habitId,
      userId: 'current-user', // Pendiente integracion con context/store real de usuario
      fecha: formatISO(fecha),
      completado: true,
      timestampRegistro: formatISO(new Date())
    };

    // 3. Persistimos el registro de éxito
    await addLog(newLog);

    // 4. Actualizamos la gamificación (+10 de salud por completar la tarea)
    await updateHealth(10);
  }, [addLog, getStatusForDay, updateHealth]);

  /**
   * Desmarca un hábito (lo marca como incompleto) para una fecha dada.
   * Verifica primero su estado; si no estaba completado, no realiza operaciones.
   * Si estaba completado, crea o sobrescribe el log reflejando el cambio a incompleto
   * y aplica una penalización en el sistema de gamificación.
   * 
   * @param habitId - El identificador único del hábito que se desea desmarcar.
   * @param fecha - La fecha en la que se desmarca el hábito.
   */
  const markIncomplete = useCallback(async (habitId: string, fecha: Date) => {
    // 1. Verificamos el estado actual para evitar procesos redundantes
    const status = getStatusForDay(habitId, fecha);
    if (!status) return; // Ya está desmarcado o nunca se completó, abortar

    // 2. Crear/Actualizar la entidad de registro indicando que NO está completado
    const newLog: HabitLog = {
      id: generateLogId(habitId, fecha),
      habitId,
      userId: 'current-user',
      fecha: formatISO(fecha),
      completado: false, // Refleja explícitamente el cambio de estado
      timestampRegistro: formatISO(new Date())
    };

    // 3. Persistimos el cambio de estado en el histórico
    await addLog(newLog);

    // 4. Actualizamos la gamificación a modo de penalización suave (-5 de salud)
    await updateHealth(-5);

  }, [addLog, getStatusForDay, updateHealth]);

  // Exponemos la Interfaz limpia para el Desarrollador de Frontend
  return {
    markComplete,
    markIncomplete,
    getStatusForDay
  };
};
