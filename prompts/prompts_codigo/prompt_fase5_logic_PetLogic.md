# Rol
Eres un desarrollador experto en Logic/Data con criterio arquitectónico sólido y obsesión por la corrección, 
el rendimiento y la mantenibilidad del código.
Dominas SQLite en entornos móviles, el Repository Pattern, Zustand y la escritura de funciones puras testeables.

# Objetivo
Implementa el módulo de lógica de la mascota virtual en `src/utils/petLogic.ts`.

Este módulo expone dos responsabilidades puras e independientes:

---

## 1. `getPetState(vida: number): PetState`

Función pura que mapea el nivel de vida actual al estado emocional correspondiente:

| Rango de vida | Estado     |
|---------------|------------|
| 0             | `absent`   |
| 1 – 25        | `sad`      |
| 26 – 50       | `confused` |
| 51 – 75       | `cheering` |
| 76 – 100      | `happy`    |

- La entrada es siempre un entero en el rango `[0, 100]` — valida y lanza error descriptivo si está fuera de rango
- No produce efectos secundarios ni depende de estado externo

---

## 2. `applyHealthDelta(vidaActual: number, hábitos: HabitCheckInResult[]): number`

Función pura que recibe la vida actual y una lista de resultados de check-in del día,
aplica los deltas correspondientes según prioridad y estado de completado, y devuelve
la nueva vida **clampeada siempre a [0, 100]**.

Tabla de deltas por prioridad:

| Prioridad  | Completado | Fallido |
|------------|------------|---------|
| `Esencial` | +20        | −20     |
| `Normal`   | +10        | −10     |
| `Flexible` | +5         | −5      |

Fórmula: Salud_final = clamp(vidaActual + Σ Δ_completados − Σ Δ_fallidos, 0, 100)

- Un hábito sin log para el día cuenta como **fallido** — no como neutro
- La penalización diaria se aplica **una sola vez por día** al abrir la app; 
  el módulo no tiene memoria de si ya se aplicó — esa responsabilidad recae en el hook que lo invoca
- Si `hábitos` es un array vacío, devuelve `vidaActual` sin modificar


**Requisitos técnicos:**
- petAssetResolver(state: PetState): PetAsset debe ser una función pura sin efectos secundarios
- El tipo PetAsset debe discriminar entre { type: 'image', source: ImageSourcePropType } y { type: 'emoji', emoji: string, backgroundColor: string } — el componente visual renderiza según el tipo, sin condiciones adicionales
- Los 5 estados obligatorios son: absent · sad · confused · cheering · happy — debe existir un fallback definido para cada uno aunque no haya PNG
- El tamaño estándar de los PNGs es 128×128px con fondo transparente — verificar antes de integrar; documentar en LEARNING.md si algún asset no cumple y cómo se compensó

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
- Test: `getPetState` devuelve consistentemente el PetState esperado para los 5 rangos de vida
- Test: `applyHealthDelta` suma/resta deltas correctamente según prioridad, clampa a [0, 100] y maneja array vacío
- Test: `applyHealthDelta` trata hábitos sin log como fallidos por defecto
- Test: las funciones son puras, sin efectos secundarios ni dependencias externas

## Casos borde a cubrir o documentar en LEARNING.md:
- vida = 0 con hábitos completados (no debe quedarse bloqueada en absent)
- vida = 100 con más deltas positivos (clamp correcto hacia arriba)
- Array con mezcla de hábitos Esencial fallido + Flexible completado (orden no importa, resultado correcto)
- Hábito sin prioridad definida / prioridad inesperada (lanzar error o ignorar con log)