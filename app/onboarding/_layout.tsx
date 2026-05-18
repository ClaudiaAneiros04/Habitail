import React, { createContext, useContext, useState } from 'react';
import { Stack } from 'expo-router';
import { Category } from '../../types'; // Assuming Category exists, else just string
import { Habit } from '../../types'; // Assuming Habit exists

export interface OnboardingContextType {
  petName: string;
  setPetName: (name: string) => void;
  selectedCategories: Category[];
  setSelectedCategories: (categories: Category[]) => void;
  selectedHabits: Habit[];
  setSelectedHabits: (habits: Habit[]) => void;
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboardingFlow = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingFlow must be used within OnboardingLayout');
  }
  return context;
};

export default function OnboardingLayout() {
  const [petName, setPetName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<Habit[]>([]);

  return (
    <OnboardingContext.Provider
      value={{
        petName,
        setPetName,
        selectedCategories,
        setSelectedCategories,
        selectedHabits,
        setSelectedHabits,
      }}
    >
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="habits" />
      </Stack>
    </OnboardingContext.Provider>
  );
}
