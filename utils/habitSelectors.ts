import { Habit } from '../types';

/**
 * Representa una estructura de hábito optimizada para su renderizado y consumo
 * eficiente en el hilo principal (UI thread), reduciendo el tamaño del payload.
 */
export interface LightweightHabit {
  id: string;
  nombre: string;
  colorHex: string;
  icono: string;
  nivelPrioridad: string;
  activo: boolean;
  reminderTimeFormatted: string | null;
}

/**
 * Colección de hábitos procesada con metadatos estáticos y tamaños precalculados
 * para optimizar la carga del puente de React Native y mejorar el rendimiento de
 * componentes de listas masivas (como FlatList y SectionList).
 */
export interface ProcessedHabitCollection {
  /** Lista optimizada de hábitos con estructura de datos aligerada */
  items: LightweightHabit[];
  /** Tamaño total estático de la colección de hábitos */
  totalCount: number;
  /** Cantidad de hábitos en estado activo */
  activeCount: number;
  /** Cantidad de hábitos en estado inactivo o archivado */
  inactiveCount: number;
  /** Mapa estático de alturas estimadas para cada item de la lista (getItemLayout) */
  layoutHeights: {
    /** Altura fija del item en píxeles */
    itemHeight: number;
    /** Altura estimada de los separadores */
    separatorHeight: number;
  };
  /** Precalculado del listado único de categorías utilizadas en la colección */
  uniqueCategories: string[];
}

/**
 * Opciones de filtrado y procesamiento para la lista masiva de hábitos.
 */
export interface HabitProcessOptions {
  /** Filtrar sólo hábitos activos */
  onlyActive?: boolean;
  /** Altura estática del componente de celda en píxeles (default: 80) */
  customItemHeight?: number;
  /** Altura estática del separador de celda en píxeles (default: 10) */
  customSeparatorHeight?: number;
}

/**
 * Procesa y abstrae una lista de hábitos, calculando de manera síncrona
 * tamaños estáticos, estadísticas y reduciendo la complejidad del objeto.
 * Se encarga de aislar el hilo principal de cómputos pesados.
 *
 * @param habits Lista cruda de hábitos proveniente de la base de datos o store.
 * @param options Opciones para personalizar el procesamiento y layout.
 * @returns Colección precalculada lista para consumo eficiente.
 */
export function selectProcessedHabits(
  habits: Habit[],
  options: HabitProcessOptions = {}
): ProcessedHabitCollection {
  const onlyActive = options.onlyActive ?? false;
  const itemHeight = options.customItemHeight ?? 80;
  const separatorHeight = options.customSeparatorHeight ?? 10;

  // Filtrar hábitos si es necesario
  const filtered = onlyActive ? habits.filter(h => h.activo) : habits;

  // Inicializar acumuladores para precalculados de una sola pasada
  let activeCount = 0;
  let inactiveCount = 0;
  const categoriesSet = new Set<string>();

  const items: LightweightHabit[] = filtered.map(habit => {
    // Conteo rápido de estados activos/inactivos
    if (habit.activo) {
      activeCount++;
    } else {
      inactiveCount++;
    }

    if (habit.categoria) {
      categoriesSet.add(habit.categoria);
    }

    const reminderTime = habit.horaRecordatorio || habit.reminderTime || null;

    // Retornar estructura de datos ligera reduciendo la sobrecarga de serialización
    return {
      id: habit.id,
      nombre: habit.nombre || (habit as any).name || 'Hábito',
      colorHex: habit.colorHex || '#4CAF50',
      icono: habit.icono || 'leaf-outline',
      nivelPrioridad: habit.nivelPrioridad || 'NORMAL',
      activo: !!habit.activo,
      reminderTimeFormatted: reminderTime,
    };
  });

  return {
    items,
    totalCount: items.length,
    activeCount,
    inactiveCount,
    layoutHeights: {
      itemHeight,
      separatorHeight,
    },
    uniqueCategories: Array.from(categoriesSet),
  };
}

/**
 * Función de utilidad para FlatList.getItemLayout en base a los metadatos precalculados.
 * Permite evitar el cálculo dinámico de alturas en el renderizado, optimizando listas masivas.
 *
 * @param collection Colección precalculada.
 * @returns Función compatible con getItemLayout de FlatList.
 */
export function getFlatListLayout(collection: ProcessedHabitCollection) {
  const { itemHeight, separatorHeight } = collection.layoutHeights;
  const totalItemHeight = itemHeight + separatorHeight;

  return (data: any, index: number) => ({
    length: itemHeight,
    offset: totalItemHeight * index,
    index,
  });
}
