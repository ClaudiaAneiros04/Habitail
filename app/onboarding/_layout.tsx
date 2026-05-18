import React, { createContext, useContext, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { Category } from '../../types';
import { Habit } from '../../types';
import { useOnboarding } from '../../hooks/useOnboarding';

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
  const { onboardingCompleted } = useOnboarding();

  /**
   * Todos los hooks deben llamarse antes de cualquier return condicional (regla de hooks de React).
   * El guard de redirección se evalúa DESPUÉS de declarar el estado.
   */
  const [petName, setPetName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedHabits, setSelectedHabits] = useState<Habit[]>([]);

  /**
   * Guard de redirección: si el usuario accede a cualquier ruta /onboarding/*
   * cuando ya ha completado el onboarding (ej. pulsando "atrás" en el navegador web,
   * donde router.replace no limpia el historial de URLs), se redirige
   * inmediatamente a /(tabs) sin renderizar ninguna pantalla del flujo.
   *
   * En iOS/Android nativo este caso no se da porque navigation.reset / router.replace
   * sí eliminan el stack anterior, pero en web el history del navegador persiste.
   */
  if (onboardingCompleted) {
    return <Redirect href="/(tabs)" />;
  }

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
