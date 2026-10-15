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
   * Si se provee userId, aisla la invalidación al usuario activo sin afectar a otros.
   * Si no se especifica habitId, purga todos los cachés.
   *
   * @param habitId - UUID del hábito afectado, o undefined para invalidar todo.
   * @param userId  - (Opcional) UUID del usuario propietario.
   */
  static invalidateHabitCaches(habitId?: string, userId?: string): void {
    if (habitId) {
      useStatsStore.getState().invalidateHabit(habitId, userId);
      useHeatmapStore.getState().invalidateHabit(habitId, userId);
      // La vista global se nutre de la agregación de todos los hábitos, por lo que debe invalidarse también
      useStatsStore.getState().invalidateHabit('global', userId);
      useHeatmapStore.getState().invalidateHabit('global', userId);
    } else {
      this.clearAll();
    }
  }

  /**
   * Invalida todas las estadísticas y heatmaps asociados a un usuario.
   * Usado cuando se cambia de usuario activo o se resetea su perfil.
   *
   * @param userId - UUID del usuario a invalidar.
   */
  static invalidateUserCaches(userId: string): void {
    useStatsStore.getState().invalidateUser(userId);
    useHeatmapStore.getState().invalidateUser(userId);
  }

  /**
   * Purga la totalidad del caché de estadísticas y heatmap en memoria.
   */
  static clearAll(): void {
    useStatsStore.getState().clearAll();
    useHeatmapStore.getState().clearAll();
  }
}

