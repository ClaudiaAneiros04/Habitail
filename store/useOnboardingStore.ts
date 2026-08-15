import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../types';
import { PredefinedHabit } from '../data/habitLibrary';

export const ONBOARDING_STORAGE_KEY = '@habitail_onboarding_progress';

interface OnboardingPersistedData {
  currentStep: string;
  petName: string;
  selectedCategories: Category[];
  selectedHabits: PredefinedHabit[];
}

export interface OnboardingState extends OnboardingPersistedData {
  isLoaded: boolean;
  setStep: (step: string) => void;
  setPetName: (name: string) => void;
  setSelectedCategories: (categories: Category[]) => void;
  setSelectedHabits: (habits: PredefinedHabit[]) => void;
  loadProgress: () => Promise<void>;
  reset: () => Promise<void>;
}

const DEFAULT_STATE: OnboardingPersistedData = {
  currentStep: '/onboarding/welcome',
  petName: '',
  selectedCategories: [],
  selectedHabits: [],
};

const persistState = async (data: OnboardingPersistedData) => {
  try {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[OnboardingStore] Error guardando progreso temporal:', error);
  }
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...DEFAULT_STATE,
  isLoaded: false,

  setStep: (step: string) => {
    set({ currentStep: step });
    const { petName, selectedCategories, selectedHabits } = get();
    persistState({ currentStep: step, petName, selectedCategories, selectedHabits });
  },

  setPetName: (petName: string) => {
    set({ petName });
    const { currentStep, selectedCategories, selectedHabits } = get();
    persistState({ currentStep, petName, selectedCategories, selectedHabits });
  },

  setSelectedCategories: (selectedCategories: Category[]) => {
    set({ selectedCategories });
    const { currentStep, petName, selectedHabits } = get();
    persistState({ currentStep, petName, selectedCategories, selectedHabits });
  },

  setSelectedHabits: (selectedHabits: PredefinedHabit[]) => {
    set({ selectedHabits });
    const { currentStep, petName, selectedCategories } = get();
    persistState({ currentStep, petName, selectedCategories, selectedHabits });
  },

  loadProgress: async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          currentStep: parsed.currentStep || DEFAULT_STATE.currentStep,
          petName: parsed.petName || DEFAULT_STATE.petName,
          selectedCategories: Array.isArray(parsed.selectedCategories) ? parsed.selectedCategories : [],
          selectedHabits: Array.isArray(parsed.selectedHabits) ? parsed.selectedHabits : [],
          isLoaded: true,
        });
        return;
      }
    } catch (error) {
      console.warn('[OnboardingStore] Error cargando progreso temporal:', error);
    }
    set({ isLoaded: true });
  },

  reset: async () => {
    set({ ...DEFAULT_STATE, isLoaded: true });
    try {
      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch (error) {
      console.error('[OnboardingStore] Error limpiando progreso temporal:', error);
    }
  },
}));
