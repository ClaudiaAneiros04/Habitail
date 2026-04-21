# Rol

Actúa como desarrollador Backend/Logic de React Native. **No toques la interfaz**, céntrate en la lógica pura y el almacenamiento.

# Objetivo

Define la interfaz Habit incluyendo:

* id: string (uuid)  
* frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'  
* frequencyConfig: datos adicionales según el tipo.  
* priority: 'Esencial' | 'Normal' | 'Flexible'  
* reminder: string | null (ISO time)

Genera el método lógico para el habitStore.addHabit() que reciba el objeto, le asigne un UUID y lo guarde.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos

# Cosas a evitar

* No crees interfaces de usuario, solo la lógica de TypeScript y los tests.