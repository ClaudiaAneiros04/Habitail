# Rol
Eres un desarrollador experto en Logic/Data con criterio arquitectónico sólido y obsesión por la corrección, 
el rendimiento y la mantenibilidad del código.
Dominas SQLite en entornos móviles, el Repository Pattern, Zustand y la escritura de funciones puras testeables.

# Objetivo

Implementar el **job diario de penalización de la mascota** que se ejecuta cada vez que el usuario abre la app.

El job debe determinar si ya se aplicó la penalización por los hábitos de ayer, calcularla si corresponde, aplicarla a la vida de la mascota y registrar que ya fue procesada para evitar duplicados.

**Flujo esperado:**

1. Al abrir la app, comprobar si ya se ejecutó el job de penalización para la fecha de hoy (`lastPenaltyAppliedDate` en `userStore` / `UserRepository`)
2. Si ya se ejecutó hoy → no hacer nada
3. Si no se ejecutó aún:
   - Obtener todos los hábitos activos que debían cumplirse ayer (usando `frequencyEngine.getHabitsForDay(habits, yesterday)`)
   - Para cada hábito, consultar si existe un `HabitLog` con `completado = true` para la fecha de ayer
   - Los hábitos sin log o con `completado = false` cuentan como incumplidos
   - Calcular el delta negativo total según la prioridad del hábito: Esencial −20 · Normal −10 · Flexible −5
   - Aplicar `clamp(vidaActual + delta, 0, 100)` y actualizar `petStore` y `PetRepository`
   - Registrar `lastPenaltyAppliedDate = today` en `userStore` y persistir en `UserRepository`

**Requisitos técnicos:**
- El cálculo del delta debe vivir en una función pura en `src/utils/petLogic.ts`: `calculatePenaltyDelta(missedHabits: Habit[]): number`
- La consulta de hábitos incumplidos debe vivir en `LogRepository` como `getMissedHabitsForDate(date: string, habits: Habit[]): Promise<Habit[]>` — no cargar todos los logs en memoria
- La orquestación completa debe exponerse como un hook: `useDailyPenaltyJob()` — llamable desde el punto de entrada de la app (e.g. `AppNavigator` o `useAppInit`)
- La fecha se debe manejar siempre en formato `YYYY-MM-DD` local (usando `date-fns/format` con `startOfYesterday()`) — nunca UTC directamente
- Si `vida = 0` antes de aplicar la penalización, el job debe registrar la fecha igualmente pero no recalcular ni emitir notificación

# Reglas de trabajo

## Puedes
- Crear y modificar archivos en `src/utils/`, `src/store/`, `src/storage/` y `src/hooks/`
- Añadir queries SQL al Repository si no existen, respetando el contrato de la interfaz
- Proponer y añadir índices SQLite si detectas que una query los necesita — documentar el motivo en `LEARNING.md`
- Escribir tests unitarios para funciones puras (cálculo de rachas, tasas de cumplimiento, etc.)

## No puedes
- Modificar ni crear archivos de UI/frontend (componentes, pantallas, estilos)
- Cambiar los tipos base definidos en `src/types/index.ts` — adáptate a ellos
- Introducir lógica de negocio dentro de los stores de Zustand — los stores solo orquestan y cachean

## Indicaciones adicionales
- Métodos y archivos con responsabilidad única y tamaño razonable
- Comenta los métodos: qué hace, parámetros relevantes y cualquier decisión no obvia (especialmente en SQL)
- Separa claramente: queries SQL en el Repository, cálculos en `utils/`, orquestación en el hook
- Cualquier caso borde relevante (hábito sin logs, cambio de zona horaria, hábito semanal) debe estar cubierto o documentado

## Requisitos de testing — obligatorio:

- `calculatePenaltyDelta([])` → devuelve `0`
- `calculatePenaltyDelta` con mezcla de prioridades → suma correcta de deltas negativos
- `calculatePenaltyDelta` con todos los hábitos esenciales incumplidos → valor mínimo esperado
- `clamp` aplicado correctamente cuando el delta supera la vida actual (no puede resultar negativo)
- `getMissedHabitsForDate` con todos completados → array vacío
- `getMissedHabitsForDate` con hábito sin ningún log → se incluye como incumplido
- Job no se ejecuta si `lastPenaltyAppliedDate === today` → `petStore` no muta
- Job se ejecuta correctamente si `lastPenaltyAppliedDate` es `null` (primera apertura)

## Casos borde a cubrir o documentar en LEARNING.md:

- **Zona horaria:** el usuario abre la app justo después de medianoche — verificar que "ayer" se resuelve correctamente en hora local, no UTC
- **Hábito semanal en día no activo:** si ayer no era un día activo del hábito, no debe contar como incumplido
- **App sin abrir varios días:** el job solo penaliza por ayer, no acumula días anteriores — decisión de diseño a documentar
- **Primera apertura / sin hábitos:** `lastPenaltyAppliedDate = null` y/o array de hábitos vacío — no debe lanzar error
- **Vida ya en 0:** registrar fecha igualmente pero no aplicar delta ni disparar efectos secundarios