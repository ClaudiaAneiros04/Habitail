Hito 1: Gestion de habitos

**Enfoque:** Pasar de una base de datos vacía a una herramienta donde el usuario ya pueda organizar su vida.

* **Descripción:** Implementar el formulario de creación y la lista de gestión. No hace falta que el formulario sea "multi-paso" todavía; una sola pantalla con los campos básicos (nombre, categoría, color e icono) es suficiente.  
  * Poder pulsar un botón "+", escribir un hábito y que aparezca en la lista.  
  * Poder borrar o editar ese hábito.  
  * **Lógica clave:** El "Motor de frecuencias". Si un hábito es solo para los lunes, hoy martes no debería aparecer en la pantalla de "Hoy".

Hito 2: Check-in

**Enfoque:** Lograr que la acción principal de la app (marcar como hecho) sea satisfactoria.

* **Descripción:** Crear la pantalla principal de "Hoy" donde el usuario interactúa con sus tareas diarias y recibe feedback inmediato.  
  * Lista de hábitos del día con un checkbox o botón de completar.  
  * Animación al completar (un pequeño salto del icono o cambio de color).  
  * **Cálculo de Rachas:** Que aparezca el fueguito (🔥) con el número de días seguidos al lado de cada hábito.

Hito 3: Creación de mascota

**Enfoque:** Conectar el esfuerzo del usuario con la vida de su Tamagotchi.

* **Descripción:** Implementar la pantalla de la mascota y vincular su salud al cumplimiento de los hábitos.  
  * Pantalla dedicada a la mascota con una barra de vida (0-100).  
  * Cambio de estado: Si la vida está alta, la mascota sonríe; si está baja, está triste o ausente.  
  * **Fórmula de salud:** Al completar un hábito, la vida sube. Al pasar el día sin completar, la vida baja.