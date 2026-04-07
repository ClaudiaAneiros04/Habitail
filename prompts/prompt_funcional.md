# Rol

Eres un experto en la creación (de análisis funcional) de aplicaciones móviles, tienes años de experiencia en transmitir unas especificaciones a desarrolladores.

# Contexto

Tenemos una transcripción donde hablan varias personas de una idea en común, que es una aplicación móvil para hacer un tracking de hábitos.

# Objetivo

Elaborar un documento que sintetice los puntos clave de la transcripción. El propósito es establecer un Análisis Funcional bien definido, el cual servirá como base para el desarrollo de la aplicación.

# ¿Cómo hacerlo?

Utiliza la siguiente transcripción que hemos creado:

**Persona 1 (Moderador)**: Entonces empiezas tú diciéndonos. ¿De qué va el tema? ¿No es algo súper extenso? O sea, ¿no, no?

**Persona 2**: A ver, no. O sea, solo se me ocurrió hacer como un traqueador de hábitos y por ejemplo, que pues... aparte de marcar, pues que te ponga como esas típicas gráficas, estadística para ver cómo lo llevas. ¿Y luego aparte?

**Persona 3**: Por ejemplo, yo qué sé, eso ya sería complicarlo más, pero por ejemplo añadirle como un asistente que te diga, pues por ejemplo "he notado que estos días a veces no sé qué" o que le puedas pedir mejoras.

**Persona 1**: Antes de empezar con mejoras das por supuesto que sabemos qué es un traqueador de hábitos, pero intenta explicar qué es un traqueador de hábitos.

**Persona 2**: Pues básicamente tú quieres buscar formar un hábito y asentarlo en tu día a día. Entonces tú en la aplicación creas un hábito y vas marcando que lo haces pues cada día y luego aparte pues meterle parámetros como de cuántas veces tienes que hacerlo. Si es diario, si es semanal, si es mensual...

**Persona 1**: Vamos a centrarnos. Y bueno, estoy diciéndole mucho pero los demás visualizarlo, vamos a centrarnos. ¿Qué vamos a modelar un hábito? ¿Qué es un hábito? ¿Qué parámetros tiene, qué variables? ¿Tiene un nombre, por ejemplo?

**Persona 3**: Por ejemplo ponerlo en categorías, etiqueta, poder crearle como una etiqueta. Sí, poder etiquetarlos para que los demás \[estén\] diferenciados en categorías y saber por ejemplo que es salud. Por ejemplo, hacer ejercicio, mejorar, tener unas horas de sueño diarias, beber tantos litros de agua o vasos, por ejemplo.

**Persona 1**: Entonces también tiene una lo que llamaremos una instancia o una ocurrencia. Es decir, ¿de ese hábito ha ocurrido el lunes a lunes? ¿Eso es el tracking que quieres hacer?

**Persona 2**: Es que cada hábito tiene una ocurrencia... no sé cómo llamarlo. Un evento, bueno, se van guardando los eventos que se han hecho desde arriba.

**Persona 1**: Esos eventos también pueden tener, entiendo, otros valores, como por ejemplo, duración, repeticiones...

**Persona 3**: Sí, depende del tipo de hábitos que queramos. A lo mejor también se le podría añadir algo de cómo de importante es que se haga eso, por ejemplo, porque a lo mejor a ver, todos los hábitos los quieres hacer, pero a lo mejor hay unos que son como esenciales, que quieres hacer sí o sí, por ejemplo, como un nivel de prioridad o algo así. Por ejemplo que estos son, pues, hábitos roca, que son los que tienes que hacer ese mismo día, todos los días, los vitales.

**Persona 1**: Aquí hay una terminología... Bueno, sí, por llamarle una cosa o sí, ¿esto sale de algún sitio llamado roca, es que esto sale de alguna metodología o algo que alguien ha publicado o algo así?

**Persona 3**: No, no es que lo uso yo para intentar hacerlo. No es una terminología, o sea, son unos nombres que le puse yo para acordarme en plan la ver... Le pregunté a la IA pero me dijo en plan puedes poner, para acordarme, hábitos como roca, hábitos viento que son como algunos que puedes... ¿sabes? Sí, sí o sea son como hábitos en plan que tienes que hacer sí o sí y hábitos como viento que son hábitos que aunque no los hagas no pasa nada, ¿sabes? Que no pasaría tanto pero bueno.

**Persona 1**: Hay muchas muy claras. ¿Cómo va a interaccionar el usuario con esos hábitos? O sea, ¿cómo va a crear ese hábito? ¿Cómo va a día a día decir si lo ha hecho o no?

**Persona 4**: Porque por ejemplo para mí ya tendría que quedar algún hábito el hecho de decirle si esto lo hizo, esto no. Habría días que si me tengo que meter en la App y me supone demasiado engorroso que yo tenga que decirle si lo he hecho o no. Igual no es tan simple como decirle un sí o un no, igual algún hábito requiere una duración o de forma parcial. Si es muy engorroso, igual me supone un esfuerzo mayor del beneficio que me da la aplicación.

**Persona 1**: A ver, más cómodo obviamente. Pero por ejemplo, así de saque lo que podríamos pensar es que podemos simplificar los hábitos a que sean sí o no. Por ejemplo, antes de ponerle duración en una primera iteración le ponemos "lo he hecho, no lo he hecho", por ejemplo, en vez de decir cuánto duermes, pues el rollo es "dormir más de 7 horas" o más de 8 horas y definiciones. Y hay un tipo de notificaciones en el móvil que las abres y es sí o no. Tú lo abres, una notificación, y es sí o no y ya no tienes que entrar a la aplicación. Pues con eso por ejemplo ya tendrías resuelto esa parte porque te estaría notificando y dando la brasa. Esa parte yo creo que eso se podría subir así.

**Persona 2**: A ver, a mí lo que se me ocurriera es poner un recordatorio, ya está.

**Persona 1**: ¿Más preguntas? Imaginaos que lo estáis usando. Imaginaos que tenéis como obligación usarla. ¿Qué os resulta incómodo? Esta pregunta de la interacción está bien. O, ¿qué tendría que hacer para ayudaros? Porque el tracking podría ser siempre un seguimiento, pero vamos a intentar que funcione. O sea, que te cree ese hábito.

**Persona 3**: Incentivos, ¿medallitas o algo así? O ganar puntos o competir con otra persona.

**Persona 4**: También yo vi un tío en Notion que tenía una \[plantilla\] como para crear hábitos y demás, y lo tenía montado como si fuese un videojuego. Entonces según iba consiguiendo los hábitos o iba haciendo sus tareas, iba subiendo de nivel, esos niveles le daban recompensas y esas recompensas como que tenía acceso a... imagínate que te gustan los juegos de uno contra uno de batallas, iba desbloqueando mejoras en su equipo para poder seguir pasando niveles recurrentes, pero lo único que iba haciendo era aumentar la vida del Boss o cosas así.

**Persona 1**: Algo simple, pero en ocasiones ni siquiera tiene por qué tener una verdadera recompensa detrás, a veces simplemente con un *badge* que te dice que eres el "más mejor" de dormir, eso a la gente le funciona bastante. Bueno, hay un libro que se llama Hook que está especializado en enganchar a la peña a las aplicaciones porque las personas somos en esencia relativamente parecidos en cuanto a determinadas pulsiones. Y hay estudios de cómo enganchar... la notificación roja de un 1 al lado de un icono de una aplicación claramente hace que tú tengas que ir ahí a mirar qué es. Yo creo que el tema de competir está bien. Por ejemplo, crear tipos de hábitos, después publicarlos e intentar cumplirlos. Y entonces podrías competir con la peña que comparte sus hábitos, como un Marketplace.

**Persona 4**: Pero habría que verificar realmente que esa persona ha hecho ese hábito, ¿no?

**Persona 1**: Claro, pero vamos a basarnos en que la peña que tiene instalado esto es porque quiere generar ese hábito. Entiendo que es porque a la peña le va a importar más competir que no hacerlo.

**Persona 4**: Yo qué sé, dormir, pues para que suba a la leaderboard online, pues tienes que subir una foto de tu reloj que te traqueó las 7 horas que has dormido. Pues eso, si no subes la foto ese día no te cuenta.

**Persona 1**: Hombre, pues si para la leaderboard para que aparezca alguien que eres el mejor tienes que hacer un esfuerzo mayor que darle a un sí... si tú al poner una hora chunga todavía tienes que hacer una foto, es para mal. O sea, no lo he entendido. ¿Para qué vale la foto después de dormir siete horas?

**Persona 4**: Si el objetivo es dormir más de 7 horas, a veces le sacas la foto del tracker. Si no tienes tracker, no puedes competir en conseguir tu medallita de "eres un crack, has dormido 7 horas durante 30 días".

**Persona 3**: Ya pones los anuncios para comprar, no puedes acceder a la leaderboard mundial para aparecer en el resto de la aplicación, pones unos anuncios de unos relojes tal no sé qué y ya haces el business completo, ya está.

**Persona 4**: Después hay hábitos que solo podemos crear nosotros, que la comunidad no puede crear. Si los quieres tener tienes que hacer micropagos. 50 céntimos por hábito.

**Persona 1**: Os adelanto que en general, me parece que las aplicaciones B2C (business to consumer) son como una ruleta rusa, es complicadísimo que funcionen bien. Es más fácil B2B porque conoces un problema de una empresa particular e intentas resolverlo. En B2C las funciones de distribución de los intereses de las personas siguen una cola larga (long tail)... Por qué os comento esto? Para conseguir que una aplicación B2C funcione tienes que invertir muchísimo dinero. Porque las aplicaciones que funcionan son las de siempre. Es complicado, entonces yo lo de monetizar esperaría a que tuviésemos personas apuntadas. Yo creo que el *engagement* es más importante que la monetización; es más importante que la gente se flipe por tenerlo. Vale, entonces vemos un poquito el tema funcional. ¿Qué plataforma?

**Persona 3**: Android o iOS, vale entonces eso quiere decir que o lo programamos dos veces o lo programamos en un entorno multiplataforma.

**Persona 1**: Multiplataforma tiene el problema de que el *look and feel* no se parece tanto, no es tan nativo. Se puede conseguir pero es más complicado.

**Persona 2**: A lo mejor pensé que podrías meter que hubiera yo qué sé, como una mascota dentro y que si no haces los hábitos que se muera o algo así. ¿Sabes? Que tienes que mantenerla viva, un Tamagotchi, pero con tus hábitos. Entonces claro, pues con los hábitos ganas monedas y con esas monedas puedes alimentar a tu mascota o elegir comprar la skin de la mascota, qué manchas tiene, el sombrerito... y se va a centrar en comprar skins.

**Persona 4**: Pero para eso tiene que completarlos. No puedes mantener a tu mascota viva si no cumples tus hábitos, y si no los cumples pierde vida.

**Persona 1**: Vamos a decir que se va, porque morir es un poco negativo, pero para que se enganche la peña... De hecho, creo que hay muchos memes alrededor de Duolingo porque parece ser que está dando la brasa muchísimo para que sigas y el icono de la aplicación cambia y el bicho se vuelve así como... Bueno, entonces ya tenemos un Tamagotchi. Pero vamos a hablar un poco más de los tipos de hábitos. Vamos a poner más ejemplos. Podríamos conectarlo con la aplicación de Fitbit o la de Google Health. Y así ya tenemos que seguir todas sus cositas. Pasos es muy directo. ¿Qué más hábitos?

**Persona 2**: Lectura. Uso del móvil.

**Persona 1**: Reducir el uso del móvil, pero sin embargo, tienes que apuntarlo, pero el uso en la aplicación no cuenta... Vale ahorros, también podemos intentar.

**Persona 4**: ¿Qué más? Calorías, estudios. Asistencias a clase.

**Persona 1**: Puntualidad, bueno eso ya es... Hábitos que también podemos tener "no hábitos": beber menos o salir menos. Oposiciones. Pero vamos a dejarlo en lo legal por lo menos. Por cierto, a partir de mañana los menores ya no pueden comprar en Galicia ni Monster ni nada que se le parezca.

**Persona 4**: Ya no podían, pedían el DNI.

**Persona 1**: Vale vamos a intentar dibujar en nuestra cabeza. ¿Cómo son las pantallas? Entras en la aplicación, ¿qué pasa?

**Persona 2**: De primeras se me ocurre es que te aparezcan como el día, ¿no? Y luego pues que aparezcan como líneas para hacer el check...

**Persona 1**: Hablamos de algo ligero. Simplemente estoy apuntando las cosas, tengo un To-Do list. Y algunas que son verificables cuando intentas hacer check te dice "¿cuál es la prueba?". ¿Entonces te aparecen las del día o las que todavía no has verificado por decirlo de una forma? Porque esto no va por días, puede ir por horas.

**Persona 2**: Sino pues puede aparecer el día, pero que esté como dividida en dos categorías o que las que ya estén hechas, pues que se pongan como más oscuras para que no destaquen tanto, o que se vayan hacia abajo y queden hacia arriba las que no están hechas porque así ya las ves. Se van apilando según ya se tendrían que haber cumplido y todavía no se ha verificado, claro, y cuanto más importante más arriba.

**Persona 1**: Se complica ya... bueno, es cronológico. Lo que podemos poner es el tema de la prioridad o de esos colores. Y así tenemos el orden cronológico y la distinción por colores. Iconos también cuando la creas. Vamos a ir un poco antes. Por ejemplo, ¿te lo dejo hacer sin login? Da mucho *engagement*. Lo que pasa es que si la desinstalas lo pierdes. Pero a lo que voy es que tú puedes utilizar la aplicación y no tienes que crear usuario, ya puedes trabajar con ella. Tendríamos que recordarle que si no crea un usuario no va a funcionar \[a largo plazo\], se lo va a perder. Pero da más *engagement* no tener que hacer usuario.

**Persona 4**: Molaría que tú pudieras utilizar la aplicación en local, pero como que te recomiende crearte la cuenta, lo mítico de "accede a la leaderboard global" y entonces tú quieres acceder y te dice, "no no, pero te tienes que crear una cuenta" y dices tú "bueno, pues ya que estoy aquí me la creo".

**Persona 1**: Digamos que ahora no vamos a monetizar. Lo que vamos a hacer es luchar por el enganche. A lo mejor podríamos partir con alguna cosa ya hecha... ¿Hay algún hábito que a todo el mundo le gustaría hacer? Lo digo porque no mola cuando tú entras a una aplicación y está vacía.

**Persona 2**: Recomendar libros también por ejemplo. En un rollo que es prácticamente un club de lectura. Está bien también.

**Persona 1**: Eso está muy guay... Puedes meter una IA que sepa del libro y comente y tenga la conversación con la gente, y que cada X tiempo cuando todo el mundo ha dicho que ya ha leído el libro, pues se genera un meeting y la peña habla por WhatsApp. Bueno es que yo creo que eso es otro tema, eso no. Vale, bueno, a ver, ¿qué más decíais?

**Persona 3**: A lo mejor, lo que tiene que hacer es no que te aparezca por defecto ya un reto, sino que ya te pregunte "¿Quieres crear un reto?" y te dé unos tipos: leer libro, tal, y entonces que ya te invite a que lo crees. O cuando tú inicias por primera vez la aplicación que tengas un cuestionario, varias opciones a escoger y que tú escojas los temas generales, y en base a esos temas te dé opciones predefinidas. Porque es más fácil que si de 6 opciones que te salen están enfocadas en lo que buscas, conectes más.

**Persona 1**: Resumiría en el típico rollo de fondos de intereses, ir preguntando poco a poco. Porque cuando hay una lista muy grande hay que evitar la pereza. Es importante que lo veas y que tampoco te dé la sensación de que te voy a cobrar al final de todo. Venga, a los demás. Proyectad la voz. ¿Qué hay de agregar amigos? Por nombre de usuario, por código QR, invitación por correo...

**Persona 4**: Eso genera un sentimiento de pertenencia. Eso de los ánimos me parece \[bien\]. Pero entonces deberías escoger aquellos a los que se les notifica cuando haces movidas, no a todos. Y tú puedes mandar ánimos.

**Persona 1**: Hay dos tendencias, la que es que sea muy fácil de compartir para que sea viral, o por invitación que es más exclusivo y mola. Yo creo que hay que partir de una interfaz muy chula, pero muy pequeña. Realmente que la IA nos ayude a poder hacer algo chulo. Si lo hacemos con muchas opciones se nos va a complicar mucho. Mi idea es que partamos de algo muy pequeñito y además que los pasos sean muy pequeños. Alguien tiene que crear la aplicación antes de que los demás puedan participar. ¿Alguien tiene alguna pregunta más o una buena idea sobre la aplicación? Guillermo, Iker y Manu que habéis dicho poco también... Imaginaos que os vais a dejar dinero en esto porque tenéis una corazonada. Esto que hemos hecho hasta ahora es muy vago.

**Persona 5 (Manu/Iker/Guillermo)**: Complicarla mucho por ejemplo si metías a lo mejor como algo relacionado con el ánimo. Por ejemplo que hay un día que estoy muy mal, entonces no me apetece ningún hábito. Te pregunta aparte de los hábitos en plan "¿cómo te sentiste hoy?". Como una correlación y de ahí pues ver qué pasa esos días que estás mal y qué hábitos haces y cuáles no.

**Persona 1**: A ver, de momento ahí me está dando un poco de miedo que si no lo hacemos \[sencillo\] nos complicamos. No lo sé. Bueno a ver. Vamos a partir con lo que tenemos.

## Búsqueda en Internet

Busca en internet aplicaciones similares o ideas que puedan mejorar y/o completar el análisis.

# Indicaciones adicionales

Debe ser un documento completo, exahustivo, que explique de forma clara las funcionalidades de la aplicación, de forma que sirva como documento guía para un grupo de desarrolladores.  

Si detectas que nos falta algo o tienes dudas, o nos hemos olvidado de contar algo importante en la reunion, haznos todas las preguntas necesarias para completar el documento.

# Formato de la respuesta

En markdown, cubriendo todos los apartados necesarios y de forma exhaustiva.

# Cosas a evitar

* Emojis