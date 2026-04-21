# Rol

Actúa como desarrollador Backend/Logic de React Native. **No toques la interfaz**, céntrate en la lógica pura y el almacenamiento.

# Objetivo

Crear una función pura y robusta: getHabitsForToday(habits: Habit\[\], date: Date): Habit\[\] en la carpeta utils en un archivo llamado frequencyEngine.ts

* **Lógica de filtrado:**  
  * DAILY: Siempre incluido.  
  * WEEKLY: Solo si date.getDay() coincide con los días seleccionados (0-6).  
  * MONTHLY: Solo si date.getDate() coincide con el día del mes.  
* **Tests Unitarios:** Escribe 5 tests con **Jest** que cubran: un hábito diario, un hábito semanal que debe aparecer hoy, uno semanal que NO debe aparecer hoy, un hábito mensual y una lista vacía.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos