import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Stack, Redirect, useRouter, usePathname } from 'expo-router';
import { Category } from '../../types';
import { Habit } from '../../types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { fadeScale } from '../../navigation/transitions';
import { useOnboardingStore } from '../../store/useOnboardingStore';

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
  const router = useRouter();
  const pathname = usePathname();

  const petName = useOnboardingStore((state) => state.petName);
  const setPetName = useOnboardingStore((state) => state.setPetName);
  const selectedCategories = useOnboardingStore((state) => state.selectedCategories);
  const setSelectedCategories = useOnboardingStore((state) => state.setSelectedCategories);
  const selectedHabits = useOnboardingStore((state) => state.selectedHabits);
  const setSelectedHabits = useOnboardingStore((state) => state.setSelectedHabits);
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const setStep = useOnboardingStore((state) => state.setStep);
  const isLoaded = useOnboardingStore((state) => state.isLoaded);
  const loadProgress = useOnboardingStore((state) => state.loadProgress);

  const restoredRef = useRef(false);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    if (!isLoaded || onboardingCompleted || restoredRef.current) return;

    restoredRef.current = true;
    if (currentStep && currentStep !== '/onboarding/welcome' && currentStep.startsWith('/onboarding/')) {
      if (pathname === '/onboarding' || pathname === '/onboarding/welcome') {
        setTimeout(() => {
          router.replace(currentStep as any);
        }, 0);
      }
    }
  }, [isLoaded, onboardingCompleted, currentStep, pathname, router]);

  useEffect(() => {
    if (isLoaded && pathname && pathname.startsWith('/onboarding/')) {
      setStep(pathname);
    }
  }, [pathname, isLoaded, setStep]);

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
        selectedHabits: selectedHabits as unknown as Habit[],
        setSelectedHabits: setSelectedHabits as any,
      }}
    >
      <Stack screenOptions={{ headerShown: false, ...fadeScale() }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="habits" />
      </Stack>
    </OnboardingContext.Provider>
  );
}
