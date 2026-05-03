# Bitácora de Aprendizaje — Habitail
 
## Índice de Contenidos
 
1.  [Diseño de Arquitectura de Datos y Optimización: Índices](#diseño-de-arquitectura-de-datos-y-optimización-índices-en-consultas-de-hábitos)
2.  [Lógica de Negocio — Fase 3: Rachas y Check-in](#lógica-de-negocio--fase-3-rachas-y-check-in)
3.  [Errores y Aprendizajes — Fase 3](#errores-y-aprendizajes--fase-3)
 
---
 
# Diseño de Arquitectura de Datos y Optimización: Índices en Consultas de Hábitos

## Contexto Técnico

En el desarrollo de **Habitail**, la tabla `habit_logs` registra todas las interacciones de los usuarios con sus hábitos (check-ins, valores, notas). Con el paso del tiempo, un usuario activo generará miles de registros. 

Para features de UI como **gráficos de progreso**, **estadísticas de rachas**, o un **calendario histórico**, es necesario extraer todos los logs vinculados a un hábito concreto en un rango de fechas delimitado. Esto lo realizamos a través de la función `getLogsForRange(habitId, from, to)` en nuestro `LogRepository`.

## La Solución a Largo Plazo: Índice Compuesto

A nivel de base de datos se ha introducido la siguiente instrucción SQL para optimizar las consultas históricas:

```sql
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_fecha ON habit_logs (habitId, fecha);
```

Las fechas se persisten siempre basándonos en un formato consistente e ISO-compatible (ej. ISO 8601 `YYYY-MM-DD` o Timestamp ISO). Gracias a ello, la BD puede tratar las fechas como cadenas alfanuméricas predecibles lexicográficamente para evaluar operadores de rango `>` o `<`.

### Beneficios para el Rendimiento a Lleno Pulmón

1. **Eficiencia algorítmica (B-Tree frente a Full Scan):**
   Al no disponer de un índice, calcular las rachas del último mes obliga a SQLite a realizar un **Full Table Scan** [O(N)] leyendo toda la tabla de `habit_logs` filtrando cada fila, lo cual escalará terriblemente a los 6 meses de uso del usuario.
   El índice B-Tree creado permite ubicar a coste logarítmico **O(log N)** primero el nodo correspondiente al `habitId`, y después navegar por sus rangos de `fecha` sin leer bloques de disco innecesarios de la BD.

2. **Ordenamiento de bajo coste (Index-based Sorting):**
   Nuestra consulta utiliza un `ORDER BY fecha ASC`. Un índice multi-columna en SQLite ordena *ya físicamente* las entradas por los campos especificados de izquierda a derecha. Es decir, los registros para un `habitId` ya están intrínsecamente ordenados por fecha en el propio índice. La consulta se ahorra consumir memoria o tiempo de CPU adicional en un *Temp B-Tree* de SQLite para el ordenado post-filtrado.

3. **Prevención de colas de I/O en UI:**
   A nivel de frontend en React Native, los cuellos de botella en la renderización se suelen originar al bloquear el puente o cuando las lecturas de almacenamiento lento en local retrasan la hidratación de hooks (ej: los cálculos en uso de rachas y estadísticas). Acceder por índices previene lags visuales considerables y mejora la UX/UI al montar componentes de gráficas.

## Reglas de Arquitectura

Para mantener la eficacia de esta estrategia:
* Nunca insertar fechas en formatos localizados (ej: `DD-MM-YYYY` no es lexicográficamente ordenable de manera natural, rompería el rango en SQLite).
* El filtrado en DB es prioritario sobre el filtrado en arrays en TS. El `LogRepository` entrega sólo el rango que se necesita pintar.

---
 
# Lógica de Negocio — Fase 3: Rachas y Check-in
 
En esta fase se implementó la inteligencia detrás del seguimiento de hábitos, centrándose en la persistencia, la gamificación y el cálculo de métricas de éxito.
 
## 1. Motor de Cálculo de Rachas (`streakCalculator.ts`)
 
El `streakCalculator` es un módulo de lógica pura encargado de procesar los `habit_logs` para derivar estadísticas.
 
*   **Racha Actual (`calculateCurrentStreak`)**:
    *   **Diaria**: Verifica si hay un log para "hoy". Si no, mira "ayer". Si hay, retrocede día a día hasta encontrar un hueco.
    *   **Semanal**: Evalúa semanas naturales (L-D). Una racha se mantiene si hay al menos un registro en cada semana consecutiva.
*   **Racha Máxima (`calculateMaxStreak`)**: Algoritmo de "ventana deslizante" que recorre todo el historial buscando el segmento más largo de días consecutivos completados.
*   **Tasa de Cumplimiento (`calculateCompletionRate`)**: Porcentaje de días con éxito sobre un periodo (ej. últimos 30 días), normalizando múltiples registros en un mismo día.
 
## 2. Hook de Gestión de Estado (`useHabitCheckIn.ts`)
 
Este hook actúa como el orquestador principal entre la UI y las diferentes capas de datos.
 
*   **Abstracción de Persistencia**: Encapsula las llamadas a `logStore` y `LogRepository`, gestionando la generación de IDs deterministas (`log_habitId_timestamp`).
*   **Semántica de Datos**: Implementa la lógica de que **desmarcar** un hábito debe **eliminar** el registro (`deleteById`) en lugar de actualizarlo a `false`, permitiendo una distinción clara en el historial entre "No realizado" y "Día aún no llegado".
*   **Integración de Gamificación**: Cada acción de éxito (`markComplete`) dispara automáticamente una actualización de salud en el `petStore` (+10 HP).
*   **Feedback Visual (DX)**: Expone valores animados (`bounceValue`) y lógica de celebración (`shouldLaunchConfetti`) cuando se detecta que el último hábito del día ha sido completado.
 
---
 
# Errores y Aprendizajes — Fase 3

Registro técnico de todos los errores detectados durante la Fase 3 del proyecto Habitail
(integración UI de rachas + Home Screen + History Screen). Se documenta dónde apareció cada
error, por qué se producía y cómo se resolvió.

---

## Error 1 — `expo-sqlite` en Web: `.wasm` no resuelto por Metro

### Dónde se encontró
Consola del servidor Expo al ejecutar `npx expo start --web --clear`.

### Síntoma
```
Web Bundling failed
Unable to resolve "./wa-sqlite/wa-sqlite.wasm"
from "node_modules\expo-sqlite\web\worker.ts"
```
Las pantallas "Hoy" e "Historial" se quedaban en estado de carga infinita porque
el worker de SQLite nunca se inicializaba.

### Por qué se producía
`expo-sqlite` en web usa WebAssembly (`.wasm`) para ejecutar SQLite a través de
`wa-sqlite`. Metro Bundler, el empaquetador de Expo, por defecto no reconoce la
extensión `.wasm` como un asset válido y lanza un error de resolución de módulo.

### Solución
Añadir `.wasm` a la lista de extensiones de assets en `metro.config.js`:

```js
// metro.config.js
config.resolver.assetExts.push('wasm');
```

---

## Error 2 — `initDb()` nunca se llamaba: tablas SQLite inexistentes

### Dónde se encontró
Consola del navegador al intentar marcar un hábito o navegar al historial.

### Síntoma
```
Error: Error code 1: no such table: habit_logs
```
El toggle de hábito fallaba silenciosamente; el historial no mostraba ningún dato.

### Por qué se producía
`storage/database.ts` exportaba la función `initDb()` (responsable de ejecutar todos
los `CREATE TABLE IF NOT EXISTS`), pero **nadie la llamaba** en el arranque de la app.
Los repositorios intentaban hacer queries sobre tablas que aún no existían.

### Solución
Llamar a `initDb()` en el layout raíz (`app/_layout.tsx`) bloqueando el renderizado
hasta que la promesa resuelva:

```ts
// app/_layout.tsx
const [dbReady, setDbReady] = useState(false);

useEffect(() => {
  initDb()
    .then(() => setDbReady(true))
    .catch(console.error);
}, []);

if (!dbReady) return <ActivityIndicator />;
```

---

## Error 3 — `NoModificationAllowedError`: múltiples conexiones OPFS a SQLite

### Dónde se encontró
Consola del navegador, aparecía junto al Error 2.

### Síntoma
```
NoModificationAllowedError: Failed to execute 'createSyncAccessHandle'
on 'FileSystemFileHandle': Access Handles cannot be created if there
is another open Access Handle or Writable stream associated with the same file.
```

### Por qué se producía
`expo-sqlite` en web usa el sistema de ficheros OPFS del navegador, que solo admite
**una conexión de escritura simultánea** al mismo archivo. La función `getDb()` original
llamaba a `SQLite.openDatabaseAsync()` cada vez que se invocaba — sin cachear la
instancia. Como `LogRepository` se instanciaba tanto en `useLogStore` como en
`useHabitStats`, el motor intentaba abrir dos conexiones paralelas, provocando el error.

### Solución
Refactorizar `database.ts` al patrón **Singleton** usando una promesa cacheada.
La BD se abre **una única vez** y, en esa misma apertura, se crean todas las tablas:

```ts
// storage/database.ts
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('habitail.db');
      await db.execAsync(`CREATE TABLE IF NOT EXISTS habit_logs (...);`);
      return db;
    })();
  }
  return _dbPromise;
};
```

Con esto se eliminan los Errores 2 y 3 a la vez: la tabla siempre existe antes de
la primera query, y nunca hay más de una conexión activa.

---

## Error 4 — Booleanos SQLite invertidos en web (`Boolean("0") === true`)

### Dónde se encontró
`storage/LogRepository.ts`, método `mapRowToLog`.

### Síntoma
Un hábito marcado como **completado** en la pantalla "Hoy" aparecía como
**incumplido** (X roja) en la pantalla Historial.

### Por qué se producía
`expo-sqlite` sobre `wa-sqlite` (WASM en web) puede devolver columnas `INTEGER`
como **strings JavaScript** (`"0"` / `"1"`) en lugar de números. La conversión
original usaba `Boolean(row.completado)`, pero en JS cualquier string no vacío es
`true`, incluyendo `"0"`:

```ts
Boolean("0")  // → true  ← ¡INCORRECTO!
Boolean("1")  // → true
Boolean(0)    // → false
Boolean(1)    // → true
```

Esto hacía que todos los logs se leyeran como `completado: true`, o que se
invirtiera la lógica dependiendo del valor exacto recibido.

### Solución
Normalizar el valor con `Number()` antes de la comparación estricta. `Number()`
maneja correctamente todos los tipos posibles:

```ts
// LogRepository.ts — mapRowToLog
completado: Number(row.completado) === 1,
// Number("0") === 0 → false ✓
// Number("1") === 1 → true  ✓
// Number(0)   === 0 → false ✓
// Number(1)   === 1 → true  ✓
```

Se aplicó la misma robustez al guardar, para evitar que valores truthy no-boolean
acaben como `1` en SQLite:

```ts
log.completado === true ? 1 : 0,
```

---

## Error 5 — Desmarcar un hábito guardaba `completado: false`, creando falsos FAILED

### Dónde se encontró
Flujo: Home Screen → desmarcar hábito → Historial para ese día.

### Síntoma
Al desmarcar un hábito que estaba completado, el historial de ese día mostraba
una **X roja** (incumplido), cuando el comportamiento esperado es que no apareciese
ningún indicador (sin registro).

### Por qué se producía
El toggle de `handleToggleHabit` en `index.tsx` siempre guardaba un log, tanto al
marcar (`completado: true`) como al desmarcar (`completado: false`). El historial
interpretaba cualquier log con `completado: false` como "el usuario incumplió
explícitamente ese día".

### Solución
Cambiar la **semántica del toggle** según la dirección de la acción:

- **Marcar** → `addLog({ completado: true })` — guarda el registro de éxito.
- **Desmarcar** → `deleteLog(logId)` — **elimina** la fila de la DB.

Así el historial solo puede ver tres estados limpios:
- Log con `completado: true` → ✓ verde (COMPLETED)
- Sin log + día pasado/hoy → ✗ roja suave (FAILED por ausencia, no por registro negativo)
- Día futuro → sin indicador (NONE)

Se añadió `deleteById` a `LogRepository` y `deleteLog` a `useLogStore` para
soportar esta semántica.

---

## Error 6 — Historial no mostraba X roja en hábitos no realizados días anteriores

### Dónde se encontró
`app/(tabs)/history.tsx`, lógica de resolución de `statusType`.

### Síntoma
Los hábitos de días pasados que no se habían completado aparecían sin ningún
indicador (NONE) en lugar de mostrar la X roja suave esperada.

### Por qué se producía
La lógica original solo derivaba `FAILED` cuando existía un log explícito con
`completado: false`. Como tras la solución del Error 5 esos logs nunca se crean,
la ausencia de un log siempre producía `NONE`, incluso para días ya pasados.

### Solución
Cambiar la condición de `statusType` para derivar `FAILED` de la **ausencia de
log en un día que ya pasó**, no de la presencia de un log negativo:

```ts
// history.tsx — renderItem
if (!isPastOrToday) {
  statusType = 'NONE';           // futuro: sin juzgar
} else if (log && log.completado) {
  statusType = 'COMPLETED';      // completado explícitamente
} else {
  statusType = 'FAILED';         // pasado o hoy sin completar
}
```

Se añadió también un estilo visual `historyItemFailed` (tinte rosado sutil) y
`itemNameFailed` (opacidad 60%) para comunicar el incumplimiento de forma
informativa y no punitiva.

---

## Error 7 — `Unexpected text node` en el badge de racha

### Dónde se encontró
`components/HabitItem.tsx`, badge del contador de racha.

### Síntoma
Warning en la consola:
```
Unexpected text node: . A text node cannot be a child of a <View>.
```

### Por qué se producía
El JSX mezclaba texto literal (emoji + espacios) con expresiones dentro de un
`<Text>`, generando nodos de texto "sueltos" que React Native no admite como
hijos directos de un `<View>`:

```tsx
// ❌ Genera nodos de texto sueltos
<Text>🔥 {displayStreak} {displayStreak === 1 ? 'día' : 'días'}</Text>
//    ^^^     ^^^^^^^^^      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//   texto    expresión             expresión → tres nodos separados
```

### Solución
Unificar todo el contenido en un único string mediante un template literal,
eliminando los nodos de texto intermedios:

```tsx
// ✅ Un único nodo de texto
<Text>{`🔥 ${displayStreak} ${displayStreak === 1 ? 'día' : 'días'}`}</Text>
```

---

## Resumen de aprendizajes clave

| # | Área | Lección |
|---|---|---|
| 1 | Metro / Bundler | Extensiones no estándar como `.wasm` deben registrarse explícitamente en `assetExts` |
| 2 | Ciclo de vida | La inicialización asíncrona de la DB debe **bloquear el render** hasta completarse |
| 3 | SQLite Web | OPFS solo admite **una conexión simultánea** → usar patrón Singleton |
| 4 | SQLite Web | `wa-sqlite` puede devolver INTEGER como **string**; nunca usar `Boolean()` directamente |
| 5 | Semántica de datos | "Sin registro" ≠ "incumplido". Desmarcar debe **borrar** el log, no actualizarlo a `false` |
| 6 | Lógica de UI | El estado FAILED debe derivarse de la **ausencia de éxito** en días pasados, no de registros negativos |
| 7 | React Native JSX | Un `<View>` no admite texto suelto; los strings mixtos deben envolverse en template literals |

---

# Lógica de Negocio — Fase 4: useHabitStats

## 1. Queries SQL de agregación: por qué COUNT en lugar de cargar filas

### El problema que se quería evitar
El patrón ingenuo para calcular estadísticas sería:
```ts
const logs = await logRepo.getByHabit(habitId); // todos los logs
const completed = logs.filter(l => l.completado && l.fecha >= from).length;
```
Con un año de uso diario, `getByHabit` traería >365 objetos `HabitLog` a memoria JavaScript solo para contarlos. En dispositivos de gama baja esto bloquea el JS thread durante la hidratación del hook.

### La solución: agregación en SQLite
Se añadieron dos métodos al `LogRepository`:

```sql
-- getStatsByPeriod (hábito individual)
SELECT
  COUNT(DISTINCT CASE WHEN completado = 1 THEN fecha END) AS totalCompleted,
  (CAST(julianday(?) AS INTEGER) - CAST(julianday(?) AS INTEGER) + 1) AS totalDays
FROM habit_logs
WHERE habitId = ? AND fecha >= ? AND fecha <= ?
```

**Por qué `COUNT(DISTINCT CASE WHEN ...)`:**
- `DISTINCT fecha` evita que múltiples logs el mismo día (edge case poco probable pero posible) inflen `totalCompleted`.
- `CASE WHEN completado = 1` filtra en SQL usando el valor numérico persistido, evitando el gotcha de `Boolean("0") === true` (ver Error 4).

**Por qué `julianday()` para calcular `totalDays`:**
- SQLite no tiene una función nativa `DATEDIFF`. La alternativa habitual es calcular en TS iterando fechas, pero eso es O(días) en JS.
- `julianday()` convierte una fecha ISO a número de días julianos. La resta + 1 da el número de días calendario del rango en una sola expresión SQL.
- Se usa `CAST(... AS INTEGER)` para truncar la parte decimal (julianday devuelve float).

**Por qué el índice existente `idx_habit_logs_habit_fecha` ya cubre estas queries:**
El índice compuesto `(habitId, fecha)` permite que SQLite localice los logs del hábito en O(log N) y recorra solo los del rango de fechas sin leer la tabla completa. El `COUNT(DISTINCT ...)` opera directamente sobre las entradas del índice B-Tree.

---

## 2. Cálculo de `totalDays` en SQL vs. TS

`totalDays` representa el «universo» de días del periodo (no los días en que el hábito debía hacerse según su frecuencia). Esta simplificación es intencional:

- Para `completionRate` de pantalla de resumen, tiene más sentido decir «completaste 15 de los últimos 30 días» que «completaste 15 de los 15 días que tocaba hacer».
- Calcular los días de frecuencia activa requeriría cruzar con `diasSemana` del hábito y aplicar lógica de `WEEKLY`/`MONTHLY`, complejidad que se reserva para una futura iteración.
- Para hábitos `DAILY`, `totalDays` = días del periodo = lo correcto.
- Para hábitos `WEEKLY`, `totalDays` sobreestima el denominador (7× más días que semanas), lo que produce un `completionRate` aparentemente bajo. **Este es un caso borde conocido y documentado.**

---

## 3. Caché Zustand: por qué sin persistencia en AsyncStorage

`useStatsStore` cachea los resultados en memoria (Zustand) pero **no** los persiste en `AsyncStorage`:

1. **Los stats son datos derivados**: son calculables de la DB en ~1 query. Si se persisten, hay que gestionar la invalidación cuando se añaden nuevos logs, lo que añade complejidad sin beneficio real.
2. **Ciclo de vida claro**: el caché vive mientras la app está en memoria. Al relanzar, la primera petición recalcula (una query rápida). No hay riesgo de mostrar datos obsoletos al iniciar.
3. **Invalidación explícita**: `refresh()` y `invalidateHabit(habitId)` permiten al consumidor forzar recálculo cuando sabe que los datos cambiaron (ej. tras un check-in).

---

## 4. Inyección de dependencias en useHabitStats

El hook acepta `_logRepo` y `_habitRepo` como parámetros opcionales para facilitar tests unitarios sin necesidad de mockear módulos (`jest.mock`):

```ts
// En producción (no se pasan repos)
const stats = useHabitStats({ habitId: 'abc', period: 'weekly', userId: 'u1' });

// En tests (repos mockeados)
const stats = useHabitStats({
  habitId: 'abc', period: 'weekly', userId: 'u1',
  _logRepo: mockLogRepo,
  _habitRepo: mockHabitRepo,
});
```

Los repos se guardan en `useRef` para evitar recrearlos en cada render (son objetos sin estado interno).

---

## 5. Casos borde documentados y pendientes

| Caso | Estado | Solución actual |
|---|---|---|
| Hábito sin logs | ✅ Cubierto | Retorna `EMPTY_STATS` (todos 0) |
| `totalDays = 0` (periodo vacío) | ✅ Cubierto | `completionRate = 0`, sin división por cero |
| Hábito `WEEKLY`: `completionRate` sobreestimado | ⚠️ Documentado | Denominador son días calendario, no semanas activas |
| Hábito `MONTHLY`: racha semanal vs mensual | ⚠️ Pendiente | `calculateMaxStreak` asume frecuencia diaria |
| Vista global: `currentStreak` y `maxStreak` | ⚠️ Pendiente | Se pasa `logs=[]` → rachas siempre 0. Requiere `getLogsForRangeGlobal` |
| Zona horaria distinta a UTC | ⚠️ Riesgo conocido | `startOfDay` usa TZ local; si el servidor CI está en UTC y el usuario en UTC+2, los rangos pueden desplazarse 1 día en el límite |
| Hábito eliminado (no encontrado en DB) | ✅ Cubierto | `getById` devuelve null → retorna `EMPTY_STATS` |

