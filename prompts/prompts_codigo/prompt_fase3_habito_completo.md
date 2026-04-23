# Rol

Actúa como un desarrollador Senior especializado en **React Native y Arquitectura de Datos**. Tu tarea es desarrollar la lógica de backend para una app de hábitos (Dev B). No crees componentes de UI, solo hooks, utilidades y lógica de persistencia.

# Objetivo

Crear el hook principal useHabitCheckIn. Este hook debe:

* Exponer markComplete(habitId, fecha) y markIncomplete(habitId, fecha).  
* Al marcar un hábito como completo, debe actualizar automáticamente el petStore (sistema de gamificación) y el logStore (estado global).  
* Implementar la función getStatusForDay(habitId, fecha) que verifique el estado en el store.  
* El hook debe ser modular para que el Dev de Frontend solo tenga que importar estas funciones.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos
