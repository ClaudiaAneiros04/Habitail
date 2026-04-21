# Diario de Aprendizaje y Decisiones Técnicas (LEARNING.md)

## Optimización de Consultas SQlite para Consultas Históricas

Al implementar la función `getLogsForRange` en `LogRepository.ts`, nos dimos cuenta de que la recuperación de registros históricos (HabitLogs) entre dos fechas se volvería lenta a medida que los usuarios registraran datos diariamente a lo largo del tiempo. 

Para resolver este problema de rendimiento, decidimos optimizar las consultas a nivel de almacenamiento usando **índices de SQLite**.

### Índice Propuesto

```sql
CREATE INDEX idx_habit_logs_habitId_fecha ON habit_logs (habitId, fecha);
```

### ¿Por qué se eligió y cómo beneficia al rendimiento?

1. **Evita Escaneos Secuenciales (Table Scan):**
   Sin índice, cuando ejecutamos un `SELECT * FROM habit_logs WHERE habitId = ? AND fecha >= ? AND fecha <= ?`, SQLite debe escanear todas las filas de la tabla verificando las condiciones. Con el índice, SQLite emplea un árbol B (B-Tree), donde los datos ya están estructurados y ordenados primero por `habitId` y luego por `fecha`. Puede saltar directamente a los registros de ese `habitId` y buscar dentro del sub-rango de `fecha`, realizando una búsqueda logarítmica O(log N) en lugar de O(N).

2. **Ordenamiento Gratuito (`ORDER BY fecha`):**
   El índice multi-columna organiza intrínsecamente los registros usando `habitId` primariamente, y `fecha` secundariamente. Dado que nuestra consulta incluye un `ORDER BY fecha ASC`, SQLite puede recuperar las filas en el orden ya establecido en el índice y evitar un costoso paso de ordenación en memoria posterior a la búsqueda. 

3. **Eficiencia en Rango de Fechas:**
   Los índices compuestos funcionan mejor cuando la primera columna es usada para igualdad (`habitId = ?`) y la segunda para un rango (`fecha >= ? AND fecha <= ?`). Esto permite que SQLite acote drásticamente el espacio de búsqueda devolviendo subconjuntos precisos e inmediatos para la graficación y análisis de consistencias y rachas de la aplicación.
