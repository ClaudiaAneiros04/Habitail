# Rol
Eres un desarrollador experto en UI/Frontend para React Native con criterio de diseño sólido y obsesión por la accesibilidad, la coherencia visual y la experiencia de usuario.
Dominas React Navigation, Animated API, Moti, el sistema de diseño del proyecto (`src/theme/`) y la construcción de componentes reutilizables y bien tipados en TypeScript.

# Objetivo

Implementar la capa visual completa del sistema de **notificaciones y onboarding** de la Fase 6. Tu trabajo se limita a la UI: los servicios de scheduling, permisos del sistema y lógica de onboarding ya están implementados por el equipo de Logic/Data — tú los consumes a través de hooks y stores, nunca los implementas.

**1. Pantalla de permisos de notificaciones (`NotificationPermissionScreen`)**
Pantalla explicativa que se muestra *antes* del prompt nativo del sistema operativo. El objetivo es contextualizar al usuario para maximizar la tasa de aceptación:
- Ilustración o icono representativo de notificaciones (puede ser un emoji grande o asset de `assets/`)
- Título claro: *«No te olvides de tus hábitos»* (clave i18n: `notifications.permission.title`)
- Descripción de valor: *«Sin notificaciones perderás tus recordatorios diarios y tu mascota podría echarte de menos»* (clave i18n: `notifications.permission.description`)
- Botón primario *«Activar notificaciones»* → llama a `useNotificationPermission().requestPermissions()`
- Enlace secundario *«Ahora no»* → navega hacia atrás sin pedir permisos; no vuelve a aparecer hasta la próxima sesión

**2. Banner de permisos denegados en `HomeScreen`**
Si el usuario rechazó los permisos, se muestra un banner no bloqueante en la parte superior de `HomeScreen`:
- Texto: *«Las notificaciones están desactivadas. Puedes activarlas en Ajustes»* (clave i18n: `notifications.banner.denied`)
- Icono de campana tachada a la izquierda
- Botón *«Ir a Ajustes»* a la derecha → llama a `Linking.openSettings()`
- Botón de cierre (×) que oculta el banner durante la sesión actual (no persiste entre reinicios)
- El banner solo se renderiza si `useNotificationPermission().status === 'denied'`

**3. Flujo de Onboarding (`OnboardingNavigator`)**
Stack Navigator independiente del navegador principal. Se muestra si `onboardingCompleted === false` (dato que viene del hook `useOnboarding()`). Tres pantallas en secuencia:

- **`OnboardingWelcomeScreen`** — Bienvenida + input para el nombre de la mascota. Botón *«Siguiente»* desactivado si el campo está vacío o tiene menos de 2 caracteres. Animación de entrada con `Moti` (fade + slide desde abajo).

- **`OnboardingInterestsScreen`** — MultiSelect de áreas de interés con chips seleccionables: Salud · Deporte · Productividad · Bienestar · Finanzas · Aprendizaje. Mínimo 1 seleccionado para activar *«Siguiente»*. Estado visual claro entre chip seleccionado / no seleccionado (color de fondo + checkmark).

- **`OnboardingHabitsScreen`** — Lista de hábitos sugeridos filtrados por las áreas elegidas, consumidos de `useHabitLibrary(selectedCategories)`. Cada item tiene un toggle de selección. Botón *«Empezar»* → llama a `useOnboarding().completeOnboarding(selectedHabits, petName)` y navega a `HomeScreen`. El botón funciona aunque no se seleccione ningún hábito (el usuario puede empezar vacío).

**Requisitos técnicos:**
- Todos los textos visibles deben usar claves i18n de `src/i18n/es.json` y `en.json` — ningún string hardcodeado en JSX
- Los colores, tipografía y espaciado deben consumirse exclusivamente de `src/theme/` — sin valores hexadecimales ni tamaños inline
- El `OnboardingNavigator` debe ser un Stack separado que `RootNavigator` monta condicionalmente; no insertes pantallas de onboarding dentro del navegador principal
- Las transiciones entre pantallas del onboarding deben usar la animación `slide_from_right` de React Navigation
- El banner de permisos denegados no debe causar re-render del resto de `HomeScreen` al cerrarse — usa estado local con `useState`, no el store global
- Ningún componente de esta fase llama directamente a `expo-notifications` — toda interacción con el sistema de notificaciones pasa por el hook `useNotificationPermission()` provisto por Logic/Data

---

# Reglas de trabajo

## Puedes
- Crear y modificar archivos en `src/screens/`, `src/components/`, `src/navigation/` y `src/hooks/` (solo hooks de UI: estado local, animaciones, navegación)
- Añadir claves nuevas a `src/i18n/es.json` y `en.json`
- Crear componentes reutilizables en `src/components/` si un elemento visual se repite en más de una pantalla (ej: `ChipSelector`, `PermissionBanner`)
- Usar cualquier utilidad de `src/theme/` y los iconos de `@expo/vector-icons`

## No puedes
- Implementar ni modificar la lógica de `notificationService.ts`, `UserRepository`, stores de Zustand ni ningún archivo de `src/storage/` o `src/utils/`
- Hardcodear strings de texto en JSX — todo pasa por i18n
- Usar valores de color, fuente o espaciado fuera del sistema de diseño de `src/theme/`
- Llamar directamente a APIs de `expo-notifications` o `expo-localization` — consúmelas a través de los hooks acordados con Logic/Data
- Cambiar los tipos base de `src/types/index.ts`

## Indicaciones adicionales
- Un componente, una responsabilidad: `PermissionBanner` no sabe nada de onboarding; `ChipSelector` no sabe nada de permisos
- Comenta las decisiones de animación no obvias: por qué un `spring` y no un `timing`, por qué ese `delay`
- Todos los textos deben ser legibles en modo claro y oscuro si el tema lo soporta; si no, documentarlo
- Las pantallas de onboarding deben tener `empty state` definido: ¿qué muestra `OnboardingHabitsScreen` si el filtro por categorías no devuelve hábitos?

## Requisitos de testing — obligatorio

Testing manual documentado en GitHub Issues para cada pantalla, con dispositivo + OS + screenshot:

**`NotificationPermissionScreen`**
- El botón *«Activar notificaciones»* llama a `requestPermissions()` exactamente una vez por tap
- El enlace *«Ahora no»* navega hacia atrás sin llamar a `requestPermissions()`
- La pantalla no se muestra si los permisos ya fueron concedidos previamente

**`PermissionBanner`**
- El banner es visible cuando `status === 'denied'` y no cuando `status === 'granted'` o `'undetermined'`
- El botón × oculta el banner en la sesión actual sin afectar el estado global
- Al reabrir la app, el banner vuelve a mostrarse si los permisos siguen denegados
- El botón *«Ir a Ajustes»* abre la pantalla de ajustes del sistema (verificar en dispositivo físico)

**Flujo de onboarding completo**
- El botón *«Siguiente»* de `OnboardingWelcomeScreen` está desactivado con 0 y 1 carácter, y activo con 2+
- En `OnboardingInterestsScreen`, ningún chip seleccionado → botón desactivado; al menos 1 → activo
- `OnboardingHabitsScreen` muestra correctamente los hábitos filtrados por las categorías elegidas
- `OnboardingHabitsScreen` muestra su empty state si ninguna categoría tiene hábitos asociados
- El flujo completo (Welcome → Interests → Habits → Home) no vuelve a mostrarse al reiniciar la app

## Casos borde a cubrir o documentar en `LEARNING.md`

- **Permisos concedidos y luego revocados desde Ajustes del sistema**: el banner debe aparecer en la siguiente apertura de la app aunque `requestPermissions()` haya devuelto `granted` antes. Documentar cómo se detecta el cambio (verificar el estado en cada `AppState` change con `AppState.addEventListener('change', ...)`).
- **Onboarding interrumpido**: el usuario llega a `OnboardingHabitsScreen`, cierra la app y la vuelve a abrir. ¿Vuelve al inicio del onboarding o al punto donde lo dejó? El MVP reinicia desde el principio (el flag `onboardingCompleted` solo se escribe al pulsar *«Empezar»*). Documentar esta decisión.
- **Nombre de mascota con solo espacios**: `«   »` tiene más de 2 caracteres pero es semánticamente vacío — aplicar `.trim()` antes de validar y documentarlo.
- **`OnboardingHabitsScreen` sin hábitos para las categorías seleccionadas**: mostrar un empty state con CTA para volver a elegir categorías (botón *«Cambiar intereses»* que navega a `OnboardingInterestsScreen`). Documentar el diseño del empty state en `LEARNING.md`.
- **Pantalla de permisos en Android 13+**: el prompt nativo de permisos de notificaciones solo aparece en Android 13 (API 33) o superior. En versiones anteriores, los permisos están concedidos por defecto. Documentar el comportamiento y verificar que `NotificationPermissionScreen` no bloquea el flujo en Android 12.
- **Accesibilidad del `ChipSelector`**: verificar que los chips son accesibles con `accessibilityRole="checkbox"` y `accessibilityState={{ checked: selected }}` para lectores de pantalla. Documentar si se implementa o se pospone como deuda técnica.