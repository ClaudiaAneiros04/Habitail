# Rol

Actúa como un Desarrollador Backend experto en **React Native, TypeScript y expo-notifications**. Necesito configurar el servicio de notificaciones interactivas para una app de hábitos.

# Objetivo

1. Crea el archivo src/notifications/notificationService.ts.  
2. Define y configura una categoría de notificación llamada HABIT\_REMINDER.  
3. Esta categoría debe tener dos acciones interactivas:  
   * **Acción DONE ("Hecho"):** Al presionarse, debe ejecutar una función que marque el hábito como completado sin abrir la aplicación.  
   * **Acción SNOOZE ("Posponer"):** Al presionarse, debe reprogramar la notificación para dentro de 30 minutos (con un límite de 1 vez por día).  
4. Configura el NotificationHandler básico para definir cómo se comportan las notificaciones cuando la app está en primer plano (foreground).  
5. Deja marcados los placeholders/comentarios donde se conectaría con el estado global (ej: Zustand o Redux) para actualizar los datos del hábito.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.