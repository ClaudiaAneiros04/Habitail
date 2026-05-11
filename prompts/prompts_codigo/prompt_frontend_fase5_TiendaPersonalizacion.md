# Rol

Actúa como un Senior Frontend Developer experto en React Native.

# Objetivo

Ya tengo la mascota funcional y su widget. Ahora necesito desarrollar la **ShopScreen** (Tienda) para que el usuario pueda personalizar su gato. Usa React Native.

**1\. Estructura de la Tienda (Tabs):**

* Crea una interfaz con **Tabs (pestañas)** en la parte superior para navegar entre dos categorías: "Skins" (Pelajes) y "Accesorios".  
* Muestra de forma destacada el **Saldo de Puntos** del usuario en la cabecera de la tienda.

**2\. Componente ShopItem (Tarjeta de producto):**

* Crea una grid (rejilla) de tarjetas que contengan:  
  * **Preview:** Imagen del ítem (buscando en assets/pet/skins/ o assets/pet/accessories/).  
  * **Precio:** Etiqueta con el coste en puntos.  
  * **Botón de acción:** Debe cambiar dinámicamente según el estado:  
    * Si no se posee: **"Comprar"**.  
    * Si se posee pero no está puesto: **"Equipar"**.  
    * Si ya lo lleva puesto: **"Equipado"** (deshabilitado o con un check visual).

**3\. Lógica de Ítem Bloqueado:**

* Si el usuario **no tiene puntos suficientes** para un ítem, la tarjeta debe mostrarse con un estado "Bloqueado":  
  * Aplica un filtro de escala de grises o una opacidad reducida.  
  * Muestra un icono de candado o pon el precio en rojo.  
  * El botón de compra debe estar deshabilitado.

**4\. Preview en tiempo real:**

* Al pulsar en un ítem (antes de comprar), muestra una pequeña previsualización de cómo le quedaría al gato en una miniatura central antes de confirmar la acción.

**5\. Persistencia Visual:**

* Asegúrate de que al hacer clic en "Equipar", el estado global de la mascota se actualice para que, al volver a la PetScreen, el gato ya aparezca con su nueva skin o accesorio.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables.  
* Comenta bastante los metodos.