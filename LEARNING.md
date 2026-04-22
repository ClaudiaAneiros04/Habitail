# Diseño de Arquitectura de Datos y Optimización: Índices en Consultas de Hábitos

## Contexto Técnico

En el desarrollo de **Habitail**, la tabla `habit_logs` registra todas las interacciones de los usuarios con sus hábitos (check-ins, valores, notas). Con el paso del tiempo, un usuario activo generará miles de registros. 

Para features de UI como **gráficos de progreso**, **estadísticas de rachas**, o un **calendario histórico**, es necesario extraer todos los logs vinculados a un hábito concreto en un rango de fechas delimitado. Esto lo realizamos a través de la función `getLogsForRange(habitId, from, to)` en nuestro `LogRepository`.

## La Solución a Largo Plazo: Índice Compuesto

A nivel de base de datos se ha introducido la siguiente instrucción SQL para optimizar las consultas históricas:

```sql
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);
```

Las fechas se persisten siempre basándonos en un formato consistente e ISO-compatible (ej. ISO 8601 `YYYY-MM-DD` o Timestamp ISO). Gracias a ello, la BD puede tratar las fechas como cadenas alfanuméricas predecibles lexicográficamente para evaluar operadores de rango `>` o `<`.

### Beneficios para el Rendimiento a Lleno Pulmón

1. **Eficiencia algorítmica (B-Tree frente a Full Scan):**
   Al no disponer de un índice, calcular las rachas del último mes obliga a SQLite a realizar un **Full Table Scan** [O(N)] leyendo toda la tabla de `habit_logs` filtrando cada fila, lo cual escalará terriblemente a los 6 meses de uso del usuario.
   El índice B-Tree creado permite ubicar a coste logarítmico **O(log N)** primero el nodo correspondiente al `habitId`, y después navegar por sus rangos de `fecha` sin leer bloques de disco innecesarios de la BD.

2. **Ordenamiento de bajo coste (Index-based Sorting):**
   Nuestra consulta utiliza un `ORDER BY fecha ASC`. Un índice multi-columna en SQLite ordena *ya físicamente* las entradas por los campos especificados de izquierda a derecha. Es decir, los registros para un `habitId` ya están intrínsecamente ordenados por fecha en el propio índice. La consulta se ahorra consumir memoria o tiempo de CPU adicional en un *Temp B-Tree* de SQLite para el ordenado post-filtrado.

3. **Prevención de colas de I/O en UI:**
   A nivel de frontend en React Native, los cuellos de botella en la renderización se suelen originar al bloquear el puente o cuando las lecturas de almacenamiento lento en local retrasan la hidratación de hooks (ej: los cálculos en uso de rachas y estadísticas). Acceder por índices previene lags visuales considerables y mejora la UX/UI al montar componentes de gráficas.

## Reglas de Arquitectura

Para mantener la eficacia de esta estrategia:
* Nunca insertar fechas en formatos localizados (ej: `DD-MM-YYYY` no es lexicográficamente ordenable de manera natural, rompería el rango en SQLite).
* El filtrado en DB es prioritario sobre el filtrado en arrays en TS. El `LogRepository` entrega sólo el rango que se necesita pintar.
