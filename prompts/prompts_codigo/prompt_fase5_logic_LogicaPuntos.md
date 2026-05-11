# Rol
Eres un desarrollador experto en Logic/Data con criterio arquitectónico sólido y obsesión por la corrección,
el rendimiento y la mantenibilidad del código.
Dominas SQLite en entornos móviles, el Repository Pattern, Zustand y la escritura de funciones puras testeables.

# Objetivo

Implementar el sistema completo de **puntos, compras y logros (insignias)** que alimenta la capa de gamificación del Habit Tracker. Este sistema tiene tres responsabilidades bien delimitadas:

**1. Acumulación de puntos por check-in**
Cada vez que el usuario completa un hábito, se suman puntos según el factor de prioridad del hábito:
- `Esencial` → +20 pts
- `Normal` → +10 pts
- `Flexible` → +5 pts

La función que calcula el delta de puntos (`calcPointsDelta(habit: Habit): number`) debe ser **pura y testeable**, sin efectos secundarios. La orquestación (leer el hábito, llamar a la función, persistir el resultado) vive en el hook `useHabitCheckIn`, no en el store.

**2. Descuento de puntos por compras en la tienda**
Cuando el usuario compra un skin o accesorio, se descuenta el precio del saldo actual. El saldo nunca puede ser negativo: si los puntos resultantes serían `< 0`, la compra debe rechazarse y la función debe devolver un error tipado (`InsufficientPointsError`), no lanzar una excepción. La lógica de validación y descuento vive en `src/utils/pointsEngine.ts`.

**3. Persistencia en `userStore` y `UserRepository`**
El saldo de puntos forma parte del modelo `User`. Toda mutación (suma o descuento) debe:
- Actualizarse en el store de Zustand (`userStore.updatePoints(delta)`) para reflejo inmediato en la UI
- Persistirse en SQLite a través de `UserRepository.updatePoints(userId, newBalance)` como operación atómica

**4. Sistema de insignias (5 MVP)**
Las insignias se evalúan de forma **lazy** al abrir la app y tras cada check-in. La función `evaluateBadges(user: User, habits: Habit[], logs: HabitLog[]): Badge[]` devuelve la lista de insignias nuevas desbloqueadas (no las ya concedidas). Es una función pura. La persistencia de insignias concedidas vive en `UserRepository`.

Las 5 insignias obligatorias del MVP y su condición de desbloqueo:

| ID | Nombre | Condición |
|---|---|---|
| `first_week` | Primera semana | El usuario lleva 7 días desde `user.createdAt` con al menos 1 check-in |
| `streak_7` | Racha 7 días | `currentStreak >= 7` en cualquier hábito |
| `streak_30` | Racha 30 días | `currentStreak >= 30` en cualquier hábito |
| `perfect_week` | 100% semanal | Todos los hábitos activos completados los 7 días de alguna semana natural (Lu–Do) |
| `one_month_active` | 1 mes activo | Al menos 1 check-in en 28 de los últimos 30 días (días calendario) |

**Requisitos técnicos:**
- `calcPointsDelta(habit: Habit): number` — función pura, sin efectos secundarios
- `deductPoints(currentBalance: number, price: number): Result<number, InsufficientPointsError>` — nunca lanza, devuelve un tipo `Result` discriminado
- `evaluateBadges(user, habits, logs): Badge[]` — función pura, devuelve solo las insignias *nuevas* (las ya concedidas vienen en `user.badges` y deben filtrarse)
- Toda escritura a SQLite pasa por el Repository; el store de Zustand nunca toca la base de datos directamente
- Las insignias ya concedidas no se re-evalúan ni se re-insertan


# Reglas de trabajo

## Puedes
- Crear y modificar archivos en `src/utils/`, `src/store/`, `src/storage/` y `src/hooks/`
- Añadir queries SQL al Repository si no existen, respetando el contrato de la interfaz
- Proponer y añadir índices SQLite si detectas que una query los necesita — documentar el motivo en `LEARNING.md`
- Escribir tests unitarios para funciones puras (cálculo de puntos, evaluación de insignias, etc.)

## No puedes
- Modificar ni crear archivos de UI/frontend (componentes, pantallas, estilos)
- Cambiar los tipos base definidos en `src/types/index.ts` — adáptate a ellos
- Introducir lógica de negocio dentro de los stores de Zustand — los stores solo orquestan y cachean

## Indicaciones adicionales
- Métodos y archivos con responsabilidad única y tamaño razonable
- Comenta los métodos: qué hace, parámetros relevantes y cualquier decisión no obvia (especialmente en SQL)
- Separa claramente: queries SQL en el Repository, cálculos en `utils/`, orquestación en el hook
- Cualquier caso borde relevante debe estar cubierto o documentado

## Requisitos de testing — obligatorio

Escribe tests unitarios en Jest para todas las funciones puras. Como mínimo:

**`calcPointsDelta`**
- Devuelve 20 para un hábito `Esencial`
- Devuelve 10 para un hábito `Normal`
- Devuelve 5 para un hábito `Flexible`
- No muta el objeto `habit` recibido

**`deductPoints`**
- Descuenta correctamente cuando hay saldo suficiente
- Devuelve `InsufficientPointsError` si el saldo resultante sería negativo
- Devuelve `InsufficientPointsError` si `price` es mayor que `currentBalance` exactamente en 1
- El saldo nunca queda en negativo bajo ningún input válido

**`evaluateBadges`**
- No devuelve insignias ya presentes en `user.badges`
- Devuelve `streak_7` cuando existe un hábito con `currentStreak >= 7`
- Devuelve `perfect_week` solo si *todos* los hábitos activos se completaron en alguna semana natural completa
- Devuelve lista vacía si no hay insignias nuevas que desbloquear
- No muta los arrays recibidos como parámetro

## Casos borde a cubrir o documentar en `LEARNING.md`

**Puntos**
- ¿Qué ocurre si `calcPointsDelta` recibe un hábito con un valor de prioridad no contemplado en el enum? → Definir un valor de fallback (ej: 0) y documentarlo.
- ¿El saldo de puntos puede desincronizarse entre el store y SQLite si la app se cierra a mitad de una escritura? → Documentar la estrategia de consistencia (write-through síncrono o reconciliación al arrancar).

**Insignias**
- `perfect_week`: ¿qué ocurre con hábitos que no eran activos durante esa semana? Solo deben contarse los hábitos activos en ese rango de fechas, no los actuales.
- `one_month_active`: ¿"días con al menos 1 check-in" cuenta check-ins de hábitos archivados? Decidir y documentar.
- `streak_7` / `streak_30`: ¿se evalúan sobre la racha *actual* o la racha *máxima histórica*? La condición usa `currentStreak` — documentar por qué (incentiva consistencia, no nostalgia).
- ¿Qué ocurre si `user.createdAt` es `null` o inválido al evaluar `first_week`? → La insignia no se desbloquea; documentar el guard.
- ¿Las insignias se re-evalúan si el usuario borra logs manualmente? → Fuera del scope del MVP; documentar como deuda técnica.
