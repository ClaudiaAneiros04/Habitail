import { useMemo } from 'react';
import { habitLibrary, PredefinedHabit } from '../data/habitLibrary';
import { Category } from '../types';

/**
 * Filtra la librería de hábitos predefinidos en función de las categorías
 * seleccionadas por el usuario durante el onboarding.
 *
 * Se usa `useMemo` en lugar de `useState + useEffect` porque la fuente de datos
 * es síncrona (un array constante importado), eliminando el ciclo extra de render
 * que causaba el setState dentro de useEffect en la versión stub.
 *
 * El tipo de retorno usa `PredefinedHabit` en lugar del tipo `Habit` del store
 * para no requerir campos como `id`, `userId` o `fechaInicio` que solo existen
 * en hábitos ya persistidos. El componente HabitsScreen renderiza `nombre`,
 * `icono` y `colorHex`, todos presentes en PredefinedHabit.
 */
export function useHabitLibrary(selectedCategories: Category[] | string[]) {
  const suggestedHabits = useMemo<PredefinedHabit[]>(() => {
    if (!selectedCategories || selectedCategories.length === 0) return [];
    return habitLibrary.filter((habit) =>
      selectedCategories.includes(habit.categoria as any)
    );
  }, [selectedCategories]);

  return { suggestedHabits };
}
