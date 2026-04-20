# Análisis Funcional: Aplicación de Tracking de Hábitos

**Versión:** 1.1  
**Estado:** Decisiones de MVP cerradas  
**Fecha:** Marzo 2026

---

## Tabla de contenidos

1. [Introducción y visión general](#1-introducción-y-visión-general)  
2. [Objetivos del producto](#2-objetivos-del-producto)  
3. [Público objetivo](#3-público-objetivo)  
4. [Modelo de datos](#4-modelo-de-datos)  
5. [Funcionalidades principales (MVP)](#5-funcionalidades-principales-mvp)  
6. [Funcionalidades de engagement y gamificación](#6-funcionalidades-de-engagement-y-gamificación)  
7. [Funcionalidades sociales](#7-funcionalidades-sociales)  
8. [Integraciones externas](#8-integraciones-externas)  
9. [Flujos de usuario](#9-flujos-de-usuario)  
10. [Pantallas y navegación](#10-pantallas-y-navegación)  
11. [Notificaciones](#11-notificaciones)  
12. [Autenticación y cuenta de usuario](#12-autenticación-y-cuenta-de-usuario)  
13. [Plataforma y tecnología](#13-plataforma-y-tecnología)  
14. [Consideraciones de UX](#14-consideraciones-de-ux)  
15. [Benchmarking: aplicaciones de referencia](#15-benchmarking-aplicaciones-de-referencia)  
16. [Priorización de funcionalidades](#16-priorización-de-funcionalidades)  
17. [Preguntas abiertas y decisiones pendientes](#17-preguntas-abiertas-y-decisiones-pendientes)

---

## 1\. Introducción y visión general

La aplicación es un rastreador de hábitos (habit tracker) para dispositivos móviles cuyo objetivo es ayudar a los usuarios a incorporar rutinas positivas a su vida diaria. La propuesta se distingue de aplicaciones similares del mercado por combinar tres pilares: un sistema de tracking claro y sin fricción, estadísticas visuales de progreso, y mecánicas de gamificación inspiradas en el concepto de mascota virtual (Tamagotchi) que condicionan la "salud" del personaje al cumplimiento de los hábitos.

En una primera versión (MVP), la aplicación se centrará en establecer las bases del tracking y la experiencia de usuario antes de incorporar funcionalidades sociales o de monetización.

---

## 2\. Objetivos del producto

- Proporcionar a los usuarios una herramienta sencilla y rápida para registrar el cumplimiento de sus hábitos diarios.  
- Generar estadísticas y visualizaciones de progreso que motiven la constancia.  
- Crear un bucle de engagement basado en gamificación (mascota virtual, rachas, insignias) que disuada al usuario de abandonar la aplicación.  
- Sentar las bases para una futura capa social (leaderboards, retos compartidos) que amplifique la motivación y la viralidad.

---

## 3\. Público objetivo

Usuario principal: persona que desea incorporar o consolidar hábitos saludables en su rutina diaria (deporte, lectura, hidratación, sueño, etc.) y que busca un sistema de seguimiento ligero, visual y motivador en su smartphone.

No existe restricción de edad concreta, pero el tono y la propuesta de gamificación se orientan a un rango de 16 a 40 años, tecnológicamente familiarizados con apps móviles.

---

## 4\. Modelo de datos

### 4.1 Entidad: Hábito (Habit)

Un hábito representa una acción que el usuario quiere repetir con cierta periodicidad.

| Campo | Tipo | Descripción |
| :---- | :---- | :---- |
| id | UUID | Identificador único |
| user\_id | UUID | Usuario propietario |
| nombre | String | Nombre descriptivo del hábito (ej. "Beber 2 litros de agua") |
| descripcion | String (opcional) | Descripción o motivación personal |
| categoria | Enum / String | Etiqueta temática: Salud, Deporte, Productividad, Bienestar, etc. |
| icono | String | Identificador del icono visual asociado |
| color | HEX | Color de identificación visual |
| frecuencia | Enum | Diario / Semanal / Mensual |
| dias\_semana | Array\[Enum\] | Días activos (cuando la frecuencia es semanal) |
| hora\_recordatorio | Time (opcional) | Hora a la que se dispara la notificación |
| tipo\_verificacion | Enum | Booleano (sí/no) — extensible en futuras versiones |
| nivel\_prioridad | Enum | Esencial / Normal / Flexible |
| fecha\_inicio | Date | Fecha desde la que se rastrea |
| fecha\_fin | Date (opcional) | Si el hábito tiene fecha de caducidad |
| activo | Boolean | Si el hábito está en seguimiento activo |

**Nota sobre tipo\_verificacion:** En el MVP se simplifica a booleano (lo hice / no lo hice). En iteraciones futuras se contempla añadir métricas cuantitativas (duración en minutos, número de repeticiones, vasos bebidos, etc.).

### 4.2 Entidad: Registro de Hábito (Habit Log / Occurrence)

Cada vez que el usuario marca un hábito como completado (o no completado), se genera un registro.

| Campo | Tipo | Descripción |
| :---- | :---- | :---- |
| id | UUID | Identificador único |
| habit\_id | UUID | Referencia al hábito |
| user\_id | UUID | Usuario |
| fecha | Date | Día al que corresponde el registro |
| completado | Boolean | Si el hábito fue completado ese día |
| valor | Float (opcional) | Valor numérico asociado (para futuras iteraciones) |
| nota | String (opcional) | Nota libre del usuario sobre ese día |
| timestamp\_registro | DateTime | Momento exacto en que se realizó el registro |

### 4.3 Entidad: Usuario (User)

| Campo | Tipo | Descripción |
| :---- | :---- | :---- |
| id | UUID | Identificador único |
| username | String | Nombre de usuario público |
| email | String | Correo electrónico |
| avatar | String | URL o identificador del avatar |
| fecha\_registro | DateTime | Fecha de alta en la plataforma |
| mascota\_estado | JSON | Estado actual de la mascota (vida, skin, accesorios, nivel) |
| puntos | Integer | Puntos acumulados |

### 4.4 Entidad: Mascota (Pet)

La mascota no es una entidad independiente en base de datos: su estado se almacena como parte del perfil de usuario o en una tabla relacionada. Sus atributos son:

| Campo | Tipo | Descripción |
| :---- | :---- | :---- |
| vida | Integer (0-100) | Nivel de vida de la mascota |
| nivel | Integer | Nivel general alcanzado |
| skin\_activa | String | Skin seleccionada actualmente |
| skins\_desbloqueadas | Array\[String\] | Colección de skins conseguidas |
| accesorios | Array\[String\] | Accesorios desbloqueados |

### 4.5 Entidad: Relaciones sociales (Friendship)

| Campo | Tipo | Descripción |
| :---- | :---- | :---- |
| id | UUID | Identificador |
| user\_id\_origen | UUID | Usuario que envía la solicitud |
| user\_id\_destino | UUID | Usuario que la recibe |
| estado | Enum | Pendiente / Aceptada / Rechazada |

---

## 5\. Funcionalidades principales (MVP)

### 5.1 Creación y gestión de hábitos

El usuario puede crear hábitos personalizados definiendo los parámetros descritos en el modelo de datos (sección 4.1). La interfaz de creación debe ser simple y guiada:

1. El usuario introduce el nombre del hábito.  
2. Selecciona o crea una categoría (con sugerencias predefinidas).  
3. Elige un icono y un color identificativo.  
4. Configura la frecuencia (diario, semanal indicando los días, mensual).  
5. Establece el nivel de prioridad.  
6. Opcionalmente, activa un recordatorio con hora.

Además de crear hábitos desde cero, la aplicación ofrecerá una biblioteca de hábitos predefinidos agrupados por categoría (ver sección 5.5), que el usuario puede adoptar con un solo toque.

El usuario puede editar, archivar o eliminar un hábito existente. Archivar es preferible a eliminar para conservar el historial.

### 5.2 Registro diario (Daily Check-in)

La pantalla principal muestra la lista de hábitos del día en curso. El usuario puede marcar cada hábito como completado con un único toque.

- Los hábitos completados se distinguen visualmente (cambio de color, tachado, desplazamiento al final de la lista o reducción de opacidad).  
- Los hábitos pendientes aparecen en la parte superior, ordenados por nivel de prioridad y, dentro de cada prioridad, cronológicamente según la hora de recordatorio configurada.  
- Se muestra un indicador de progreso diario global (ej. "4 de 6 hábitos completados").

### 5.3 Gestión de rachas (Streaks)

El sistema contabiliza automáticamente las rachas de cumplimiento:

- Racha diaria por hábito: número de días consecutivos en que se ha completado.  
- Racha global: promedio o porcentaje de cumplimiento en los últimos N días.

Las rachas se muestran de forma prominente para incentivar al usuario a no romperlas. Cuando una racha se rompe, la respuesta visual debe ser neutra o suave (no punitiva) para no generar frustración.

### 5.4 Estadísticas y visualizaciones

Pantalla de estadísticas accesible desde el menú principal. Incluye:

- Calendario de calor (heatmap) por hábito: muestra de un vistazo qué días se completó o no, similar al calendar view de GitHub.  
- Gráfico de barras semanal/mensual: porcentaje de cumplimiento por periodo.  
- Racha actual y racha máxima alcanzada para cada hábito.  
- Tasa de éxito global (últimos 7 días, 30 días, total).  
- En versiones futuras: correlaciones entre hábitos (ej. los días que hago ejercicio también duermo mejor).

### 5.5 Biblioteca de hábitos sugeridos y onboarding

Al iniciar la aplicación por primera vez, el usuario pasa por un flujo de onboarding que:

1. Pregunta por sus áreas de interés mediante un cuestionario de selección múltiple (Salud, Productividad, Bienestar mental, Finanzas, Aprendizaje, etc.).  
2. En función de los intereses seleccionados, propone una selección de entre 4 y 8 hábitos predefinidos y relevantes.  
3. El usuario selecciona los que quiere empezar a rastrear (sin obligación de coger todos).  
4. Se pueden añadir más hábitos en cualquier momento desde la biblioteca.

Esto evita que el usuario se encuentre con una pantalla vacía y reduce la fricción inicial. Los hábitos predefinidos incluyen ejemplos como:

- Beber 8 vasos de agua al día  
- Dormir más de 7 horas  
- Leer 20 minutos al día  
- Hacer 30 minutos de ejercicio  
- Meditar 10 minutos  
- Caminar 10.000 pasos  
- Reducir el tiempo de pantalla a menos de 2 horas

---

## 6\. Funcionalidades de engagement y gamificación

### 6.1 Mascota virtual (Tamagotchi)

La mascota es el elemento central de gamificación y diferenciación de la aplicación.

**Estilo visual:** pixel art. Este estilo es coherente con el tono lúdico de la aplicación, tiene un coste de producción de assets asumible y conecta bien con el público objetivo.

**Mecánica principal:**

- La mascota tiene un nivel de vida que oscila entre 0 y 100\.  
- Cada hábito completado aumenta la vida de la mascota (la cantidad depende de la prioridad del hábito: los hábitos Esenciales suman más que los Flexibles).  
- El incumplimiento de hábitos hace que la mascota pierda vida progresivamente.  
- Si la vida llega a 0, la mascota "se va" (no muere, para evitar la connotación negativa). El estado se puede recuperar retomando los hábitos.  
- La mascota sube de nivel conforme el usuario acumula puntos y mantiene rachas.

**Estados emocionales de la mascota:**

La mascota tiene cinco estados visuales diferenciados, mapeados al nivel de vida actual:

| Estado | Rango de vida | Descripción visual |
| :---- | :---- | :---- |
| 1 — Ausente / "Se va" | 0 | La mascota aparece con maletas hechas y aspecto deteriorado. Indica abandono total. |
| 2 — Triste | 1-25 | La mascota llora. Señal de alerta clara para el usuario. |
| 3 — Desconcertada | 26-50 | La mascota muestra una expresión de extrañeza o desconcierto ("¿qué está pasando?"). Estado intermedio. |
| 4 — Animando | 51-75 | La mascota intenta motivar al usuario, expresión de esperanza y aliento. |
| 5 — Feliz | 76-100 | La mascota está contenta y animada. Estado óptimo. |

Las transiciones entre estados deben acompañarse de animaciones suaves. El tono visual siempre debe ser humorístico y afectuoso, nunca angustiante.

**Personalización de la mascota:**

- El usuario puede elegir entre varias especies/tipos de mascota disponibles en el lanzamiento.  
- Se desbloquean skins, colores y accesorios (sombreros, gafas, etc.) mediante consecución de logros y rachas, y puntos acumulados canjeados en una tienda interna.  
- En versiones futuras se contempla la generación procedural de mascotas únicas por usuario mediante IA, donde cada nueva mascota es una variación visual de la del usuario que invitó a la persona a la aplicación (generando un árbol genealógico visual de la comunidad).

**Presencia de la mascota:**

- La mascota es visible desde la pantalla principal en un espacio destacado pero no intrusivo.  
- Su estado visual refleja su nivel de vida con animaciones en pixel art.  
- La mascota puede mostrar mensajes de ánimo, celebración o aviso.

### 6.2 Sistema de puntos y niveles

- Cada hábito completado otorga puntos.  
- Los puntos se acumulan y determinan el nivel global del usuario.  
- El nivel desbloquea nuevas skins, accesorios y funcionalidades.  
- Los puntos también sirven como moneda interna para la tienda de personalización.

### 6.3 Insignias y logros (Badges)

Se otorgan insignias por hitos concretos, entre ellos:

- Primera semana completa de un hábito.  
- Racha de 30 días en cualquier hábito.  
- Completar el 100% de hábitos durante una semana.  
- Alcanzar X días consecutivos de cierto número de hábitos.  
- Primeros 3 meses con al menos un hábito activo.

Las insignias se muestran en el perfil del usuario y generan notificaciones de celebración en el momento de ser conseguidas.

### 6.4 Retos personales

El usuario puede establecer retos con duración definida (ej. "Hacer ejercicio 5 veces a la semana durante un mes"). Al completarlos, recibe recompensas (puntos, insignias, skins).

---

## 7\. Funcionalidades sociales

Las funcionalidades sociales se plantean para una fase posterior al MVP, pero se diseñan ahora para que la arquitectura las soporte desde el inicio.

### 7.1 Añadir amigos

El usuario puede conectarse con otros usuarios mediante:

- Búsqueda por nombre de usuario.  
- Código QR único por usuario.  
- Invitación por correo electrónico o enlace de referido.

### 7.2 Feed de amigos

Una pantalla opcional muestra la actividad reciente de los contactos: hábitos completados, rachas alcanzadas, insignias conseguidas. El usuario puede enviar "ánimos" (reacciones de aliento) a las publicaciones de sus amigos.

### 7.3 Privacidad y visibilidad

El usuario puede configurar qué hábitos son visibles para sus contactos y cuáles son privados. Por defecto, los hábitos son privados.

### 7.4 Leaderboard

Tabla de clasificación basada en el porcentaje de cumplimiento semanal o en puntos acumulados. Puede filtrarse entre:

- Solo amigos.  
- Global (todos los usuarios de la plataforma).

El acceso al leaderboard global requiere tener cuenta registrada.

### 7.5 Retos entre amigos

Los usuarios pueden proponerse retos mutuos: "¿Cuál de los dos hace más días seguidos corriendo este mes?". El sistema registra el progreso de ambos y notifica al ganador al finalizar el plazo.

---

## 8\. Integraciones externas

### 8.1 Google Health / Apple Health

Integración para la importación automática de datos de salud ya registrados por el dispositivo o wearables:

- Pasos diarios.  
- Horas de sueño.  
- Frecuencia cardíaca (para hábitos de ejercicio).  
- Calorías consumidas.

Esto elimina la necesidad de registro manual para hábitos que el dispositivo ya mide, reduciendo la fricción.

La integración es opcional: el usuario debe dar su consentimiento explícito.

### 8.2 Asistente de IA (fase futura)

Se contempla en el roadmap la incorporación de un asistente conversacional que:

- Analice los patrones del usuario y ofrezca sugerencias personalizadas ("He notado que los lunes cumples menos hábitos. ¿Quieres ajustar las metas de ese día?").  
- Ayude al usuario a redefinir hábitos que no está cumpliendo.  
- Genere resúmenes semanales en lenguaje natural.

Esta funcionalidad no forma parte del MVP pero la arquitectura de datos debe contemplarla.

---

## 9\. Flujos de usuario

### 9.1 Primer acceso (onboarding)

Apertura de la app

  └── Pantalla de bienvenida

        └── Opción A: Explorar sin cuenta (modo local)

        └── Opción B: Crear cuenta / Iniciar sesión

              └── Cuestionario de intereses (selección múltiple de áreas)

                    └── Selección de hábitos sugeridos

                          └── Pantalla principal con hábitos iniciales configurados

### 9.2 Registro diario de un hábito

Pantalla principal (lista de hábitos del día)

  └── El usuario toca el hábito que quiere marcar

        └── Si tipo\_verificacion \= booleano: marca directa (completado)

        └── Si el hábito tiene recordatorio activo por notificación:

              └── Respuesta sí/no desde la notificación sin abrir la app

  └── La mascota reacciona visualmente al completar

  └── Se actualiza el indicador de progreso diario

### 9.3 Creación de un nuevo hábito

Pantalla principal o pantalla de gestión de hábitos

  └── Botón "+" / "Nuevo hábito"

        └── Opción A: Desde biblioteca (hábitos predefinidos)

        └── Opción B: Creación personalizada

              └── Nombre → Categoría → Icono y color → Frecuencia → Prioridad → Recordatorio

                    └── Guardar → Vuelve a pantalla principal con nuevo hábito en lista

### 9.4 Consulta de estadísticas

Menú principal

  └── Pestaña "Estadísticas"

        └── Vista global (todos los hábitos)

        └── Vista por hábito individual (seleccionable)

              └── Heatmap, racha actual, racha máxima, tasa de éxito

---

## 10\. Pantallas y navegación

La navegación principal se estructura mediante una barra inferior con las siguientes secciones:

### 10.1 Pantalla principal (Hoy)

- Lista de hábitos del día actual.  
- Indicador de progreso diario (barra o porcentaje).  
- Mascota visible con su estado actual.  
- Acceso rápido a notificaciones pendientes.  
- Hábitos ordenados por: prioridad descendente → hora de recordatorio.  
- Los hábitos completados se desplazan al fondo de la lista y se marcan visualmente.  
- Acceso al historial de días anteriores mediante scroll o selector de fecha.

### 10.2 Pantalla de hábitos (Gestión)

- Listado completo de todos los hábitos activos del usuario.  
- Agrupados por categoría.  
- Acciones: crear, editar, archivar, eliminar.  
- Acceso a la biblioteca de hábitos predefinidos.

### 10.3 Pantalla de estadísticas

- Selector de hábito o vista global.  
- Heatmap mensual.  
- Gráfico de barras por semana/mes.  
- Racha actual y racha máxima.  
- Tasa de cumplimiento por periodo.

### 10.4 Pantalla de mascota / perfil

- Estado visual de la mascota con animaciones.  
- Nivel actual y progreso al siguiente nivel.  
- Insignias conseguidas.  
- Tienda de skins y accesorios.  
- Configuración de cuenta y preferencias.

### 10.5 Pantalla social (fase 2\)

- Feed de amigos.  
- Leaderboard (amigos / global).  
- Gestión de contactos.  
- Retos activos.

---

## 11\. Notificaciones

Las notificaciones son un elemento crítico para el engagement y deben gestionarse con cuidado para no resultar intrusivas. Las notificaciones son obligatorias para el funcionamiento de la aplicación: al instalar la app, se solicitará al usuario el permiso de notificaciones de forma explícita, comunicando que sin ellas la experiencia se ve significativamente reducida.

### 11.1 Recordatorio de hábito

- Se dispara a la hora configurada por el usuario para ese hábito (hora límite en la que ya debería haberse completado).  
- El contenido de la notificación incluye: nombre del hábito e icono.  
- La notificación incluye acciones rápidas directamente desde el panel de notificaciones: "Hecho" / "Posponer". Si el usuario pulsa "Hecho", el hábito se marca como completado sin necesidad de abrir la app.  
- **Política de frecuencia:** cada hábito incumplido genera como máximo una notificación de recordatorio. No se reenvía ni se insiste por el mismo hábito en el mismo día.

### 11.2 Notificación de racha en riesgo

- Si al final del día quedan hábitos sin completar, se envía una notificación de aviso (configurable por el usuario).  
- El tono es motivador, no culpabilizador.

### 11.3 Notificación de logro

- Al conseguir una insignia o alcanzar un nivel, se envía una notificación de celebración.

### 11.4 Notificación de la mascota

- Si el usuario lleva 2 o más días sin abrir la app o registrar hábitos, la mascota genera una notificación personalizada con su estado decaído.  
- La frecuencia y el tono de estas notificaciones deben ser configurables para evitar que el usuario las silencie o desinstale la app.

### 11.5 Notificación social

- Cuando un amigo completa un reto o alcanza una racha destacada.  
- Cuando alguien envía "ánimos" al usuario.  
- Solicitud de amistad recibida.

---

## 12\. Autenticación y cuenta de usuario

### 12.1 MVP: modo completamente offline (sin cuenta)

En el MVP, la aplicación funciona exclusivamente en modo local. No se requiere cuenta, ni registro, ni conexión a internet. Todos los datos se almacenan en el dispositivo del usuario.

Implicaciones:

- No hay sincronización entre dispositivos.  
- No hay acceso a funcionalidades sociales ni al leaderboard.  
- Si el usuario desinstala la app, pierde sus datos (se le comunicará de forma clara en el onboarding).

La app mostrará mensajes no intrusivos que anticipen las ventajas de crear una cuenta en futuras versiones (sincronización, recuperación de datos, funcionalidades sociales).

### 12.2 Autenticación (fase 2\)

En la segunda fase se incorporará la opción de registro:

- Registro con correo electrónico y contraseña.  
- Registro con Google / Apple ID (recomendado para reducir fricción).  
- Al crear la cuenta, los datos locales se migran automáticamente al perfil en la nube.

### 12.3 Sincronización (fase 2\)

- Los datos de hábitos y registros se sincronizarán en tiempo real cuando el dispositivo tenga conexión.  
- En ausencia de conexión, la app funcionará en modo offline y sincronizará al recuperar la conexión.  
- La política de resolución de conflictos (ej. mismo hábito registrado desde dos dispositivos) se definirá en el diseño técnico de la fase 2\.

---

## 13\. Plataforma y tecnología

### 13.1 Plataformas objetivo

iOS y Android.

### 13.2 Estrategia de desarrollo

Se utilizará **React Native con Expo** como framework de desarrollo multiplataforma. Esta decisión se basa en:

- Mayor madurez del ecosistema y comunidad más amplia.  
- Mejor compatibilidad con herramientas de asistencia al desarrollo basadas en IA.  
- Facilidad de integración con APIs nativas (notificaciones push, HealthKit, Google Fit).  
- Capacidad para alcanzar un look and feel suficientemente nativo en ambas plataformas.

### 13.3 Backend

- API RESTful o GraphQL.  
- Base de datos relacional (PostgreSQL recomendado) para el modelo de datos descrito.  
- Servicio de autenticación (Firebase Auth o Auth0 recomendados para agilizar el desarrollo).  
- Almacenamiento en la nube para assets de la mascota y avatares.  
- Servicio de notificaciones push: Firebase Cloud Messaging (FCM) para Android, APNs para iOS.

---

## 14\. Consideraciones de UX

### 14.1 Principio de mínima fricción

Cada interacción debe poder completarse en el menor número de pasos posible. La acción más frecuente (marcar un hábito como completado) debe requerir un único toque. Si requiere más de 3 segundos de interacción, el diseño debe revisarse.

### 14.2 Feedback inmediato

Cada acción del usuario debe tener una respuesta visual instantánea: animaciones de completado, cambio de estado de la mascota, actualización del contador de progreso.

### 14.3 Diseño de la lista de hábitos

- Iconos y colores diferenciados por categoría para identificación rápida.  
- Los hábitos completados deben ser claramente distintos de los pendientes, sin eliminarlos de la vista (el usuario debe poder ver el total del día).  
- Posibilidad de reorganizar la lista manualmente (drag and drop).

### 14.4 Evitar la culpa

Las mecánicas de penalización (pérdida de vida de la mascota, reducción de racha) deben comunicarse con un tono neutro o ligeramente humorístico, nunca culpabilizador. El objetivo es motivar, no presionar.

### 14.5 Personalización visual

La app debe ofrecer suficiente personalización (colores, iconos, mascota) para que el usuario sienta que es "suya". La personalización incrementa el apego emocional a la aplicación.

### 14.6 Pantalla vacía (empty state)

Nunca debe mostrarse una pantalla vacía. Si el usuario aún no tiene hábitos, la pantalla principal mostrará la mascota y un claro llamado a la acción para añadir el primer hábito o explorar la biblioteca.

---

## 15\. Benchmarking: aplicaciones de referencia

A continuación se describen las aplicaciones del mercado más relevantes y las lecciones que pueden extraerse para este proyecto.

**Habitica** es la referencia más directa en gamificación. Convierte los hábitos en un RPG: el usuario crea un avatar y gana experiencia y oro al completar tareas. Incorpora un sistema social robusto con grupos y misiones cooperativas. Su principal debilidad es la curva de aprendizaje y una interfaz visualmente densa. Lección: la gamificación funciona, pero debe mantenerse simple en el MVP.

**Streaks** (iOS) es el referente de simplicidad y diseño minimalista. Se basa en mantener cadenas de días consecutivos. Excelente integración con Apple Health. Su límite es que no soporta hábitos con métricas complejas ni funcionalidades sociales. Lección: el diseño limpio y la rapidez de interacción son prioritarios.

**Loop Habit Tracker** (Android, open source) ofrece visualizaciones detalladas y gran personalización sin cuenta ni publicidad. Lección: el heatmap y las gráficas de tendencia son muy valoradas por los usuarios.

**Fabulous** apuesta por el coaching guiado y los retos colectivos (Circles). Su enfoque es más editorial y menos de tracking puro. Lección: la comunidad y los retos compartidos añaden motivación, pero requieren masa crítica de usuarios.

**Duolingo** (referencia indirecta) demuestra que una mascota con estados emocionales y notificaciones personalizadas genera un engagement extraordinario, incluso convirtiéndose en fenómeno cultural. Lección: la mascota debe tener personalidad y sus notificaciones deben ser memorables.

---

## 16\. Priorización de funcionalidades

### Fase 1 — MVP

- Creación y gestión de hábitos: nombre, categoría, frecuencia (diario/semanal/mensual con configuración de días), prioridad (Esencial/Normal/Flexible), recordatorio con hora límite.  
- Sin límite en el número de hábitos activos.  
- Registro diario booleano exclusivamente (completado / no completado).  
- Pantalla principal con lista diaria y progreso.  
- Sistema de rachas por hábito.  
- Estadísticas básicas (heatmap, racha actual, racha máxima, tasa de éxito).  
- Mascota en pixel art con 5 estados emocionales vinculados al nivel de vida.  
- Notificaciones de recordatorio obligatorias con acción rápida sí/no; máximo una notificación por hábito por día.  
- Funcionamiento completamente offline y local (sin cuenta de usuario).  
- Onboarding con cuestionario de intereses y hábitos sugeridos.  
- Soporte multiidioma desde el inicio: español e inglés.

### Fase 2 — Engagement ampliado

- Sistema de puntos, niveles e insignias.  
- Tienda de skins y accesorios de la mascota.  
- Mascota con animaciones y expresiones emocionales variadas.  
- Notificaciones de la mascota por inactividad.  
- Integración con Google Health / Apple Health.

### Fase 3 — Capa social

- Registro de cuenta y sincronización en la nube.  
- Añadir amigos (búsqueda, QR, invitación).  
- Feed de actividad de amigos y envío de ánimos.  
- Leaderboard (amigos / global).  
- Retos entre amigos.

### Fase 4 — Inteligencia y monetización

- Asistente de IA con análisis de patrones y sugerencias personalizadas.  
- Hábitos predefinidos de pago o suscripción premium (a definir según métricas de uso).  
- Correlaciones entre hábitos en las estadísticas.

---

## 17\. Decisiones tomadas en la reunión de MVP

Las siguientes cuestiones han quedado resueltas y deben considerarse cerradas para el desarrollo de la fase 1\.

**1\. Terminología de niveles de prioridad.** Se utilizan las etiquetas "Esencial", "Normal" y "Flexible" en la interfaz de usuario. La terminología interna "Roca/Viento" queda descartada para la UI.

**2\. Métricas cuantitativas.** El MVP implementa exclusivamente verificación booleana (completado / no completado). Las métricas cuantitativas (duración, repeticiones, unidades) se incorporarán en una iteración posterior sin fecha definida.

**3\. Número máximo de hábitos.** Sin límite en el MVP. La monetización por restricción de hábitos queda pospuesta indefinidamente hasta tener base de usuarios.

**4\. Diseño de la mascota.** Estilo pixel art. Cinco estados emocionales (ausente con maletas / triste con lágrimas / desconcertada / animando / feliz). La generación procedural de mascotas únicas por IA queda como idea para una fase futura avanzada.

**5\. Registro de estado de ánimo.** No entra en el MVP. Se contempla en el roadmap pero sin fecha ni prioridad asignada.

**6\. Framework de desarrollo.** React Native con Expo.

**7\. Política de notificaciones.** Las notificaciones son un requisito funcional de la aplicación y deben solicitarse al instalar. Cada hábito incumplido genera como máximo una notificación por día al llegar a su hora límite. No hay reenvíos ni acumulación.

**8\. Verificación de hábitos en leaderboard.** Pospuesto junto con toda la capa social. No entra en MVP ni en la planificación inmediata.

**9\. Comportamiento offline.** El MVP es completamente offline y local. No hay sincronización ni gestión de conflictos en esta fase. La arquitectura debe prepararse para soportar sincronización en la nube en la fase 2, pero no se implementa ahora.

**10\. Internacionalización.** La aplicación se desarrolla con soporte multiidioma desde el inicio. Los idiomas del lanzamiento son español e inglés. La arquitectura de cadenas de texto (i18n) debe implementarse desde el MVP para facilitar la adición de nuevos idiomas sin refactorizaciones.

---

*Documento elaborado a partir de las sesiones de definición del producto. Versión 1.1 con decisiones de MVP cerradas.*  