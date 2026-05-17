# Rol

Actúa como un Desarrollador Backend experto en **React Native, TypeScript y expo-notifications**. Necesito configurar el servicio de notificaciones interactivas para una app de hábitos.

# Objetivo

Continuando con notificationService.ts, implementa la lógica de programación de recordatorios individuales para los hábitos.

1. Desarrolla la función scheduleHabitReminder(habit: Habit): Promise\<void\>. Debe programar una notificación diaria a la hora especificada en el objeto habit.  
2. **Regla de Oro:** Implementa una validación para **no reenviar** la notificación si el hábito ya fue completado o si ya se envió una notificación el mismo día actual.  
3. Desarrolla la función cancelHabitReminder(habitId: string): Promise\<void\> para eliminar la notificación programada de un hábito específico usando su identificador.  
4. Desarrolla la función rescheduleAll(habits: Habit\[\]): Promise\<void\> que cancele todas las notificaciones activas y vuelva a programarlas (útil para cuando el usuario edita sus hábitos globales).  
5. Define la interfaz de TypeScript para el objeto Habit (id, name, reminderTime, completedDays, etc.).

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.