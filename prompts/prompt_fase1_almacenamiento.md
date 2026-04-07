# Contexto

Actúa como un Desarrollador Frontend Senior experto en React Native y TypeScript. Vamos a implementar la capa de datos de una App de Gestión de Hábitos. En esta primera fase, nos centraremos exclusivamente en la definición de modelos y en una prueba de humo de persistencia local.

# Objetivo

Definir los modelos de datos y verificar que la persistencia básica funciona.

1. Crea src/types/habit.ts. Define las interfaces:  
   * **Habit:** id, userId, nombre, descripcion, categoria, icono, color, frecuencia, diasSemana (number\[\]), horaRecordatorio, tipVerificacion (check/timer/cantidad), nivelPrioridad (low/medium/high), fechaInicio, fechaFin, activo.  
   * **HabitLog:** id, habitId, userId, fecha (YYYY-MM-DD), completado (boolean), nota, timestampRegistro.  
2. Crea una pantalla de debug src/screens/DebugStorage.tsx para realizar pruebas manuales de CRUD (Guardar/Leer/Borrar) en el almacenamiento local y verificar que los datos persisten al recargar la app.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos 