import { useState, useEffect } from 'react';
import { Habit } from '../types';

export function useHabitLibrary(selectedCategories: string[]) {
  const [suggestedHabits, setSuggestedHabits] = useState<Habit[]>([]);

  useEffect(() => {
    // Stub implementation
    setSuggestedHabits([]);
  }, [selectedCategories]);

  return { suggestedHabits };
}
