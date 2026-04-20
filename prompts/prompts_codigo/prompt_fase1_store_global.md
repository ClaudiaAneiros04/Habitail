# Contexto

Actúa como un Desarrollador Senior de React Native. Vamos a desarrollar el core de un Habit Tracker paso a paso. Sigue estrictamente mi estructura de carpetas.

Estructura del Proyecto:  
db/schema.ts, store/useHabitStore.ts, app/tabs/index.tsx.

# Objetivo

Utiliza Zustand y el middleware de persist para conectar con @react-native-async-storage/async-storage.

* Crea el store useHabitStore.  
* Estado: habits: Habit\[\] (inicializado como array vacío).  
    
* Acciones:  
  * addHabit(habit): Añade un nuevo hábito.  
  * updateHabit(id, updates): Actualiza campos específicos.  
  * archiveHabit(id): Cambia el estado activo a false.  
  * removeHabit(id): Elimina el hábito del array.  
* Persistencia: Configura el store para que se guarde automáticamente en AsyncStorage bajo la clave 'habit-storage'

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos