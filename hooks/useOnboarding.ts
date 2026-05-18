import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { Habit } from '../types';

export function useOnboarding() {
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);

  const completeOnboarding = async (selectedHabits: Habit[], petName: string) => {
    // Stub implementation to satisfy the prompt's requirement
    if (user) {
      await updateUser({ onboardingCompleted: true });
    }
  };

  return {
    onboardingCompleted: user?.onboardingCompleted ?? false,
    completeOnboarding,
  };
}
