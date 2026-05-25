# Rol

Actúa como un Ingeniero de Software Senior en Mobile/Backend. Necesito robustecer la lógica de negocio de nuestra app de hábitos en React Native con TypeScript, solucionando específicamente los siguientes casos borde críticos.

# Objetivo

1. Cambio de zona horaria: Implementa una solución utilizando date-fns-tz o manejo de UTC absoluto para que los cambios de zona horaria del dispositivo no rompan ni dupliquen el cálculo de las rachas.  
2. Racha con hábito semanal: Si un hábito es semanal (ej: ir al gimnasio 3 veces por semana), diseña la lógica para que la racha no se rompa en los días intermedios no activos.  
3. Apertura a las 00:01: Asegura que si el usuario abre la app justo al cambiar el día, la lógica diferencie correctamente el día que acaba de terminar del día que empieza, evitando que la mascota sea penalizada dos veces (doble decremento de vida).  
4. Evitar duplicados en notificaciones al editar: Refina la función rescheduleAll para que limpie de forma síncrona y segura los identificadores antiguos antes de programar nuevos recordatorios, eliminando la duplicidad.  
5. Permisos revocados: Añade un bloque try/catch global en el servicio que verifique silenciosamente si el usuario revocó los permisos en los ajustes del sistema, evitando que la app crashee o lance promesas rechazadas sin controlar.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.