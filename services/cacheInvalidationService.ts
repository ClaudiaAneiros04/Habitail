import { useStatsStore } from '../store/useStatsStore';
import { useHeatmapStore } from '../store/useHeatmapStore';

/**
 * Servicio centralizado de invalidación de cachés derivados.
 * 
 * Regla de consistencia: Cualquier operación que altere el estado de hábitos
 * (crear, editar frecuencia, editar días, cambiar fechas inicio/fin, archivar, reactivar, borrar)
 * o el historial de cumplimiento (completar, desmarcar, eliminar log)
 * debe invalidar los cachés de estadísticas y heatmap para evitar discrepancias.
 */
export class CacheInvalidationService {
  /**
   * Invalida las entradas de caché para un hábito específico y para la vista global.
   * Si no se especifica habitId, purga todos los cachés.
   */
  static invalidateHabitCaches(habitId?: string): void {
    if (habitId) {
      useStatsStore.getState().invalidateHabit(habitId);
      useHeatmapStore.getState().invalidate(habitId);
      // La vista global se nutre de la agregación de todos los hábitos, por lo que debe invalidarse también
      useStatsStore.getState().invalidateHabit('global');
      useHeatmapStore.getState().invalidate('global');
    } else {
      this.clearAll();
    }
  }

  /**
   * Purga la totalidad del caché de estadísticas y heatmap.
   */
  static clearAll(): void {
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();
  }
}
