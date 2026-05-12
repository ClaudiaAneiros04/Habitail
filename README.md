# Habitail 🌿

**Habitail** es una aplicación multiplataforma de seguimiento de hábitos que combina la gestión de tareas diarias con elementos de gamificación. El objetivo principal es motivar a los usuarios a mantener sus rutinas mediante el cuidado de una mascota virtual que crece y se mantiene saludable en función del cumplimiento de los hábitos.

### Características Principales
*   **Sistema de Gamificación**: Tu mascota tiene niveles de salud que se ven afectados por tus acciones. Completar hábitos cura y fortalece a tu mascota, mientras que los descuidos pueden debilitarla.
*   **Gestión Inteligente de Hábitos**: Configura hábitos con diferentes frecuencias (diarios, semanales o específicos) y niveles de prioridad.
*   **Seguimiento de Rachas**: Visualiza tu progreso con un motor de cálculo de rachas que distingue entre hábitos diarios y semanales, motivándote a no romper la cadena.
*   **Historial Detallado**: Un calendario interactivo que te permite auditar tu desempeño pasado y entender tus patrones de comportamiento.
*   **Rendimiento Nativo**: Construido sobre Expo y React Native, utilizando SQLite para una persistencia de datos local ultra rápida y segura.

## 🏛️ Decisiones de Arquitectura

Para garantizar la robustez y escalabilidad de Habitail, el proyecto se basa en tres pilares arquitectónicos:

### 1. Repository Pattern
La lógica de acceso a datos está desacoplada mediante repositorios, facilitando el mantenimiento y permitiendo optimizaciones de consultas SQL (como índices compuestos) de forma centralizada.
- [Detalles en la Memoria de Datos](./LEARNING.md#diseño-de-arquitectura-de-datos-y-optimización-índices-en-consultas-de-hábitos)

### 2. Motor de Frecuencias
Un motor de lógica pura que abstrae el cálculo de rachas y la programación de hábitos. Esto permite que la UI sea reactiva a reglas de negocio complejas sin duplicar lógica en los componentes.
- [Detalles en la Memoria del Motor](./LEARNING.md#1-motor-de-cálculo-de-rachas-streakcalculatorts)

### 3. Fórmula de Vida
El sistema de gamificación utiliza una fórmula matemática ponderada por la prioridad de los hábitos (Esencial, Normal, Flexible) para calcular el impacto en la salud de la mascota.
- [Detalles en la Memoria de Gamificación](./LEARNING.md#4-fórmula-final-y-decisiones-acordadas)

## 🚀 Ejecución del Proyecto

Sigue estos comandos para iniciar la aplicación en diferentes plataformas:

*   **Instalar dependencias**:
    ```bash
    npm install
    ```

*   **Iniciar Servidor Expo (Menú interactivo)**:
    ```bash
    npm run start
    ```

*   **Ejecutar en Android**:
    ```bash
    npm run android
    ```

*   **Ejecutar en iOS**:
    ```bash
    npm run ios
    ```

*   **Ejecutar en Web**:
    ```bash
    npm run web
    ```

## 📋 Requisitos de Expo

Para ejecutar este proyecto correctamente, asegúrate de cumplir con los siguientes requisitos:

1.  **Node.js**: Versión LTS recomendada.
2.  **Expo Go**: Descarga la aplicación en tu dispositivo móvil (Android/iOS) para previsualizar los cambios.
3.  **Simuladores (Opcional)**: Android Studio (para Android) o Xcode (para iOS) si prefieres ejecutar en emuladores locales.
4.  **Cuentas**: Una cuenta de Expo es recomendada para facilitar la sincronización.

## 📱 Dispositivos Compatibles

Habitail está diseñada para funcionar de manera fluida en las siguientes plataformas:

*   **Android**: Dispositivos con Android 7.0 (API 24) o superior.
*   **iOS**: iPhone y iPad con iOS 13.0 o superior.
*   **Web**: Navegadores modernos (Chrome, Safari, Firefox, Edge) con diseño totalmente responsivo.
*   **PWA**: Soporte para instalación como aplicación web progresiva para una experiencia similar a la nativa en escritorio.

## 📂 Estructura de Carpetas

A continuación, un resumen de la organización del código:

*   `app/`: Pantallas y sistema de navegación basado en archivos (Expo Router).
*   `components/`: Componentes visuales reutilizables (Botones, Items, Barras de progreso).
*   `hooks/`: Lógica de React encapsulada (ej. `useHabitCheckIn`).
*   `storage/`: Implementación de persistencia con **SQLite** y patrones de repositorio.
*   `store/`: Estado global de la aplicación gestionado con **Zustand** (Hábitos, Logs, Mascota).
*   `utils/`: Motores de lógica pura (cálculo de rachas, motor de frecuencias).
*   `constants/`: Configuración de temas, colores y constantes de diseño.
*   `types/`: Interfaces y definiciones de TypeScript para todo el proyecto.

## 🧠 Bitácora de Aprendizaje

Para detalles técnicos profundos, optimizaciones de base de datos y registro de errores resueltos, consulta nuestro:

👉 [**LEARNING.md**](./LEARNING.md)

