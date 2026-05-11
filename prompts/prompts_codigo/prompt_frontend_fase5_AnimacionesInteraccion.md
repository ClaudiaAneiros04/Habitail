# Rol

Actúa como un Senior Frontend Developer experto en React Native.

# Objetivo

Ya tengo la estructura base de mi mascota (un gato) y el componente PetRenderer. Ahora necesito dotar a la UI de dinamismo y feedback visual utilizando React Native.

**1\. Transiciones de Estado (Fade In/Out):**

* Implementa una animación de transición suave cuando el estadoActual de la mascota cambie (por ejemplo, de confused a happy).  
* La imagen antigua debe desvanecerse mientras la nueva aparece, evitando saltos bruscos de imagen.

**2\. Sistema de Mensajes Dinámicos:**

* Crea un componente PetBubble (burbuja de texto o etiqueta) que aparezca cerca del gato.  
* El texto debe ser aleatorio y depender del estadoActual.  
  * *Ejemplo Happy:* "¡Me siento de maravilla\!", "¡Gracias por esforzarte\!".  
  * *Ejemplo Sad:* "Me vendría bien un poco de atención...", "Hambre...".  
* Añade una pequeña animación de "flotado" (levitación suave) a este texto.

**3\. Animación de "Hábito Completado" (El Salto):**

* Crea una función o trigger llamado onCompleteHabit.  
* Al activarse, el gato debe realizar una **animación de salto (vertical bounce)**.  
* Simultáneamente, debe aparecer un **texto flotante (Delta)** en el lugar donde se hizo clic o sobre el gato que diga \+10 ❤️ o \+XP. Este texto debe desplazarse hacia arriba y desaparecer (Fade Out \+ TranslateY).

**4\. Feedback Visual al marcar:**

* Añade un breve destello o efecto de partículas (si es posible en el framework) alrededor del gato cuando el usuario complete una tarea para reforzar la sensación de recompensa.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos