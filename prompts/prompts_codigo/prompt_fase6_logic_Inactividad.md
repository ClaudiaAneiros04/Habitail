# Rol

Actúa como un Desarrollador Backend experto en **React Native, TypeScript y expo-notifications**. Necesito configurar el servicio de notificaciones interactivas para una app de hábitos.

# Objetivo

Añade la lógica de retención por inactividad al servicio. Necesitamos motivar al usuario si deja de usar la app, usando el estado de su mascota virtual.

1. Crea una función para actualizar la propiedad lastOpenedAt (timestamp) en el almacén de datos del usuario (puedes simular un userStore). Esta función debe ejecutarse cada vez que la app pase a primer plano.  
2. Implementa una tarea o verificación de inactividad: Si el usuario **no ha abierto la app en 2 días (48 horas)**, programa una notificación especial con el estado actual de la mascota.  
3. **Restricciones estrictas:**  
   * Límite máximo de 1 notificación de mascota cada 48 horas (evitar spam).  
   * **Control de Estado:** Si la vida de la mascota es 0 (la mascota "se fue"), **no** se debe enviar ni programar esta notificación.  
4. Proporciona los mocks de datos necesarios para testear las condiciones de la mascota (salud, vida).

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.