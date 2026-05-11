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
// Number("0") === 0 → false 
// Number("1") === 1 → true  
// Number(0)   === 0 → false 
// Number(1)   === 1 → true  
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
- Log con `completado: true` →  verde (COMPLETED)
- Sin log + día pasado/hoy →  roja suave (FAILED por ausencia, no por registro negativo)
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
//  Genera nodos de texto sueltos
<Text> {displayStreak} {displayStreak === 1 ? 'día' : 'días'}</Text>
//    ^^^     ^^^^^^^^^      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//   texto    expresión             expresión → tres nodos separados
```

### Solución
Unificar todo el contenido en un único string mediante un template literal,
eliminando los nodos de texto intermedios:

```tsx
//  Un único nodo de texto
<Text>{` ${displayStreak} ${displayStreak === 1 ? 'día' : 'días'}`}</Text>
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
| Hábito sin logs |  Cubierto | Retorna `EMPTY_STATS` (todos 0) |
| `totalDays = 0` (periodo vacío) |  Cubierto | `completionRate = 0`, sin división por cero |
| Hábito `WEEKLY`: `completionRate` sobreestimado |  Documentado | Denominador son días calendario, no semanas activas |
| Hábito `MONTHLY`: racha semanal vs mensual |  Pendiente | `calculateMaxStreak` asume frecuencia diaria |
| Vista global: `currentStreak` y `maxStreak` |  Pendiente | Se pasa `logs=[]` → rachas siempre 0. Requiere `getLogsForRangeGlobal` |
| Zona horaria distinta a UTC |  Riesgo conocido | `startOfDay` usa TZ local; si el servidor CI está en UTC y el usuario en UTC+2, los rangos pueden desplazarse 1 día en el límite |
| Hábito eliminado (no encontrado en DB) |  Cubierto | `getById` devuelve null → retorna `EMPTY_STATS` |

---

# Lógica de Negocio — Fase 4: useHeatmapData

## 1. Diseño SQL: DATE(fecha) para agrupar por día

El campo `fecha` se persiste con `formatISO()` → produce strings con hora y offset como `2026-05-03T00:00:00+02:00`. Agrupar directamente con `GROUP BY fecha` crearía un grupo por timestamp, no por día. La solución:

```sql
GROUP BY DATE(fecha)
ORDER BY DATE(fecha) ASC
```

`DATE()` extrae la parte de fecha en UTC de cualquier formato ISO 8601, resolviendo la agrupación correctamente. Trade-off: no se puede usar el índice `(habitId, fecha)` en el WHERE con `DATE(fecha)`, pero para 365 logs por hábito el escaneo del subconjunto es despreciable frente a la corrección.

---

## 2. Nuevo índice: `idx_habit_logs_user_fecha`

```sql
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_fecha ON habit_logs (userId, fecha);
```

`getHeatmapGlobal` filtra por `userId` (no por `habitId`). El índice `(habitId, fecha)` no sirve porque SQLite no puede usarlo cuando la primera columna no aparece en WHERE. Sin el nuevo índice → full scan de toda la tabla. Con él → O(log N) para localizar el subconjunto del usuario.

---

## 3. Casos borde del heatmap

| Caso | Estado | Detalle |
|---|---|---|
| Días sin hábitos activos |  Cubierto | Sin logs → sin fila SQL → value=0 en mergeHeatmapData |
| Hábito semanal, día no programado |  Cubierto | Si no hay log ese día, no hay fila → value=0 (no incumplido) |
| Primer uso sin logs |  Cubierto | Array vacío de SQL → 365 entradas value=0, sin error |
| Rango que cruza cambio de año |  Cubierto | `subDays` y `eachDayOfInterval` de date-fns manejan bisiestos y cruces |
| Zona horaria UTC vs local |  Riesgo conocido | `DATE()` en SQLite usa el offset del string ISO; check-ins de madrugada en TZ negativa pueden caer en el día UTC siguiente |
| value=1 en práctica |  Informativo | La app borra logs al desmarcar (Error 5); en la práctica value=1 casi nunca aparece. Las queries lo soportan correctamente si la semántica cambia |
| Modo global: hábito activo sin log |  Limitación conocida | SQL solo evalúa días CON logs. Un hábito activo no completado (sin log) aparece como value=0, no value=1. Requeriría JOIN con habits + lógica de frecuencia en SQL (CTE complejo, reservado para futura iteración) |

---

## 4. mergeHeatmapData: TypeScript vs CTE recursivo en SQL

La alternativa SQL sería un CTE recursivo para generar los 365 días y hacer LEFT JOIN. Se eligió TypeScript porque:
- Los CTEs recursivos tienen compatibilidad limitada en versiones antiguas de SQLite embebido.
- `eachDayOfInterval` de date-fns es más legible y testeable.
- 365 iteraciones en JS son microsegundos; sin impacto de rendimiento medible.

---

# Lógica de Negocio — Fase 4: chartAggregator

## 1. Diseño de `isDayScheduled`

La función determina si el hábito estaba programado para un día dado, respetando `frecuencia`, `diasSemana`, `fechaInicio` y `fechaFin`. Es el discriminador central que hace que `total` solo cuente días activos (sin dividir por días inactivos).

**Convención de `diasSemana`:** usa `date.getDay()` → 0=Dom, 1=Lun, …, 6=Sáb. Coincide con la convención de `frequencyEngine.ts`.

## 2. Casos borde documentados

| Caso | Solución implementada |
|---|---|
| Mes con 5 semanas | `aggregateByMonth` itera semanas ISO completas mientras no superen `monthEnd` → genera 5 entradas naturalmente |
| Mes que empieza en miércoles | La primera semana se recorta con `max([weekStart, monthStart])` → `total` refleja solo los días del mes |
| Hábito creado a mitad de semana | `isDayScheduled` retorna `false` si `day < fechaInicio` → esos días tienen `total=0`, `value=0`, no cuentan como incumplidos |
| Logs duplicados el mismo día | `countDaysInPeriod` usa un `Set<string>` de fechas completadas → deduplicación automática |
| Cambio de `diasSemana` a mitad del periodo | Se usa siempre la configuración **actual** del hábito. No se trackea el historial de cambios de configuración. Si en el futuro se necesita, habría que añadir un campo `diasSemanaHistorial` o similar |
| `total = 0` en un periodo | `computeRate` devuelve `0` explícitamente antes de dividir |
| Logs fuera del rango solicitado | `countDaysInPeriod` itera solo los días del periodo y comprueba si hay log para esa fecha. Logs de otras semanas/meses están en el Set pero nunca se consultan porque su fecha no coincide con ningún día del array |

## 3. `aggregateByMonth`: semanas ISO vs. bloques de 7 días

Se eligieron **semanas ISO** (Lun–Dom) en lugar de bloques fijos de 7 días empezando el día 1 del mes porque:
- Las semanas ISO son el concepto que el usuario percibe como "semana natural".
- Los bloques fijos producen etiquetas confusas para el gráfico (ej: "días 1-7" cruza lunes y martes de semanas distintas).
- date-fns ya proporciona `startOfWeek`/`endOfWeek` con `weekStartsOn: 1`.


---

# Gestión de Assets — Fase 5: Fuentes y Recursos

## 1. Implementación de petAssetResolver y Fallback Visual

Durante la integración de la lógica visual de la mascota, se detectó que los archivos físicos de sprites (`.png`) en `assets/pet/states/` y `assets/pet/skins/` aún no están disponibles.

Para garantizar la disponibilidad visual de la app en cualquier momento:
- Se implementó un sistema de **fallback** en `petAssetResolver(state: PetState)` que utiliza emojis y un `backgroundColor` acorde al estado de la mascota.
- Se configuró la función con un flag `USE_IMAGE_ASSETS` (inicialmente `false`) para que no utilice `require()` en archivos faltantes. Esto previene un error duro de Metro Bundler en tiempo de compilación.
- **Tamaño estándar de assets esperado:** Los PNG finales deben ser de 128x128 píxeles con fondo transparente.
- Este diseño asegura que cuando los assets gráficos definitivos estén listos, la transición solo requiera colocar los archivos en la ruta y cambiar el flag a `true`, sin alterar componentes visuales ni tests.

## 2. Casos Borde y Decisiones de Assets (Fase 5)

| Caso Borde | Impacto / Riesgo | Compensación Aplicada / Recomendación |
| :--- | :--- | :--- |
| **PNG sin fondo transparente** | El sprite taparía el color de fondo del contenedor o el overlay de la barra de vida/UI, rompiendo la estética "pixel-art" limpia. | **Compensación:** Si un asset llega sin canal alfa, se debe remover el fondo mediante edición externa. En `petAssetResolver`, se asume transparencia total para respetar el `backgroundColor` del placeholder. |
| **Diferencias de rendering Emojis (iOS vs Android)** | Los emojis varían en estilo y saturación (3D en Apple, plano en Android/Google). | **Solución:** Se han seleccionado colores de fondo pasteles universales que armonizan con ambas familias de emojis. Se recomienda no usar sombras internas en los contenedores de placeholders para evitar choques visuales. |
| **Licencias restrictivas (Uso no comercial)** | Algunos assets de itch.io/lospec pueden prohibir uso comercial o requerir atribución estricta. | **Protocolo:** Todos los assets externos DEBEN listarse en `assets/LICENSE.md`. En caso de duda o licencia NC (No Comercial), se mantendrá el fallback de emoji o se buscarán alternativas CC0. |
| **Fallo de carga o Asset inexistente** | Un `require` a un archivo físico inexistente rompe el build de Metro. | **Prevención:** El sistema de "doble vía" con `USE_IMAGE_ASSETS` actúa como un disyuntor (circuit breaker). Si se activa, se garantiza que cada `PetState` obligatorio tiene un puntero válido o un fallback defensivo. |

---

# Lógica de Negocio — Fase 5: Lógica de la Mascota (`petLogic.ts`)

## Casos Borde Documentados y Resoluciones

Durante la implementación de `getPetState` y `applyHealthDelta`, se abordaron los siguientes escenarios:

| Caso Borde | Comportamiento Implementado |
| :--- | :--- |
| **Vida baja (`vida = 0`) con check-ins exitosos** | Al aplicar `applyHealthDelta(0, [...completados])`, la suma de deltas positivos levanta la vida por encima de 0, y el `clamp` natural permite la recuperación. La mascota no se queda bloqueada en `absent`. |
| **Vida máxima (`vida = 100`) con exceso de éxito** | Las rachas perfectas generan deltas positivos que superarían los 100 HP. La función clampa estrictamente el techo máximo en `100`, evitando valores imposibles como `120`. |
| **Orden de check-ins mixto** | Al procesar arrays con prioridades dispares (ej. `[Esencial Fallido (-20), Flexible Completado (+5)]`), la lógica suma linealmente un delta neto total antes de sumar a la vida base y aplicar el clamp. El orden de los elementos en el array no altera el resultado final. |
| **Hábitos sin prioridad o prioridad corrupta** | Si llega un hábito con una prioridad no listada en el enum, se ignora su impacto (`delta = 0`) y se lanza un `console.warn` en consola para evitar fallos silenciosos o NaN, garantizando la pureza matemática de la función. |
| **Hábito no realizado / sin log explícito** | Por regla de negocio, un hábito programado que no haya sido completado asume `completado: false` por defecto en la capa de datos. `applyHealthDelta` penaliza este estado aplicando la penalización íntegra según su prioridad, sin interpretarlo como neutral. |

---

# Lógica de Negocio — Fase 5: Job de Penalización Diaria

## 1. Diseño del Job (`useDailyPenaltyJob`)
Se implementó un orquestador silencioso que corre cada vez que la app arranca (`app/_layout.tsx`), evaluando si los hábitos del día anterior se incumplieron y aplicando la penalización correspondiente a la salud de la mascota.

**Características de diseño:**
- **Idempotencia**: Utiliza un registro `lastPenaltyAppliedDate` en el usuario para garantizar que no se apliquen penalizaciones dobles por el mismo día, sin importar cuántas veces se abra o cierre la app.
- **Eficiencia en memoria**: No carga el historial para buscar fallos. Delega la búsqueda a `LogRepository.getMissedHabitsForDate`.
- **Inmunidad a zona horaria**: Utiliza `startOfYesterday()` y formato `YYYY-MM-DD` local, asegurando que "ayer" tenga sentido semántico para el usuario en su zona horaria actual.
- **Short-circuiting**: Si la mascota ya tiene 0 de vida, el job solo actualiza la fecha de ejecución y termina.

## 2. Optimización de la Query de Incumplimientos
La función `getMissedHabitsForDate(date, habits)` implementada en `LogRepository` utiliza el operador `IN` de SQLite para cruzar la lista de hábitos activos con los logs completados en una sola query:

```sql
SELECT habitId FROM habit_logs 
WHERE fecha = ? AND completado = 1 AND habitId IN (...)
```

**Por qué es ultra-eficiente:**
- El índice compuesto `idx_habit_logs_habit_fecha (habitId, fecha)` es utilizado a la perfección. SQLite realiza N búsquedas rápidas (donde N es el número de IDs en la cláusula IN) usando la clave primaria compuesta del índice.
- Devuelve únicamente los IDs de los hábitos que SÍ se completaron. El filtrado final para descubrir los "incumplidos" se hace mediante una simple diferencia de conjuntos (`Set`) en TypeScript. Esto evita traer logs enteros a memoria.

## 3. Casos Borde y Decisiones de Diseño

| Caso Borde | Resolución / Comportamiento |
| :--- | :--- |
| **Zona Horaria (Medianoche)** | El job utiliza `format(new Date(), 'yyyy-MM-dd')` y `startOfYesterday()`. Si un usuario abre la app a las 00:01 AM, "ayer" se resuelve correctamente como el día calendario anterior en hora local, asegurando que la penalización se aplique sobre el día que acaba de terminar. |
| **Hábito Semanal / Inactivo** | Se utiliza `frequencyEngine.getHabitsForToday(habits, yesterday)`. Si ayer el hábito no estaba programado (ej: racha de L-V y ayer fue domingo), el motor lo excluye de la lista de "esperados" y no se genera penalización. |
| **App sin abrir varios días** | **Decisión de Diseño:** El job solo penaliza por "ayer". No es acumulativo. Si el usuario no abre la app en una semana, solo recibirá la penalización del último día incumplido. Esto evita que la mascota muera repentinamente por un periodo de ausencia largo, incentivando el retorno sin ser excesivamente punitivo. |
| **Primera apertura / Sin hábitos** | Si `lastPenaltyAppliedDate` es `null`, el job se ejecuta por primera vez. Si no hay hábitos activos ayer, el delta es `0` y simplemente se registra la fecha de hoy. No se lanzan errores por arrays vacíos. |
| **Vida ya en 0** | Si la mascota ya está en estado `ABSENT` (vida=0), el job registra igualmente la ejecución para hoy pero omite el cálculo de logs y la aplicación de deltas, evitando procesos innecesarios y notificaciones redundantes. |

## 4. Fórmula Final y Decisiones Acordadas

Para responder a las preguntas clave sobre la gamificación de la mascota:

- **Fórmula final (Aditiva por hábito)**: La penalización y recompensa es *por hábito*, no una tarifa plana diaria.
  - Esencial: ±20 HP
  - Normal: ±10 HP
  - Flexible: ±5 HP
  Esto significa que el esfuerzo importa. Fallar 3 hábitos esenciales resta 60 HP. Cumplir 1 esencial y 1 normal suma 30 HP. Se ha implementado un estricto *clamp* matemático que asegura que la vida nunca baje de 0 ni supere 100.
- **¿La penalización es diaria o por hábito incumplido?**: Como se explica en la fórmula, la penalización es **por cada hábito incumplido**, sumando todas las penalizaciones en un delta total negativo. Esto hace que cada pequeña victoria cuente y cada fallo pese proporcionalmente.
- **¿Cuántos días sin abrir la app para que 'se vaya'?**: Actualmente, la app solo evalúa el "día anterior" para no ser tan destructiva si el usuario olvida abrirla un fin de semana (penalización no acumulativa). Sin embargo, se define la regla de **Ausencia Prolongada**: Si el usuario no abre la app por **3 días consecutivos o más**, se considera un abandono. En este caso, la mascota perderá toda su vida y pasará directamente a estado `ABSENT` (vida = 0).

### Prueba de Estrés (Datos Extremos)
Se validó la función pura `applyHealthDelta` con un script de test local (`test-pet.ts`):
- **Vida Inicial: 100**, al recibir nuevos deltas positivos (ej: +30), la función aplica el límite superior. **Resultado: 100**.
- **Vida Inicial: 0**, al recibir deltas negativos (ej: -30), la función aplica el límite inferior. **Resultado: 0**.
- **Recuperación desde 0**, al recibir check-ins positivos (ej: +30), levanta la vida correctamente sin quedarse estancada en negativo. **Resultado: 30**.

---

# Lógica de Negocio — Fase 5: Gamificación (Puntos e Insignias)

## 1. Sistema de Puntos (`pointsEngine.ts`)

### Acumulación de Puntos
Se ha implementado una función pura `calcPointsDelta(habit)` que mapea la prioridad del hábito a puntos:
- Esencial: +20 pts
- Normal: +10 pts
- Flexible: +5 pts

**Casos Borde y Decisiones:**
- **Prioridad desconocida:** Si se recibe un nivel de prioridad no contemplado, la función devuelve `0` como fallback.
- **Deducción de puntos (compras):** `deductPoints(balance, price)` nunca lanza excepciones. Devuelve un tipo `Result` (`{ ok: true, value: number }` o `{ ok: false, error: InsufficientPointsError }`). Esto protege a la UI de crasheos por lógica de negocio.
- **Sincronización Zustand/SQLite:** Para evitar desincronizaciones si la app se cierra a mitad de una transacción, el hook `useHabitCheckIn` llama secuencialmente a `await updatePoints` (que actualiza SQLite de forma síncrona mediante el Repository) y luego Zustand actualiza la UI.

## 2. Sistema de Insignias (`badgeEngine.ts`)

La evaluación de insignias (`evaluateBadges`) es una función pura y *lazy*, que solo se ejecuta sobre logs y no altera la BD por sí misma. Devuelve únicamente las insignias **nuevas** desbloqueadas.

**Casos Borde y Decisiones Documentadas:**
- **`perfect_week` (100% semanal):** Para el MVP, la lógica de validación de semana perfecta verifica si *todos* los hábitos activos (`h.activo === true`) actuales se han cumplido los 7 días de una semana determinada. En un futuro (deuda técnica), se debería evaluar si los hábitos estaban activos *históricamente* en ese rango de fechas usando `fechaInicio` y `fechaFin`, para no invalidar semanas perfectas del pasado por culpa de hábitos añadidos recientemente.
- **`one_month_active`:** Cuenta días con al menos 1 check-in. **Decisión:** Sí se cuentan los check-ins de hábitos archivados o eliminados. El esfuerzo se hizo, independientemente del estado actual del hábito.
- **`streak_7` y `streak_30`:** Se evalúan sobre la racha **actual** (`currentStreak`) y no sobre la racha máxima histórica (`maxStreak`). **Decisión:** Esto incentiva la consistencia en el momento presente ("no nostalgia"), forzando al usuario a mantener su disciplina hoy para ganar el logro.
- **Fallback en `user.createdAt`:** Si la fecha de registro (`fechaRegistro`) es nula o inválida, el *guard* impide que se calcule la insignia `first_week` para evitar errores de tipo `NaN`.
- **Eliminación manual de logs:** ¿Las insignias se re-evalúan o se retiran si el usuario borra logs en el futuro haciendo que deje de cumplir las condiciones? **Decisión:** Fuera del scope del MVP. Se asume como deuda técnica: las insignias ya concedidas no se pueden perder.
