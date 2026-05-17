# Rol

Actúa como un Desarrollador Backend experto en **React Native, TypeScript y expo-notifications**. Necesito configurar el servicio de notificaciones interactivas para una app de hábitos.

# Objetivo

Diseña la lógica de negocio para el flujo de Onboarding y la inicialización de la base de datos local.

1. Utiliza AsyncStorage para manejar el flag onboardingCompleted.  
2. Escribe una función de control de flujo para el enrutador (RootNavigator conceptual) que determine:  
   * Si onboardingCompleted es false, redirige al flujo de Onboarding.  
   * Si es true, salta directo a la aplicación principal.  
3. Implementa la lógica de selección de hábitos del Onboarding:  
   * El usuario elije ciertas categorías de una librería predefinida (habitLibrary).  
   * Crea una función que filtre la librería y **cree automáticamente** los hábitos correspondientes dentro del Store del usuario.  
   * Al finalizar con éxito, cambia el flag onboardingCompleted a true en AsyncStorage.  
4. Asegura que todo el código esté fuertemente tipado en TypeScript.

# Indicaciones adicionales

* Usa TypeScript estricto.  
* Crea metodos y ficheros con responsabilidades y tamaños razonables  
* Comenta bastante los metodos.