import { Habit, SuggestedHabit, VerificationType, Priority, Frequency } from '../types';
import { useHabitStore } from '../store/useHabitStore';

/**
 * Preferencias del usuario requeridas para instanciar un hábito de la biblioteca.
 */
export interface UserHabitPreferences {
  userId: string;
  frecuencia: Frequency | string;
  diasSemana?: number[];
  nivelPrioridad: Priority | string;
  horaRecordatorio?: string;
  colorHex?: string;
  tipoVerificacion?: VerificationType | string;
}

/**
 * Función auxiliar que genera un identificador UUID v4.
 * Funciona como un polyfill simple compatible de forma segura con React Native.
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Genera un nuevo hábito a partir de un hábito sugerido (SuggestedHabit) de la biblioteca,
 * aplicando las preferencias del usuario y guardándolo en el store de Zustand.
 * 
 * @param libraryHabit - Datos base sugeridos de la biblioteca.
 * @param preferences - Configuración seleccionada por el usuario (frecuencia, prioridad, etc.).
 * @returns Promesa que se resuelve con el hábito final instanciado correctamente.
 */
export const createHabitFromLibrary = (
  libraryHabit: SuggestedHabit,
  preferences: UserHabitPreferences
): Promise<Habit> => {
  return new Promise((resolve, reject) => {
    try {
      // 1. Validar la estructura mínima de los datos base
      if (!libraryHabit || !libraryHabit.nombre || !libraryHabit.categoria) {
        throw new Error('Datos de la biblioteca inválidos. Faltan propiedades base (nombre o categoría).');
      }

      if (!preferences || !preferences.userId) {
        throw new Error('Preferencias de usuario inválidas. Falta el userId.');
      }

      if (!preferences.frecuencia) {
        throw new Error('Preferencias de usuario inválidas. Falta definir la frecuencia.');
      }

      if (!preferences.nivelPrioridad) {
        throw new Error('Preferencias de usuario inválidas. Falta definir el nivel de prioridad.');
      }

      // 2. Generar un UUID único para el nuevo hábito
      const newHabitId = generateUUID();

      // Configurar defaults lógicos para propiedades opcionales faltantes
      const colorDefault = preferences.colorHex || '#4CAF50'; 
      const diasSemana = preferences.diasSemana || [1, 2, 3, 4, 5, 6, 7]; // Por defecto asume todos los días
      const tipoVerif = preferences.tipoVerificacion || VerificationType.BOOLEAN;

      // Ensamblar el nuevo hábito combinando ambas fuentes
      const newHabit: Habit = {
        id: newHabitId,
        userId: preferences.userId,
        nombre: libraryHabit.nombre,
        descripcion: libraryHabit.descripcion,
        categoria: libraryHabit.categoria,
        icono: libraryHabit.icono,
        colorHex: colorDefault,
        frecuencia: preferences.frecuencia,
        diasSemana: diasSemana,
        horaRecordatorio: preferences.horaRecordatorio,
        tipoVerificacion: tipoVerif,
        nivelPrioridad: preferences.nivelPrioridad,
        fechaInicio: new Date().toISOString(), // Empieza en el momento exacto de la creación
        activo: true, // El hábito nace activo por defecto
      };

      // 3. Llamar directamente al store de Zustand que ya maneja el estado y la persistencia (AsyncStorage)
      useHabitStore.getState().addHabit(newHabit);

      // Devolvemos el hábito completo tras crearlo y guardarlo 
      // de forma que la UI pueda saber que el proceso terminó para navegar (ej: router.push('/home'))
      resolve(newHabit);
    } catch (error) {
      reject(error);
    }
  });
};
