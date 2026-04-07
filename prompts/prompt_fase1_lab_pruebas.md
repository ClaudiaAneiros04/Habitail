# Contexto

Actúa como un Desarrollador Senior de React Native. Vamos a desarrollar el core de un Habit Tracker paso a paso. Sigue estrictamente mi estructura de carpetas.

Estructura del Proyecto:  
db/schema.ts, store/useHabitStore.ts, app/tabs/index.tsx.

# Objetivo

Modifica la pantalla principal para que sirva de laboratorio de pruebas:

1. Implementa un useEffect que verifique si los datos se están cargando correctamente desde el store.  
2. Crea una función testStorage() que:  
   * Añada un hábito de prueba.  
   * Lea los hábitos actuales.  
   * Elimine un hábito.  
3. Renderiza una interfaz simple (sin estilos complejos) con botones para ejecutar estas acciones y una lista que muestre el JSON.stringify de los hábitos en pantalla para confirmar que el CRUD funciona.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos