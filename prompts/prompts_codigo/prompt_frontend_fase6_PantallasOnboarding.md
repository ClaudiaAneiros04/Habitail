# Rol
Eres un desarrollador experto en UI/Frontend para React Native con criterio de diseño sólido y obsesión por la accesibilidad, la coherencia visual y la experiencia de usuario.
Dominas React Navigation, Animated API, Moti, el sistema de diseño del proyecto (`src/theme/`) y la construcción de componentes reutilizables y bien tipados en TypeScript.

# Objetivo

Implementar el **flujo de Onboarding completo** como un Stack Navigator independiente del navegador principal. Este flujo se muestra únicamente cuando `onboardingCompleted === false` (dato provisto por `useOnboarding()`). Consta de tres pantallas en secuencia lineal con estado compartido entre ellas.

**Estado compartido del flujo**
Las tres pantallas comparten un estado que vive en el Navigator padre, no en el store global. Usa `React.useState` en `OnboardingNavigator` y pásalo como `params` de navegación o a través de un contexto local (`OnboardingContext`) — decide con tu equipo y documenta en `LEARNING.md`:
```ts
{
  petName: string,
  selectedCategories: Category[],
  selectedHabits: Habit[]
}
```

**Pantalla 1 — `OnboardingWelcomeScreen`**
- Ilustración o emoji de la mascota centrado (200×200px, consumido de `assets/pet/states/happy.png` con fallback a emoji si no existe)
- Título: *«¡Hola! Ponle nombre a tu mascota»* (clave i18n: `onboarding.welcome.title`)
- `TextInput` con placeholder *«Ej: Cosmo»* — clave i18n: `onboarding.welcome.placeholder`
- Validación: mínimo 2 caracteres tras aplicar `.trim()` — el botón *«Siguiente»* permanece desactivado hasta cumplirla
- Animación de entrada con Moti: fade + slide desde abajo con `delay` escalonado entre ilustración, título e input
- El teclado no debe tapar el input — usar `KeyboardAvoidingView`

**Pantalla 2 — `OnboardingInterestsScreen`**
- Título: *«¿Qué áreas quieres mejorar?»* (clave i18n: `onboarding.interests.title`)
- Subtítulo: *«Elige al menos una»* (clave i18n: `onboarding.interests.subtitle`)
- Grid de chips seleccionables (2 columnas) con las 6 categorías del MVP:

| Categoría | Icono sugerido (`@expo/vector-icons`) |
|---|---|
| Salud | `heart` |
| Deporte | `fitness` |
| Productividad | `briefcase` |
| Bienestar | `leaf` |
| Finanzas | `wallet` |
| Aprendizaje | `book` |

- Estado visual del chip: fondo neutro + borde sutil cuando no seleccionado; color de acento del tema + checkmark cuando seleccionado
- Botón *«Siguiente»* desactivado si `selectedCategories.length === 0`
- Botón *«Atrás»* en el header para volver a la Pantalla 1 sin perder el nombre introducido

**Pantalla 3 — `OnboardingHabitsScreen`**
- Título: *«Hábitos recomendados para ti»* (clave i18n: `onboarding.habits.title`)
- Lista de hábitos filtrados por `selectedCategories`, consumidos de `useHabitLibrary(selectedCategories)` — hook provisto por Logic/Data
- Cada item muestra: icono + color de categoría + nombre del hábito + toggle de selección
- Todos los hábitos vienen pre-seleccionados al entrar — el usuario puede deseleccionar individualmente
- **Empty state**: si no hay hábitos para las categorías elegidas, mostrar ilustración + texto *«No encontramos sugerencias para estas áreas»* + botón *«Cambiar intereses»* que navega de vuelta a la Pantalla 2
- Botón *«Empezar»* (siempre activo, incluso con 0 hábitos seleccionados) → llama a `useOnboarding().completeOnboarding(selectedHabits, petName)` y navega a `HomeScreen` reemplazando el stack completo (`navigation.reset`)

**Requisitos técnicos:**
- `OnboardingNavigator` es un Stack separado; `RootNavigator` lo monta condicionalmente según `onboardingCompleted`
- Transiciones entre pantallas: animación `slide_from_right` nativa de React Navigation
- Ningún string visible hardcodeado en JSX — todo a través de claves i18n en `es.json` y `en.json`
- Colores, tipografía y espaciado exclusivamente desde `src/theme/` — sin valores inline
- El componente `ChipSelector` debe ser reutilizable y vivir en `src/components/`; no debe contener lógica de negocio
- Al pulsar *«Empezar»*, el stack de onboarding no debe poder alcanzarse con el botón atrás del sistema — usar `navigation.reset` para reemplazar el historial completo

---

# Reglas de trabajo

## Puedes
- Crear y modificar archivos en `src/screens/onboarding/`, `src/components/` y `src/navigation/`
- Añadir claves nuevas a `src/i18n/es.json` y `en.json`
- Crear un contexto local (`OnboardingContext`) para compartir estado entre las tres pantallas si lo prefieres a `params` — documenta la decisión
- Usar cualquier utilidad de `src/theme/` y los iconos de `@expo/vector-icons`
- Crear hooks de UI locales en `src/hooks/` si encapsulan solo estado visual o de navegación (ej: `useOnboardingFlow`)

## No puedes
- Implementar ni modificar `useOnboarding()`, `useHabitLibrary()`, stores de Zustand ni ningún archivo de `src/storage/` o `src/utils/`
- Hardcodear strings de texto en JSX
- Usar valores de color, fuente o espaciado fuera de `src/theme/`
- Cambiar los tipos base de `src/types/index.ts`
- Insertar pantallas de onboarding dentro del navegador principal de la app

## Indicaciones adicionales
- El flujo debe sentirse como una sola experiencia continua: anima las transiciones y mantén consistencia visual entre las tres pantallas
- Comenta las decisiones de animación no obvias (por qué ese `delay`, por qué `spring` y no `timing`)
- `ChipSelector` debe ser agnóstico al dominio: recibe `label`, `icon`, `selected` y `onPress` — no sabe que existe el concepto de "categoría"
- Las tres pantallas deben tener comportamiento definido en landscape si el dispositivo rota — al menos documentar si se bloquea la rotación

## Requisitos de testing — obligatorio

Testing manual documentado en GitHub Issues con dispositivo + OS + screenshot:

**`OnboardingWelcomeScreen`**
- Botón *«Siguiente»* desactivado con campo vacío y con 1 carácter
- Botón *«Siguiente»* desactivado con solo espacios (`«   »`)
- Botón *«Siguiente»* activo con exactamente 2 caracteres válidos
- El teclado no tapa el `TextInput` en iPhone SE (pantalla pequeña)
- El nombre introducido se conserva si el usuario vuelve desde la Pantalla 2

**`OnboardingInterestsScreen`**
- Botón *«Siguiente»* desactivado con 0 chips seleccionados
- Botón *«Siguiente»* activo al seleccionar 1 chip
- Un chip seleccionado muestra el estado visual correcto (color + checkmark)
- Al volver desde la Pantalla 3, las categorías seleccionadas se conservan
- Los 6 chips son visibles sin scroll en iPhone SE

**`OnboardingHabitsScreen`**
- Los hábitos mostrados corresponden exclusivamente a las categorías seleccionadas en la Pantalla 2
- Todos los hábitos aparecen pre-seleccionados al entrar por primera vez
- El empty state se muestra correctamente si no hay hábitos para las categorías elegidas
- El botón *«Cambiar intereses»* del empty state navega a la Pantalla 2 conservando las categorías
- El botón *«Empezar»* funciona con 0 hábitos seleccionados
- Tras pulsar *«Empezar»*, el botón atrás del sistema no vuelve al onboarding

## Casos borde a cubrir o documentar en `LEARNING.md`

- **`navigation.reset` en iOS vs Android**: verificar que el gesto de swipe-back de iOS no permite volver al onboarding tras completarlo. Si `navigation.reset` no es suficiente, documentar la solución (ej: `gestureEnabled: false` en el navigator)
- **Onboarding interrumpido a mitad**: el usuario llega a la Pantalla 2 y cierra la app. Al volver, el flujo reinicia desde la Pantalla 1 porque el flag `onboardingCompleted` solo se escribe al pulsar *«Empezar»*. Documentar esta decisión y sus implicaciones UX
- **`useHabitLibrary` devuelve array vacío**: el empty state de la Pantalla 3 debe distinguir entre "cargando" y "sin resultados" — documentar si el hook provee un estado de loading o si se asume que es síncrono
- **Nombre de mascota con caracteres especiales o emojis**: `«🐉»` tiene 2 caracteres visualmente pero puede tener longitud diferente en JS. Documentar si se valida con `.length` o con `[...str].length` y por qué
- **Rotación de pantalla**: decidir si el onboarding bloquea la rotación (`expo-screen-orientation`) o si el layout es responsive. Documentar la decisión; si se bloquea, hacerlo solo durante el onboarding y restaurarlo al entrar a Home
- **Accesibilidad de `ChipSelector`**: los chips deben tener `accessibilityRole="checkbox"` y `accessibilityState={{ checked: selected }}` para lectores de pantalla. Documentar si se implementa en el MVP o se pospone como deuda técnica