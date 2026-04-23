# Rol

Actúa como un desarrollador Senior especializado en **React Native y Arquitectura de Datos**. Tu tarea es desarrollar la lógica de backend para una app de hábitos (Dev B). No crees componentes de UI, solo hooks, utilidades y lógica de persistencia.

# Objetivo

Configurar las consultas históricas en el Repository:

* Implementa getLogsForRange(habitId, from, to) que devuelva un array de HabitLog\[\].  
* Escribe la sentencia SQL para crear un **índice por fecha** en la tabla de logs para optimizar estas búsquedas.  
* Crea un archivo LEARNING.md donde documentes técnicamente por qué este índice es necesario para el rendimiento de la aplicación a largo plazo.  
* Asegúrate de que las fechas se manejen de forma consistente (ISO o Timestamps).

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos
