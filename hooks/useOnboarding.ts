import { useUserStore } from '../store/useUserStore';
import { useHabitStore } from '../store/useHabitStore';
import { PredefinedHabit } from '../data/habitLibrary';
import { Habit, VerificationType } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOnboardingStatus } from '../services/onboardingService';

export function useOnboarding() {
  const user = useUserStore((state) => state.user);

  /**
   * Finaliza el onboarding del usuario realizando las siguientes acciones concurrentemente:
   * 1. Persiste el flag onboardingCompleted como true en AsyncStorage y el UserStore.
   * 2. Guarda el nombre elegido para la mascota (@pet_name) en AsyncStorage para consumo del perfil/mascota.
   * 3. Mapea e inserta cada uno de los hábitos seleccionados en el store y base de datos (SQLite).
   *
   * @param selectedHabits Colección de hábitos predefinidos que el usuario dejó seleccionados en la pantalla 3.
   * @param petName Nombre de la mascota introducido por el usuario en la pantalla 1.
   */
  const completeOnboarding = async (selectedHabits: PredefinedHabit[], petName: string) => {
    try {
      const userId = user?.id || 'default-user';

      // 1. Guardar el nombre de la mascota en AsyncStorage
      if (petName && petName.trim().length >= 2) {
        await AsyncStorage.setItem('@pet_name', petName.trim());
        console.log(`[useOnboarding] Nombre de mascota "${petName.trim()}" guardado en AsyncStorage.`);
      }

      // 2. Mapear y añadir cada uno de los hábitos seleccionados
      if (selectedHabits && selectedHabits.length > 0) {
        const habitStore = useHabitStore.getState();
        console.log(`[useOnboarding] Iniciando inserción de ${selectedHabits.length} hábitos en SQLite.`);
        
        for (const habit of selectedHabits) {
          const habitData: Omit<Habit, 'id'> = {
            userId,
            nombre: habit.nombre,
            descripcion: habit.descripcion,
            categoria: habit.categoria,
            icono: habit.icono,
            colorHex: habit.colorHex,
            frecuencia: habit.frecuencia,
            // Inicialización por defecto para hábitos de onboarding
            diasSemana: [1, 2, 3, 4, 5, 6, 7],
            horaRecordatorio: '09:00',
            tipoVerificacion: VerificationType.BOOLEAN,
            nivelPrioridad: habit.nivelPrioridad,
            fechaInicio: new Date().toISOString(),
            activo: true,
          };
          
          await habitStore.addHabit(habitData);
          console.log(`[useOnboarding] Hábito "${habit.nombre}" creado exitosamente.`);
        }
      }

      // 3. Establecer el estado del onboarding como completado (persiste en AsyncStorage y UserStore)
      await setOnboardingStatus(true);
      console.log('[useOnboarding] Onboarding completado y sincronizado con éxito.');
    } catch (error) {
      console.error('[useOnboarding] Error durante la finalización del onboarding:', error);
      throw new Error('No se pudo finalizar el flujo de onboarding.');
    }
  };

  return {
    onboardingCompleted: user?.onboardingCompleted ?? false,
    completeOnboarding,
  };
}
