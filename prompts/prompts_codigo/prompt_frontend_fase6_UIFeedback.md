# Rol
Eres un desarrollador experto en UI/Frontend para React Native con criterio de diseño sólido y obsesión por la accesibilidad, la coherencia visual y la experiencia de usuario.
Dominas React Navigation, Animated API, Moti, el sistema de diseño del proyecto (`src/theme/`) y la construcción de componentes reutilizables y bien tipados en TypeScript.

# Objetivo

Implementar el **feedback visual** que recibe el usuario en `HomeScreen` cuando interactúa con las acciones rápidas de una notificación («Hecho» y «Posponer 30 min») sin haber abierto la app. Tu trabajo es exclusivamente la capa visual: los handlers de notificación (`DONE` y `SNOOZE`) ya están implementados por Logic/Data y actualizan el store — tú reaccionas a esos cambios, no los produces.

**1. Refresco automático de `HomeScreen` al pulsar «Hecho»**
Cuando el usuario pulsa la acción «Hecho» desde el panel de notificaciones, la app puede estar en background o cerrada. Al volver a primer plano, `HomeScreen` debe reflejar el check-in sin interacción adicional:
- Suscribirse a `AppState` para detectar la transición `background → active` y forzar una re-lectura del store (`habitStore.loadHabits()` + `logStore.loadLogs()`)
- El hábito marcado debe aparecer visualmente completado (opacidad 50%, al fondo de la lista, checkbox animado) de forma idéntica a como lo haría un check-in manual
- Mostrar una **mini-animación de confirmación** no bloqueante: un toast o snackbar que aparece en la parte inferior de la pantalla durante 2.5 segundos con el texto *«✓ [Nombre del hábito] completado»* (clave i18n: `home.toast.habitCompleted`) y desaparece con fade out. No interrumpe la interacción con la lista.

**2. Badge «Pospuesto» en `HomeScreen` al pulsar «Posponer»**
Cuando el usuario pospone una notificación, el hábito correspondiente debe mostrar un badge visual en `HomeScreen` que comunica que hay un recordatorio pendiente en 30 minutos:
- El `HabitItem` del hábito pospuesto muestra un badge lateral con el texto *«· 30 min»* (clave i18n: `home.badge.snoozed`) en color de acento del tema
- El badge desaparece automáticamente pasados los 30 minutos — usar un `useEffect` con `setTimeout` que limpie el estado local al expirar, o reaccionar al cambio en el store si Logic/Data expone un campo `snoozedUntil` en el log
- Si el hábito ya fue completado antes de que expiren los 30 minutos, el badge no debe mostrarse

**Requisitos técnicos:**
- La mini-animación de confirmación debe implementarse como un componente `ToastConfirmation` reutilizable en `src/components/` — no inline en `HomeScreen`
- `ToastConfirmation` recibe `message: string` y `visible: boolean` como props; la animación de entrada y salida es responsabilidad del componente
- El badge «Pospuesto» es una variante del componente `HabitItem` existente, no un componente nuevo — añade una prop opcional `snoozedUntil?: Date | null` y renderiza el badge condicionalmente
- La suscripción a `AppState` debe hacerse en un hook `useAppStateRefresh` en `src/hooks/` — no directamente en `HomeScreen`
- Ningún componente de esta fase llama directamente a `expo-notifications` — la información de qué hábito fue marcado o pospuesto llega a través del store

---

# Reglas de trabajo

## Puedes
- Crear y modificar archivos en `src/screens/`, `src/components/`, `src/navigation/` y `src/hooks/` (solo hooks de UI: estado local, animaciones, `AppState`)
- Añadir claves nuevas a `src/i18n/es.json` y `en.json`
- Añadir props opcionales a componentes existentes como `HabitItem` siempre que sean retrocompatibles (ninguna prop nueva es obligatoria)
- Usar cualquier utilidad de `src/theme/` y los iconos de `@expo/vector-icons`

## No puedes
- Implementar ni modificar `notificationService.ts`, los handlers `DONE` / `SNOOZE`, los stores de Zustand ni ningún archivo de `src/storage/` o `src/utils/`
- Llamar directamente a APIs de `expo-notifications` — la información del hábito afectado llega a través del store
- Hardcodear strings de texto en JSX — todo pasa por i18n
- Usar valores de color, fuente o espaciado fuera del sistema de diseño de `src/theme/`
- Cambiar los tipos base de `src/types/index.ts`

## Indicaciones adicionales
- `ToastConfirmation` debe ser completamente agnóstico al dominio: recibe un string y lo muestra, sin saber nada de hábitos ni notificaciones
- El badge «Pospuesto» no debe añadir altura al `HabitItem` — encaja dentro del layout existente para no romper la `FlatList`
- Comenta la decisión de usar `AppState` vs un listener de notificaciones para el refresco, y por qué se eligió este enfoque
- Si Logic/Data no expone `snoozedUntil` en el store en el momento de implementar, documenta el acuerdo en `LEARNING.md` y usa un estado local provisional

## Requisitos de testing — obligatorio

Testing manual documentado en GitHub Issues con dispositivo + OS + screenshot o vídeo corto:

**`ToastConfirmation`**
- Aparece correctamente al recibir `visible: true` con un mensaje
- Desaparece automáticamente a los 2.5 segundos con fade out
- No bloquea la interacción con la lista durante su aparición (verificar que el tap en otros hábitos funciona mientras el toast está visible)
- Si se dispara un segundo toast antes de que expire el primero, el timer se reinicia y el mensaje se actualiza

**Refresco tras acción «Hecho»**
- Poner la app en background, marcar un hábito como «Hecho» desde la notificación, volver a primer plano → el hábito aparece completado sin necesidad de scroll ni pull-to-refresh
- El toast de confirmación aparece con el nombre correcto del hábito completado
- Si el hábito ya estaba completado antes de pulsar «Hecho» (duplicado), el toast no debe mostrarse o debe mostrar un mensaje neutral

**Badge «Pospuesto»**
- El badge aparece en el `HabitItem` correcto tras pulsar «Posponer» y volver a primer plano
- El badge desaparece al completar el hábito manualmente antes de que expiren los 30 minutos
- El badge desaparece solo al cumplirse los 30 minutos si el hábito no fue completado
- El badge no aparece en ningún otro `HabitItem` de la lista

## Casos borde a cubrir o documentar en `LEARNING.md`

- **App cerrada al pulsar «Hecho»**: si la app estaba terminada (no en background sino muerta), `AppState` no dispara la transición. Documentar cómo se detecta este caso — React Navigation expone el `linking` inicial; Logic/Data debería manejar la hydratación del store al arrancar, pero si el refresco visual no ocurre, registrar el workaround.
- **Múltiples hábitos pospuestos**: ¿puede haber más de un badge «Pospuesto» visible simultáneamente? Sí, si el usuario pospone varios. Verificar que los timers de expiración son independientes por `habitId` y documentar la implementación.
- **Posponer un hábito ya pospuesto**: el usuario recibe el recordatorio a los 30 min y vuelve a posponer. El badge debe reiniciar su countdown. Documentar cómo se detecta el nuevo `snoozedUntil` y si el `setTimeout` anterior se cancela correctamente con `clearTimeout`.
- **`HomeScreen` no montada al volver a primer plano**: si el usuario navega a otra pestaña (Stats, Mascota) y responde «Hecho» desde la notificación, el refresco del store ocurre igualmente, pero el toast no es visible porque `HomeScreen` no está en pantalla. Documentar este comportamiento como esperado y decidir si el toast debe mostrarse igualmente al navegar de vuelta a Home.
- **Modo no molestar / permisos revocados entre el envío y la acción**: el usuario responde a una notificación enviada antes de que los permisos fueran revocados. El handler ya fue ejecutado por Logic/Data; la UI debe simplemente reflejar el estado del store sin errores.