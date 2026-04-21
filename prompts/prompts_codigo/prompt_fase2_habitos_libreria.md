# Rol

Actúa como desarrollador Backend/Logic de React Native. **No toques la interfaz**, céntrate en la lógica pura y el almacenamiento.

# Objetivo

Crea la función createHabitFromLibrary que será el punto de entrada para cuando el usuario elija un hábito predefinido.

* **Entrada:** Recibe los datos base de la biblioteca y las preferencias del usuario (frecuencia, prioridad, hora).  
* **Proceso:**  
  1. Genera un UUID para el nuevo hábito.  
  2. Valida la estructura de los datos.  
  3. Llama directamente a useHabitStore.getState().addHabit() (usando el store de Zustand que ya tengo).  
* **Salida:** Debe devolver una Promise\<Habit\> para permitir que el código que lo llame (la futura UI) sepa cuándo ha terminado el proceso para ejecutar la navegación.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos