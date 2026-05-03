# Rol
Eres un desarrollador experto en Logic/Data con criterio arquitectónico sólido y obsesión por la corrección, 
el rendimiento y la mantenibilidad del código.
Dominas SQLite en entornos móviles, el Repository Pattern, Zustand y la escritura de funciones puras testeables.

# Objetivo
Implementar las funciones de agregación de datos para el gráfico de barras con la siguiente especificación:

**Contrato de las funciones:**
- `aggregateByWeek(logs: HabitLog[], habit: Habit): ChartData[]`
  - Devuelve 7 entradas, una por día (Lu–Do), con la tasa de cumplimiento de cada día
- `aggregateByMonth(logs: HabitLog[], habit: Habit): ChartData[]`
  - Devuelve entre 4 y 5 entradas, una por semana del mes, con la tasa de cumplimiento de cada semana
- Ambas deben ser una única función parameterizable con `mode: 'weekly' | 'monthly'`

**Tipo de salida `ChartData`:**
```ts
type ChartData = {
  label: string       // Ej: 'Lun' | 'Semana 1' | 'Mar 3'
  value: number       // Tasa de cumplimiento 0–100
  completed: number   // Días completados en el periodo
  total: number       // Días con hábito activo en el periodo
}
```

**Requisitos técnicos:**
- Las funciones deben ser **puras**: mismo input → mismo output, sin efectos secundarios ni acceso a stores
- Ubicarlas en `src/utils/chartAggregator.ts`, separadas del hook que las consuma
- El cálculo de `value` debe ignorar los días donde el hábito no está programado (respetar `frecuencia` y `diasSemana[]` del hábito) — no dividir por días inactivos
- Manejar correctamente meses con 5 semanas: la última entrada debe acumular los días restantes aunque sean menos de 7
- Si `total = 0` en un periodo (ningún día activo), devolver `value: 0` sin dividir por cero

**Requisitos de testing — obligatorio:**
- Test: semana normal con todos los días completados → todos los `value` = 100
- Test: mes con 5 semanas — verificar que se generan 5 entradas y la última no queda vacía
- Test: hábito semanal (solo Lu y Mi activos) — los demás días no deben contar en `total`
- Test: array de logs vacío → devolver estructura con `value: 0` en todos los periodos
- Test: logs con fechas fuera del rango solicitado → ignorarlos sin error

**Casos borde a cubrir o documentar en `LEARNING.md`:**
- Mes que empieza en miércoles: la primera semana tiene menos de 7 días activos
- Hábito creado a mitad de semana: los días anteriores a `fechaInicio` no cuentan como incumplidos
- Logs duplicados para el mismo día (corrupción de datos): contar solo uno
- Cambio de `diasSemana[]` a mitad del periodo analizado: usar la configuración actual del hábito
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