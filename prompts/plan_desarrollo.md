  
**PLAN DE DESARROLLO DEFINITIVO**

Habit Tracker · Tamagotchi Edition · MVP

*9 semanas · 2 desarrolladores · React Native \+ Expo · Offline-first*

# **1\. Visión general del proyecto**

Este plan combina lo mejor de tres propuestas de desarrollo para crear una hoja de ruta técnica y organizativa completa. El objetivo principal es aprender profundamente el proceso de construcción mientras se entrega un producto funcional al final de cada fase.

La arquitectura es offline-first desde el primer día. Esto significa que toda la lógica de datos se diseña para funcionar sin conexión a internet, con una capa de abstracción (Repository Pattern) que facilitará la migración a la nube en una futura Fase 2\.

## **1.1 Estrategia Dual-Track**

El equipo se divide en dos perfiles complementarios para maximizar el aprendizaje en paralelo y minimizar los bloqueos:

| Área | Dev A — Frontend / UI | Dev B — Logic / Data |
| ----- | ----- | ----- |
| **Navegación** | React Navigation setup \+ transiciones | Deep linking (future proof) |
| **Datos** | UI forms, validaciones y pickers | SQLite \+ Zustand \+ Repository Pattern |
| **Gamificación** | Animaciones mascota (Animated/Moti) | State Machine \+ fórmula de salud |
| **Notificaciones** | UI ajustes \+ textos de mensajes | expo-notifications \+ scheduling logic |
| **i18n** | Revisión de UI en ES/EN | Configuración de i18next y detección automática |
| **QA** | Bugs visuales y empty states | Bugs de lógica, casos borde y performance |

## **1.2 Reglas de trabajo**

1. Daily de 15 minutos al inicio del día: ¿qué aprendí ayer? ¿en qué me bloqueé?

2. Pair programming obligatorio en Semana 2 (SQLite) y Semana 7 (Mascota). Son las fases más críticas.

3. LEARNING.md en el repo: anotar cómo se resolvió cada problema complejo de Expo o React Native.

4. Code review antes de fusionar cualquier rama a develop. Mínimo 1 aprobación.

5. Commits descriptivos con prefijo: feat: / fix: / chore: / docs: / test:

6. Al final de cada fase: demo interna de 30 minutos de lo construido.

# **2\. Cronograma de fases**

| Fase | Duración | Objetivo principal |
| ----- | ----- | ----- |
| **Fase 0** | Semana 1 | Entorno, herramientas, arquitectura base e i18n |
| **Fase 1** | Semanas 2-3 | Modelo de datos, SQLite, Repository Pattern y Zustand |
| **Fase 2** | Semanas 3-4 | CRUD de hábitos: formulario multi-paso y biblioteca |
| **Fase 3** | Semana 5 | Check-in diario, rachas y feedback visual |
| **Fase 4** | Semana 6 | Estadísticas: heatmap estilo GitHub y gráfico de barras |
| **Fase 5** | Semana 7 | Mascota virtual: estados, fórmula de salud y tienda |
| **Fase 6** | Semana 8 | Notificaciones locales, acciones rápidas y onboarding |
| **Fase 7** | Semana 9 | QA, casos borde, pulido UX y build final (EAS) |

## **Leyenda**

| 🟢  Dev A — Frontend / UI | 🟠  Dev B — Logic / Data | 🟡  Pair programming obligatorio |
| :---- | :---- | :---- |

# **3\. Detalle de cada fase**

## **Fase 0 · Semana 1 — Entorno, Arquitectura e i18n**

Objetivo: ambos desarrolladores tienen entorno funcional, proyecto creado, flujo Git establecido, estructura de carpetas acordada, sistema de diseño iniciado y navegación visible en Expo Go. Al terminar, la app muestra 4 pestañas vacías en iOS y Android.

| FASE 0 · Semana 1 — Setup & Arquitectura |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Entorno y herramientas** | **Instalación y verificación** npx create-expo-app HabitTracker \--template blank-typescript npm install \-g expo-cli eas-cli expo doctor → resolver todos los warnings Instalar Expo Go en dispositivo físico | **Extensiones VS Code** ESLint, Prettier, React Native Tools Configurar Android Studio / Xcode Verificar build en iOS y Android con Expo Go Crear .editorconfig compartido |
| **Repositorio y flujo Git** | **GitFlow** git init, .gitignore, primer commit Crear repo GitHub, añadir a Dev B Definir convención de ramas:   main / develop / feature/\* Proteger rama main (require PR) | **Convenciones de commits** feat: fix: chore: docs: test: Crear PR de prueba para validar flujo Configurar ESLint \+ Prettier (airbnb-typescript) Crear LEARNING.md en el repo |
| **Arquitectura de carpetas** | **Estructura (Feature-based)** src/screens/ · src/components/ src/navigation/ · src/theme/ src/i18n/ · src/hooks/ src/utils/ · assets/pet/ | **Estructura (Data layer)** src/store/ · src/storage/ src/types/ · src/services/ src/data/ (habit library JSON) IMPORTANTE: Repository Pattern (abstrae la fuente de datos para migrar fácil a cloud en Fase 2\) |
| **Sistema de diseño** | **Tema y estilos** Crear src/theme/colors.ts (paleta del análisis) Crear src/theme/typography.ts Crear src/theme/spacing.ts (escala 4px) Crear AppProvider envolviendo todo | **Tipos base** Crear src/types/index.ts: Habit, HabitLog, User, Pet, Category (enum), Frequency (enum), Priority (enum), PetState (enum) |
| **Navegación** | **React Navigation** Instalar: @react-navigation/native   @react-navigation/bottom-tabs   @react-navigation/stack   react-native-screens   react-native-safe-area-context Crear 4 pestañas vacías: Hoy / Hábitos / Stats / Mascota | **i18n setup** Instalar: i18next react-i18next expo-localization Crear src/i18n/es.json y en.json Configurar detección automática del idioma del dispositivo Convención de claves: pantalla.sección.clave |

| 💡 | Aprendizaje clave de la semana Ciclo de vida de componentes React Native y cómo funciona el hot-reload de Expo. Diferencia entre Expo Managed Workflow y Bare Workflow: ¿cuándo cambiar? Repository Pattern: ¿por qué abstraer la fuente de datos desde el día 1? |
| :---: | :---- |

## **Fase 1 · Semanas 2-3 — Motor de Datos: SQLite, Repository y Zustand**

Objetivo: toda la capa de datos está definida, probada y accesible a través del Repository Pattern. La app puede guardar, leer y eliminar hábitos entre reinicios. Los stores de Zustand están hidratados al arrancar. Incluye sesión de pair programming para definir el esquema SQLite.

| FASE 1 · Semanas 2-3 — Modelo de Datos & Persistencia |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Modelo de datos** | **Tipos TypeScript completos (Dev A revisa)** Habit: id, userId, nombre, descripcion, categoria, icono, color, frecuencia, diasSemana\[\], horaRecordatorio, tipVerificacion, nivelPrioridad, fechaInicio, fechaFin, activo HabitLog: id, habitId, userId, fecha, completado, nota, timestampRegistro | **Repository Pattern (implementación)** Crear src/storage/HabitRepository.ts   get(), getById(id), save(habit)   update(id, changes), archive(id) Crear src/storage/LogRepository.ts   save(log), getByHabit(habitId)   getByDate(fecha) Crear src/storage/UserRepository.ts   get(), save(user) |
| **Motor de persistencia** | **AsyncStorage (testing inicial)** Instalar @react-native-async-storage/async-storage Verificar read/write/delete Escribir prueba manual en una pantalla de debug (luego se elimina) | **Expo SQLite (persistencia real)** Instalar expo-sqlite Crear src/storage/database.ts Definir y ejecutar migrations:   CREATE TABLE habits...   CREATE TABLE habit\_logs... Conectar a través del Repository |
| **Estado global Zustand** | **habitStore.ts** Instalar: zustand state: { habits: Habit\[\] } actions: loadHabits, addHabit,   updateHabit, archiveHabit, removeHabit Hidratación desde Repository en startup | **logStore.ts y petStore.ts** logStore: { logs, addLog, loadLogs, getLogsForDay } petStore: { pet: Pet, updateHealth, levelUp } userStore: { user, updateUser } Todos hidratan desde Repository al iniciar |
| **🤝 Pair programming (2h)** | Definir juntos el esquema final de SQLite. Cada columna debe tener un nombre acordado y un tipo claro. Documentar en LEARNING.md: «¿Por qué SQLite en vez de AsyncStorage para los logs?» Escribir tests unitarios para el cálculo de rachas (función pura, sin UI). |  |
| **Datos seed** | Solo revisar y validar el JSON final | **Biblioteca de hábitos** Crear src/data/habitLibrary.ts 20+ hábitos predefinidos por categoría Cada item: nombre, descripcion, categoria,   icono, color, frecuencia, nivelPrioridad Usado en onboarding y biblioteca en la app |

| 💡 | Aprendizaje clave de la semana Modelado de datos relacionales en entornos móviles: SQLite vs AsyncStorage (¿cuándo usar cada uno?). Repository Pattern: la interfaz del repositorio no cambia aunque cambie la fuente de datos. Zustand vs Context API: ventajas de un store minimalista sin boilerplate. |
| :---: | :---- |

## **Fase 2 · Semanas 3-4 — Gestión de Hábitos: CRUD y Biblioteca**

Objetivo: el usuario puede crear hábitos personalizados a través de un formulario multi-paso, elegir de una biblioteca predefinida y gestionar (editar, archivar, eliminar) sus hábitos. El motor de frecuencias determina qué hábitos aparecen cada día.

| FASE 2 · Semanas 3-4 — CRUD & Biblioteca de Hábitos |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Pantalla Gestión de Hábitos** | **HabitsScreen** SectionList agrupado por categoría Cada item: icono \+ color \+ nombre \+ racha FAB (+) para nuevo hábito Swipe-to-archive con confirmación Long press → menú contextual | **Motor de frecuencias** Crear src/utils/frequencyEngine.ts getHabitsForToday(habits\[\], date) → Habit\[\] Lógica para DAILY / WEEKLY(días) / MONTHLY Deve ser una función pura y testeable Escribir 5 tests en Jest |
| **Formulario de creación (multi-paso)** | **Paso 1: Nombre \+ Categoría** TextInput con validación (≥2 chars) CategoryPicker: grid con iconos y colores Botón Siguiente desactivado si inválido **Paso 2: Icono \+ Color \+ Descripción** IconPicker (grid scrollable @expo/vector-icons) ColorPicker (12 tonos HEX \+ preview del hábito) | **Paso 3: Frecuencia \+ Prioridad \+ Recordatorio** FrequencyPicker: Diario / Semanal / Mensual Si Semanal: DaySelector (Lu–Do con CheckBox) PriorityPicker: Esencial / Normal / Flexible TimePicker: toggle \+ DateTimePicker nativo Guardar → habitStore.addHabit() → navegar |
| **Biblioteca de sugerencias** | **HabitLibraryScreen** Tabs por categoría Lista de hábitos disponibles Botón «Añadir» → instancia con defaults Accesible desde FAB secundario en HabitsScreen | **Conexión con store** Cuando usuario añade de biblioteca:   Crear nuevo Habit con id \= uuid()   Llamar habitStore.addHabit()   Navegar a HomeScreen Verificar que aparece en la lista |

| 💡 | Aprendizaje clave de la semana Formularios multi-paso en React Native: validación por paso y estado compartido. Motor de frecuencias: función pura \+ tests, independiente de la UI. SectionList vs FlatList: cuándo usar listas agrupadas. |
| :---: | :---- |

## **Fase 3 · Semana 5 — Check-in Diario, Rachas y Feedback**

Objetivo: la pantalla principal muestra los hábitos del día ordenados correctamente, el usuario los marca con un toque, el sistema calcula rachas en tiempo real y la mascota reacciona al momento. Incluye sesión de pair programming para resolver casos borde de fechas.

| FASE 3 · Semana 5 — Daily Check-in & Streaks |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Pantalla principal (Hoy)** | **HomeScreen** Cabecera: fecha \+ saludo según hora del día FlatList de hábitos del día Orden: Prioridad DESC → horaRecordatorio ASC Hábitos completados: al fondo \+ opacidad 50% Selector de fecha (solo al pasado) Indicador de progreso: barra animada \+ texto | **useHabitCheckIn hook** markComplete(habitId, fecha) → HabitLog markIncomplete(habitId, fecha) → toggle getStatusForDay(habitId, fecha) → boolean Integrar con logStore y Repository Actualizar petStore automáticamente al hacer check |
| **HabitItem component** | **Componente visual** Icono de color \+ nombre del hábito Badge de racha: 🔥 N días Checkbox con animación de completado (usar react-native Animated o Moti) Estado visual: pendiente vs completado | **Micro-interacciones** Bounce animation al completar (Animated.spring) Cambio de color animado Si completas todos: lanzar confetti   (react-native-confetti-cannon) Actualización de barra de progreso en tiempo real |
| **Lógica de Rachas** | Solo integrar el output en la UI (badges en HabitItem y HabitDetailScreen) | **src/utils/streakCalculator.ts (función pura)** calculateCurrentStreak(logs\[\], habit) → number calculateMaxStreak(logs\[\]) → number calculateCompletionRate(logs\[\], days) → number Considerar frecuencia del hábito Escribir tests: racha normal, racha rota,   hábito semanal, cero logs |
| **Historial** | **Vista histórica** Mostrar hábitos del día seleccionado Completados: check verde ✓ Incumplidos: X roja suave (no punitiva) Futuros: sin estado | **Queries históricas** getLogsForRange(habitId, from, to) → HabitLog\[\] Eficiente en SQLite con índice por fecha Documentar en LEARNING.md el índice SQL usado |
| **🤝 Pair programming (2h)** | Revisar juntos el cálculo de rachas. Caso borde crítico: ¿qué ocurre si el usuario cambia la zona horaria del teléfono? Caso borde: hábito semanal donde 'hoy' no es un día activo. Documentar los casos borde encontrados en LEARNING.md. |  |

| 💡 | Aprendizaje clave de la semana Manipulación de fechas con date-fns / dayjs: zonas horarias, días de la semana, comparaciones. Animaciones con Animated API: spring, timing, interpolation. Funciones puras con tests: la lógica de rachas nunca debe depender de la UI. |
| :---: | :---- |

## **Fase 4 · Semana 6 — Estadísticas: Heatmap y Gráficos**

Objetivo: pantalla de estadísticas con heatmap estilo GitHub y gráfico de barras semanal/mensual. Los datos se calculan con queries SQL optimizadas y se cachean en Zustand para no recalcular en cada render.

| FASE 4 · Semana 6 — Estadísticas & Visualizaciones |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Pantalla Estadísticas (layout)** | **StatsScreen** Selector de hábito (DropDown) — vista global por defecto Tabs: Semanal / Mensual / Total 4 StatCards: Racha actual, Racha máxima,   Tasa 7d, Tasa 30d Instalar: react-native-chart-kit | **useHabitStats(habitId?, period) hook** completionRate: number (0–100) currentStreak, maxStreak totalCompleted, totalDays Consultas SQL optimizadas (no cargar todos los logs) Cachear resultado en Zustand para no recalcular |
| **Heatmap** | **HeatmapCalendar component** Grid de 52 semanas × 7 días (estilo GitHub) 4 tonos de color según completitud:   sin datos | \<25% | \<75% | 100% Eje X: meses abreviados Scroll horizontal para navegar | **useHeatmapData(habitId?) hook** Output: { date: string, value: 0|1|2 }\[\] 0 \= sin log · 1 \= incumplido · 2 \= completado Agrupar por hábito o global Optimizar con ventana de 1 año máximo |
| **Gráfico de barras** | **BarChartComponent (reutilizable)** Mode: 'weekly' | 'monthly' Semanal: 7 barras Lu–Do Mensual: 4-5 barras por semana Tooltip al presionar: «Semana X: N%» Colores del tema de la app | **Procesado de datos para gráfico** aggregateByWeek(logs\[\], habit) → ChartData\[\] aggregateByMonth(logs\[\], habit) → ChartData\[\] Misma función parameterizable Verificar que maneja meses con 5 semanas |

| 💡 | Aprendizaje clave de la semana Renderizado de SVGs en React Native y librerías de gráficos (react-native-chart-kit, victory-native). Procesamiento de arrays para visualización: agrupación por semana, mes, rango. Optimización de queries SQLite con índices y EXPLAIN QUERY PLAN. |
| :---: | :---- |

## **Fase 5 · Semana 7 — Mascota Virtual: Estados, Fórmula de Salud y Tienda**

Objetivo: la mascota reacciona visualmente al cumplimiento de hábitos según la fórmula de salud definida. El usuario puede personalizar skins y accesorios. Incluye sesión de pair programming para definir y validar la fórmula final.

| FASE 5 · Semana 7 — Mascota & Gamificación |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Assets pixel art** | **Gestión de assets** Organizar en assets/pet/states/   absent.png · sad.png · confused.png   cheering.png · happy.png assets/pet/skins/ (2 skins alt.) assets/pet/accessories/ (4-6 items) Tamaño estándar: 128×128px PNG transparente | **Fuentes de assets gratuitos** lospec.com — paletas y sprites libre itch.io/game-assets/free/tag-pixel-art Si no hay tiempo de diseñar:   Usar emojis \+ fondos de color   como placeholder funcional Documentar licencias en assets/LICENSE.md |
| **Máquina de estados** | **PetScreen visual** Imagen centrada 200×200px Barra de vida animada (0–100) Nombre del estado: «¡Estoy feliz\!» Nivel \+ XP para siguiente nivel Fade in/out entre estados (Animated) Mensaje de ánimo según estado | **src/utils/petLogic.ts** getPetState(vida) → PetState 0=absent · 1-25=sad · 26-50=confused 51-75=cheering · 76-100=happy HealthDelta por check-in: Esencial completado: \+20  fallido: \-20 Normal completado:   \+10  fallido: \-10 Flexible completado: \+5   fallido: \-5 Rango siempre 0–100 |
| **Integración pet \+ check-in** | **Feedback visual al marcar hábito** Mostrar mini-mascota en HomeScreen (esquina, 60px, solo cara) Animar al completar un hábito (salto) Mostrar delta: «+10 ❤️» | **Job diario de penalización** Al abrir la app al día siguiente:   Calcular hábitos incumplidos de ayer   Aplicar penalización a la vida   Actualizar petStore No penalizar dos veces el mismo día |
| **🤝 Pair programming (2h)** | Definir juntos la fórmula final de la mascota. Preguntas clave: ¿Cuántos días sin abrir la app para que 'se vaya'? ¿La penalización es diaria o por hábito incumplido? Decidir y documentar en LEARNING.md. Probar la mascota con datos ficticios extremos (vida=0, vida=100). |  |
| **Gamificación — Puntos e insignias** | **Tienda visual (ShopScreen)** Tabs: Skins / Accesorios ShopItem: preview \+ precio \+ botón Comprar/Equipar Saldo de puntos visible Item bloqueado si puntos insuficientes | **Lógica de puntos** Puntos \= hábito completado × factor prioridad Esencial=20 · Normal=10 · Flexible=5 Descontar al comprar en tienda Persistir en userStore y Repository 5 insignias MVP: Primera semana,   Racha 7d, Racha 30d, 100% semanal, 1 mes activo |

| 💡 | Fórmula de salud de la mascota (de Plan 2\) Salud\_final \= clamp(Salud\_actual \+ Δ\_completados − Δ\_fallidos, 0, 100\) Completado: Esencial \+20 · Normal \+10 · Flexible \+5 Fallido:    Esencial −20 · Normal −10 · Flexible −5 La penalización por hábitos fallidos se aplica una vez al día, al abrir la app al día siguiente. Si vida \= 0 → estado 'ausente' (con maletas). La notificación de inactividad no se envía en este estado. |
| :---: | :---- |

## **Fase 6 · Semana 8 — Notificaciones y Onboarding**

Objetivo: las notificaciones de recordatorio funcionan con acciones rápidas desde el panel del sistema, y el flujo de onboarding guía al nuevo usuario hasta tener sus primeros hábitos creados. La primera experiencia de usuario es completa y sin pantallas vacías.

| FASE 6 · Semana 8 — Notificaciones & Onboarding |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Permisos y scheduling** | **UI de permisos** Pantalla explicativa ANTES del prompt del sistema:   «Sin notificaciones pierdes X funcionalidad» Botón «Activar notificaciones» → requestPermissions() Si rechaza: mostrar banner recurrente en HomeScreen | **src/notifications/notificationService.ts** Instalar: expo-notifications scheduleHabitReminder(habit) → void cancelHabitReminder(habitId) → void rescheduleAll() → void (llamar al editar hábito) 1 notif/día/hábito · no reenviar en el mismo día |
| **Acciones rápidas** | **UI feedback** Al pulsar «Hecho» desde notificación:   HomeScreen se refresca automáticamente   Mini-animación de confirmación Al pulsar «Posponer»:   Badge en HomeScreen «Pospuesto 30 min» | **Categorías de notificación** configurar notification categories:   HABIT\_REMINDER:     action DONE (Hecho)     action SNOOZE (Posponer 30min) Handler DONE: markComplete sin abrir app Handler SNOOZE: reschedule \+30min (1 vez/día) |
| **Notificación de mascota e inactividad** | **Solo aportar textos de los mensajes** 5 mensajes por estado en ES \+ EN Tono: afectuoso y humorístico, nunca culpabilizador Ejemplo sad: «Oye… ¿sigues ahí? Te echo de menos 🥺» | **Lógica de inactividad** Si usuario no abre la app en 2 días:   Enviar notif con estado actual de mascota   Límite: 1 notif de mascota cada 48h Almacenar lastOpenedAt en userStore No enviar notif de mascota si vida=0 ya ('se fue') |
| **Onboarding** | **OnboardingNavigator (Stack separado)** Pantalla 1: Bienvenida \+ nombre de mascota Pantalla 2: MultiSelect de áreas de interés   (Salud, Deporte, Productividad, Bienestar,    Finanzas, Aprendizaje) Pantalla 3: Hábitos sugeridos filtrados por área Botón «Empezar» → crear hábitos \+ navegar a Home | **Lógica de onboarding** onboardingCompleted flag en AsyncStorage Si flag=false → RootNavigator muestra Onboarding Si flag=true → muestra App normal Filtrar habitLibrary por categorías seleccionadas Crear los hábitos seleccionados en el store Marcar flag al finalizar |

| 💡 | Aprendizaje clave de la semana Gestión de permisos del sistema: cómo pedir permiso con el momento y contexto correctos. expo-notifications: la diferencia entre notificaciones locales y push (esta fase \= solo locales). Background tasks en Expo: limitaciones de iOS vs Android para tareas en segundo plano. |
| :---: | :---- |

## **Fase 7 · Semana 9 — QA, Pulido y Build Final**

Objetivo: el MVP está libre de bugs críticos, tiene empty states en todas las pantallas, animaciones de feedback, y puede distribuirse mediante EAS Build. Los casos borde documentados en Plan 2 son una guía obligatoria de testing.

| FASE 7 · Semana 9 — QA, Pulido & Entrega |  |  |
| ----- | ----- | ----- |
| **Área** | **Dev A — Frontend / UI** | **Dev B — Logic / Data** |
| **Testing manual** | **Flujo completo iOS \+ Android** Onboarding → Crear hábito → Check-in → Ver estadísticas → Ver mascota → Recibir notificación → Acción rápida Reportar bugs en GitHub Issues con:   dispositivo \+ OS version \+ screenshot | **Casos borde críticos (de Plan 2\)** ¿Cambio de zona horaria del teléfono? ¿Racha con hábito semanal en día no activo? ¿Qué pasa si se abre la app a las 00:01? ¿SQLite con 1000+ logs (rendimiento)? ¿Notificación si permisos revocados? Documentar en LEARNING.md los bugs encontrados |
| **Bugs y correcciones** | **Focus UI** Glitches en animaciones de mascota Layout roto en pantallas pequeñas (SE) Textos cortados en modo inglés Empty states: todas las pantallas deben   tener un estado vacío ilustrado \+ CTA | **Focus lógica** Rachas incorrectas en casos borde Penalización de mascota aplicada dos veces SQLite queries lentas con muchos logs Notificaciones duplicadas al editar hábito FlatList con muchos hábitos (usar getItemLayout) |
| **Pulido UX** | **Animaciones de feedback** Confetti al completar todos los hábitos del día Transiciones de pantalla personalizadas Efecto «shake» si intenta navegar sin guardar Loading skeletons en listas (no spinners) | **Performance** Memoizar componentes pesados (React.memo) Evitar re-renders en FlatList (keyExtractor estable) Optimizar queries SQLite con EXPLAIN QUERY PLAN Verificar memoria con Expo DevTools |
| **Build y entrega** | **app.json y assets** Nombre, slug, icono (1024×1024) Splash screen bundleIdentifier \+ package name eas.json con perfil preview Comando: eas build \--platform all \--profile preview | **Documentación final** README.md: setup, scripts, arquitectura CHANGELOG.md: todo lo implementado LEARNING.md: problemas y soluciones Architecture.md: diagrama de carpetas y Repository Pattern explicado |

| 💡 | Casos borde obligatorios (de Plan 2 — no ignorar) ¿Qué ocurre si el usuario cambia la zona horaria del teléfono a medianoche? ¿Hábito semanal donde 'hoy' no es un día activo? ¿Aparece? ¿Cuenta en la racha? ¿Qué pasa si la app se abre exactamente a las 00:01? ¿Cambia el día correctamente? ¿SQLite con 1000+ logs? Medir el tiempo de consulta con un dataset simulado. ¿Notificación si los permisos fueron concedidos y luego revocados desde ajustes del sistema? |
| :---: | :---- |

# **4\. Checklist de entregables del MVP**

| ✓ | Entregable del MVP |
| ----- | ----- |
| ☐ | Crear, editar, archivar y eliminar hábitos (nombre, categoría, icono, color, frecuencia, prioridad, recordatorio) |
| ☐ | Biblioteca de 20+ hábitos predefinidos agrupados por categoría |
| ☐ | Motor de frecuencias: filtrar hábitos del día según configuración (diario / semanal / mensual) |
| ☐ | Pantalla Hoy con lista diaria ordenada por prioridad y hora, y selector de fecha al pasado |
| ☐ | Marcar hábito como completado con un toque — feedback visual inmediato (animación \+ delta de vida) |
| ☐ | Cálculo y visualización de racha actual y máxima por hábito (función pura \+ tests) |
| ☐ | Indicador de progreso diario global (barra animada \+ texto «N de M hábitos») |
| ☐ | Heatmap mensual de cumplimiento por hábito (estilo GitHub, 4 tonos de color) |
| ☐ | Gráfico de barras semanal y mensual con tasa de cumplimiento y tooltip interactivo |
| ☐ | Mascota pixel art con 5 estados emocionales vinculados al nivel de vida (0–100) |
| ☐ | Fórmula de salud basada en prioridad: Esencial ±20 · Normal ±10 · Flexible ±5 |
| ☐ | Tienda de personalización: skins y accesorios desbloqueables con puntos |
| ☐ | 5 insignias MVP: Primera semana, Racha 7d, Racha 30d, 100% semanal, 1 mes activo |
| ☐ | Notificaciones de recordatorio a la hora configurada (máx. 1/hábito/día, sin reenvíos) |
| ☐ | Acciones rápidas «Hecho» y «Posponer 30min» desde el panel de notificaciones sin abrir la app |
| ☐ | Notificación de mascota por 2+ días de inactividad (máx. 1 cada 48h, tono afectuoso) |
| ☐ | Onboarding con cuestionario de intereses y selección de hábitos sugeridos filtrados |
| ☐ | Funcionamiento completamente offline y local — sin cuenta de usuario |
| ☐ | Soporte multiidioma español \+ inglés desde el inicio (i18next) |
| ☐ | Repository Pattern implementado: capa de datos intercambiable para futura migración cloud |
| ☐ | Empty states ilustrados en todas las pantallas vacías |
| ☐ | LEARNING.md con soluciones a problemas complejos y casos borde documentados |
| ☐ | Build de preview distribuible generado con EAS Build (iOS \+ Android) |

# **5\. Recursos de aprendizaje por tecnología**

**Expo & React Native**

* docs.expo.dev — documentación oficial (punto de entrada principal)

* reactnative.dev/docs — guía oficial de React Native

* YouTube: «React Native Crash Course» — Traversy Media

**Navegación**

* reactnavigation.org/docs — React Navigation docs

* Consejo: probar todos los ejemplos del playground antes de implementar en el proyecto

**Base de datos**

* docs.expo.dev/versions/latest/sdk/sqlite — Expo SQLite

* sqlite.org/lang\_explain.html — EXPLAIN QUERY PLAN para optimizar queries

* Comparar con AsyncStorage para entender cuándo usar cada uno

**Estado global**

* docs.pmnd.rs/zustand — Zustand (minimalistas y muy claros)

* Comparar con React Context para entender cuándo cada uno es mejor

**Fechas y tiempo**

* date-fns.org — date-fns (recomendada por ser modular y tree-shakeable)

* day.js.org — alternativa más ligera

* Atención especial a: getDay(), startOfDay(), isSameDay(), differenceInCalendarDays()

**Animaciones**

* reactnative.dev/docs/animated — Animated API nativa

* moti.fyi — Moti (basada en Reanimated, más declarativa)

* docs.swmansion.com/react-native-reanimated — Reanimated 3 (para animaciones avanzadas)

**Notificaciones**

* docs.expo.dev/push-notifications/overview — Expo Notifications

* IMPORTANTE: testear siempre en dispositivo físico. El simulador no es fiable para notificaciones.

**Pixel Art & Assets**

* lospec.com — paletas y recursos gratuitos de pixel art

* itch.io/game-assets/free/tag-pixel-art — assets libres de derechos para sprites

**Build y distribución**

* docs.expo.dev/build/introduction — EAS Build

* docs.expo.dev/eas-update/introduction — EAS Update (actualizaciones OTA)

*Plan de Desarrollo Definitivo · Habit Tracker MVP · v2.0 · Marzo 2026*  