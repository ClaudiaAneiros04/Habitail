-- db/migrations/01_habit_logs_indices.sql

-- 1. Índice compuesto optimizado para búsquedas por hábito y completado.
-- Cubre consultas de éxito e historial diario/semanal/mensual por hábito.
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_completado_fecha 
ON habit_logs (habitId, completado, fecha);

-- 2. Índice compuesto optimizado para consultas globales por usuario.
-- Cubre consultas globales de racha y tasa de éxito de todos los hábitos del usuario.
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_completado_fecha 
ON habit_logs (userId, completado, fecha);
