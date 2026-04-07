# Contexto

 Estoy desarrollando una app de seguimiento de hábitos usando **Expo Router** y **TypeScript**. La estructura de carpetas ya está creada y las dependencias instaladas. Necesito implementar la navegación por pestañas (Tabs) y la estructura base de las pantallas principales.

**Mi estructura de archivos es:**

* app/\_layout.tsx (Root layout)  
* app/(tabs)/\_layout.tsx (Tab navigation layout)  
* app/(tabs)/index.tsx (Pantalla: Hoy)  
* app/(tabs)/habits.tsx (Pantalla: Hábitos)  
* app/(tabs)/stats.tsx (Pantalla: Stats)  
* app/(tabs)/profile.tsx (Pantalla: Mascota/Perfil)  
* constants/colors.ts (Sistema de diseño)

# Objetivo

Generar el código funcional para estos archivos siguiendo estas directrices:

1. **Tematización:** Define en constants/colors.ts una paleta de colores moderna (Primary, Background, Surface, Text, Accent). Usa estos colores en los layouts.  
2. **Root Layout (app/\_layout.tsx):** Implementa el Stack principal. Asegúrate de que cargue correctamente los componentes de Expo Router y maneje el área segura (Safe Area).  
3. **Tabs Layout (app/(tabs)/\_layout.tsx):** Configura el Tabs navigator.  
   * Las pestañas deben tener iconos (usa @expo/vector-icons, por ejemplo Ionicons).  
   * Nombres de las etiquetas: **"Hoy"**, **"Mis Hábitos"**, **"Estadísticas"** y **"Mascota"**.  
   * Aplica estilos de color activo/inactivo usando los valores de constants/colors.ts.  
4. **Screens:** Genera un componente básico para cada archivo dentro de (tabs)/. Cada pantalla debe mostrar un título centrado y usar un View que respete los márgenes del dispositivo.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos  

# Cosas a evitar

No instales librerías nuevas. Usa exclusivamente **Expo Router**. El código debe ser TypeScript estricto.