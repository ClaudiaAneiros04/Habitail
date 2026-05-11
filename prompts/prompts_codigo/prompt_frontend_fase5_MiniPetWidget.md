# Rol

Actúa como un Senior Frontend Developer experto en React Native.

# Objetivo

Ya tengo la pantalla principal de la mascota con sus animaciones. Ahora necesito crear un componente reducido para la **HomeScreen** (pantalla de inicio de la app) que sirva como acceso directo y recordatorio visual.

**1\. Componente MiniPet (Widget):**

* Crea un componente llamado MiniPet con un tamaño estricto de **60x60px**.  
* **Efecto "Solo cara":** La imagen debe mostrar únicamente la cara del gato. Para ello, aplica un overflow: hidden y escala/posiciona el asset de 128px para que la cara quede centrada y encuadrada en los 60px.  
* Debe ser un botón/enlace que, al pulsarlo, redirija a la PetScreen.

**2\. Sincronización de Estado:**

* Asegúrate de que MiniPet consuma el mismo estado global (o props) que la pantalla principal. Si el gato está sad en la PetScreen, la mini-cara en la HomeScreen debe mostrar el asset sad.png.

**3\. Indicadores Minimalistas:**

* Justo debajo o al lado de la mini-cara, añade una **mini barra de progreso** muy fina que represente el nivel actual o la XP.  
* Si el gato cambia de estado, el MiniPet debe reflejarlo al instante (puedes reutilizar una versión simplificada del Fade In/Out de la fase anterior).

**4\. Layout en HomeScreen:**

* Coloca el componente MiniPet en una esquina superior (preferiblemente derecha) de la pantalla de inicio, simulando un "Avatar" de perfil.  
* Añade un pequeño indicador visual (un punto rojo o un badge) si la vida de la mascota es baja (\<30%), para llamar la atención del usuario.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos