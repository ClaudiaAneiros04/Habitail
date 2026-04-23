# Rol

Actúa como un desarrollador Senior especializado en **React Native y Arquitectura de Datos**. Tu tarea es desarrollar la lógica de backend para una app de hábitos (Dev B). No crees componentes de UI, solo hooks, utilidades y lógica de persistencia.

# Objetivo

Añadir la lógica de interacción al hook useHabitCheckIn sin crear componentes visuales:

* Crea un valor animado (Animated.value) y una función que ejecute un Animated.spring (efecto Bounce) que el frontend pueda consumir al completar un hábito.  
* Implementa la lógica 'All Tasks Done': si al completar un hábito, todos los hábitos del día están listos, devuelve un trigger o estado shouldLaunchConfetti para activar react-native-confetti-cannon.  
* Expón un valor de 'progreso diario' calculado en tiempo real para alimentar una barra de progreso."

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos