# Rol

Actúa como un experto en optimización de rendimiento en React Native y SQLite (usando expo-sqlite). Necesito optimizar la persistencia y el renderizado de la lista de hábitos.

# Objetivo

1. Estructura e Indexación: Diseña el script de migración SQL para la tabla de habit\_logs. Crea índices compuestos (CREATE INDEX) que optimicen las búsquedas por habit\_id y completion\_date.  
2. Optimización de Queries: Escribe las consultas SQL utilizando agregaciones eficientes para calcular la racha actual y la tasa de éxito (7d/30d). Incluye ejemplos de cómo evaluar estas queries usando la sentencia EXPLAIN QUERY PLAN para asegurar que el motor de la base de datos realice un Index Scan/Seek en lugar de un Table Scan de tiempo $O(n)$.  
3. Gestión de Memoria: Implementa un mecanismo de paginación o carga por lotes (Data Chunking) en los métodos del repositorio para que la app no cargue los 1000+ logs en la memoria RAM de golpe, sino únicamente los datos requeridos para los cálculos estadísticos activos.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.