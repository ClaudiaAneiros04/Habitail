# Habitail 🌿

**Habitail** es una aplicación multiplataforma de seguimiento de hábitos que combina la gestión de rutinas diarias con elementos atractivos de gamificación. El objetivo principal es motivar a los usuarios a mantener sus hábitos mediante el cuidado de una mascota virtual "pixel-art" que evoluciona y se mantiene saludable en función del cumplimiento de las tareas.

![Habitail App](assets/icon.png)

## 🌟 Características Principales (MVP Finalizado)

*   **Sistema de Gamificación y Mascota Virtual**: Tu mascota tiene niveles de salud que responden a tus acciones. Completar hábitos esenciales cura y fortalece a tu mascota (+20 HP), mientras que la inactividad la debilita.
*   **Biblioteca de Hábitos y Onboarding Inteligente**: Más de 20 hábitos predefinidos agrupados por categorías (Salud, Deporte, Productividad). Un flujo de onboarding intuitivo sugiere hábitos y establece configuraciones óptimas automáticamente.
*   **Gestión Flexible de Hábitos**: Crea, edita y archiva hábitos con diferentes frecuencias (diarios, semanales) y niveles de prioridad (Esencial, Normal, Flexible).
*   **Motor de Rachas y Estadísticas Avanzadas**: Motor matemático que calcula la racha actual y máxima, con un *Heatmap* de cumplimiento mensual estilo GitHub y gráficos de barras interactivos.
*   **Logros e Insignias Premium**: Desbloquea más de 20 logros interactivos categorizados por rareza (Común a Legendario) a medida que cumples hitos de rachas y consistencia.
*   **Notificaciones Interactivas Nativas**: Recibe recordatorios en segundo plano con acciones rápidas ("Hecho", "Posponer") que actualizan el estado global sin abrir la app.
*   **Rendimiento y Persistencia Offline**: Construido sobre **Expo** y **React Native**, utilizando **Zustand** para la gestión de estado y **SQLite** nativo con índices compuestos para consultas ultrarrápidas y disponibilidad offline total.
*   **Internacionalización (i18n)**: Soporte completo en Español e Inglés.

---

## 🏛️ Decisiones de Arquitectura

Para garantizar la robustez, Habitail implementa patrones arquitectónicos avanzados:

1.  **Repository Pattern & SQLite Singleton**: Desacopla la lógica de persistencia de la UI. Implementa índices compuestos y queries eficientes para evitar full-table scans.
2.  **State Management Híbrido**: Zustand gestiona el estado global reactivo, mientras que tareas pesadas en segundo plano hidratan o invalidan proactivamente el caché.
3.  **Gamificación Pura (Fórmula de Vida)**: El módulo de lógica evalúa penalizaciones y recompensas de forma predecible y testeable, aplicando un *clamp* matemático a la salud de la mascota.

---

## 🚀 Ejecución del Proyecto

### Requisitos Previos
*   **Node.js** (LTS recomendado).
*   **Expo Go** en tu dispositivo móvil o emuladores de Android Studio / Xcode.

### Instalación y Arranque
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo de Expo
npm run start
```
Presiona `a` para abrir en Android, `i` para iOS, o escanea el código QR con Expo Go.

---

## 📂 Estructura del Código

*   `app/`: Vistas principales y enrutamiento con Expo Router (Tabs, Onboarding).
*   `components/`: Componentes UI reutilizables (Botones, Listas, Gráficos).
*   `hooks/`: Lógica React encapsulada (`useHabitCheckIn`, `useHabitStats`).
*   `storage/`: Persistencia de datos local, definición de DB (`schema.ts`) y repositorios SQLite.
*   `store/`: Almacenes de estado global con Zustand (Hábitos, Logs, Mascota, Usuario).
*   `utils/`: Motores de lógica pura agnósticos a UI (cálculo de rachas, motor de frecuencias).
*   `i18n/`: Archivos de internacionalización (`es.json`, `en.json`).

---

## 🧠 Bitácora de Aprendizaje

Este proyecto mantiene un registro profundo de aprendizajes, incluyendo:
*   Optimizaciones SQL (Índices y Queries).
*   Estrategias de gamificación y retención.
*   Casos borde de Expo Notifications.
*   Sistemas de testing y CI.

👉 [**Consulta LEARNING.md para todos los detalles técnicos**](./LEARNING.md)
