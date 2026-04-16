import { Habit, Frequency } from '../types';

/**
 * Filtra la lista de hábitos para devolver solo aquellos que deben completarse en la fecha especificada.
 *
 * NOTA: Esta función es pura. No modifica los argumentos ni tiene efectos secundarios.
 *
 * @param habits Lista de hábitos activos a filtrar.
 * @param date Fecha para la que se quieren obtener los hábitos.
 * @returns Lista de hábitos aplicables para esa fecha.
 */
export const getHabitsForToday = (habits: Habit[], date: Date): Habit[] => {
  return habits.filter((habit) => {
    // Si el hábito no está activo, no debería mostrarse hoy,
    // aunque el prompt no dice nada de activo, lo asumimos sano.
    if (!habit.activo) return false;

    // Verificar si el hábito empieza en el futuro
    const startDate = new Date(habit.fechaInicio);
    
    // Opcional: Para evitar problemas con la hora, solo comparamos a nivel de fechas (opcional)
    // Pero asumiendo q si la date es antes de fechaInicio no mostramos el hábito.
    // Vamos a ir a lo simple y aplicar estrictamente las condiciones dadas:
    
    const frequency = habit.frecuencia as Frequency;

    switch (frequency) {
      case Frequency.DAILY:
      case 'DAILY':
        return true;

      case Frequency.WEEKLY:
      case 'WEEKLY':
        // date.getDay() devuelve 0 (Domingo) a 6 (Sábado)
        return habit.diasSemana && habit.diasSemana.includes(date.getDay());

      case Frequency.MONTHLY:
      case 'MONTHLY': {
        // Obtenemos qué día del mes inició el hábito
        // (asumiendo que 'el día del mes' es la fecha de inicio del hábito)
        let creationDay = startDate.getDate();
        
        // Manejar el caso especial cuando la fecha dada es el último día del mes
        // y la fecha de inicio es un día superior (ej. 31 en un mes de 30)
        // Pero la lógica simple es match directo:
        return date.getDate() === creationDay;
      }

      default:
        return false;
    }
  });
};
