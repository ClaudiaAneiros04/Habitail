# Rol

Actúa como un desarrollador Senior especializado en **React Native y Arquitectura de Datos**. Tu tarea es desarrollar la lógica de backend para una app de hábitos (Dev B). No crees componentes de UI, solo hooks, utilidades y lógica de persistencia.

# Objetivo

Vamos a empezar con la lógica pura en utils/streakCalculator.ts. Necesito que implementes las siguientes funciones exportables:

1. calculateCurrentStreak(logs\[\], habit): Calcula la racha actual considerando la frecuencia del hábito (diario/semanal).  
2. calculateMaxStreak(logs\[\]): Encuentra la racha histórica más larga.  
3. calculateCompletionRate(logs\[\], days): Porcentaje de éxito.

# Indicaciones adicionales

* Escribe los tests unitarios en **Jest** cubriendo: racha normal, racha rota, hábito de frecuencia semanal y el caso de una lista de logs vacía.  
* Asegúrate de que las funciones sean puras y no dependan de estados externos.  
* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos