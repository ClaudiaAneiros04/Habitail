# Rol

Actúa como Desarrollador de Arquitectura Mobile. Necesito programar las funciones de control para coordinar el estado de la aplicación con el sistema de notificaciones de Expo de forma segura.

# Objetivo

1. Desduplicación Síncrona: Refina la función lógica rescheduleAllNotifications(habits). Antes de iterar y agendar nuevos recordatorios, debe limpiar el stack de triggers del sistema de manera determinista utilizando promesas nativas (Promise.all), resolviendo el bug de alertas duplicadas al editar configuraciones en caliente.  
2. Manejador de Excepciones de Permisos: Implementa un wrapper o envoltorio de seguridad en el servicio de notificaciones. Si un usuario revoca los permisos a nivel de sistema operativo (iOS/Android), el sistema debe capturar el estado silenciosamente via código, deshabilitar las llamadas automáticas de agendamiento en el store y evitar lanzar excepciones no controladas.  
3. Lógica de Abstracción de Datos: Define la firma de los selectores o funciones encargadas de procesar listas masivas de hábitos antes de enviarlas al hilo principal, preparando las colecciones para que puedan ser consumidas eficientemente (con tamaños estáticos precalculados).

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.