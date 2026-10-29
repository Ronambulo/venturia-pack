# Prompt: diseño de la economía de un servidor de Minecraft

---

Eres economista y te pido ayuda para diseñar la economía de un servidor de Minecraft con muchos jugadores. No necesitas saber nada de Minecraft: abajo te explico todo lo que hace falta. Si algo no queda claro, pregúntame antes de proponer nada.

## 1. Qué es Minecraft, en términos económicos

- Es un juego de mundo abierto en el que los jugadores **recolectan recursos** (cavar minerales, talar árboles, cultivar, criar animales, matar monstruos) y los **transforman** con recetas (por ejemplo, 3 lingotes de hierro + 2 palos = 1 pico).
- Los objetos se guardan en inventarios y cofres. El inventario de un jugador tiene 36 casillas, y en cada casilla caben normalmente **64 unidades** de un mismo objeto (algunos objetos solo admiten 16 o 1).
- **Los recursos no se agotan en la práctica.** El mundo se genera a medida que se explora y es casi infinito, los árboles vuelven a crecer, los animales se reproducen y los monstruos reaparecen sin parar.
- No hay economía de serie: no existe dinero, ni precios, ni comercio entre jugadores más allá del trueque a mano. Hay unos aldeanos controlados por el juego que cambian objetos por esmeraldas, pero eso no es una economía de mercado.
- El juego no tiene un final fijo: se juega durante semanas o meses y el objetivo es construir, explorar, automatizar y derrotar jefes.

## 2. Lo más importante: la automatización

El modpack (el conjunto de modificaciones que usamos) gira en torno a **Create**, un mod de **ingeniería y automatización**. Con Create los jugadores construyen máquinas con engranajes, cintas transportadoras, molinos, prensas, mezcladoras y brazos robóticos que:

- **Producen recursos solas, de forma continua y sin límite**, también cuando el jugador no está delante (siempre que esa zona del mundo esté cargada). Una buena granja de hierro puede sacar miles de lingotes por hora.
- Encadenan procesos: mineral → triturado → lavado → fundido → lingote → chapa → pieza.

**Consecuencia económica clave:** el coste marginal de muchos bienes tiende a cero una vez construida la fábrica. Lo que en un juego normal es "raro" (hierro, oro, comida) aquí es una *commodity* infinita. Lo que de verdad escasea es:

- el **tiempo de los jugadores**;
- la **complejidad de la cadena de producción**: lo que necesita muchos pasos o materiales de varias fuentes;
- lo que **no se puede automatizar**: botín de exploración, objetos que sueltan los jefes y algunos materiales de otras dimensiones.

## 3. El mundo: islas, no un survival normal

- El modpack se llama **Venturia**. El mundo **no es un continente**: son **islas flotantes sobre el vacío**. No hay suelo debajo. Si te caes de una isla, mueres y pierdes lo que llevas encima.
- No se puede ir caminando a otra isla: hace falta un puente, teletransporte o, sobre todo, una nave. El espacio, el terreno y los recursos de cada isla son **finitos de verdad**, algo que no pasa en un mundo normal de Minecraft.
- Cada isla tiene recursos limitados y distintos. **Moverse entre islas es caro y lento** al principio. Por eso, los recursos que hay en una isla y no en otra tienen un valor de transporte.
- **Las naves son el núcleo del juego.** Con *Create Aeronautics* se construyen dirigibles y aeronaves con globos, hélices y motores, y son físicas de verdad: se mueven, cargan peso y pueden llevar mercancía. Aquí el transporte es un oficio en sí mismo.
- Hay **aldeas en el cielo** (Sky Villages) con habitantes y comercio, otras dimensiones (el Nether, el End, el Aether, la Undergarden, Eternal Starlight...) y estructuras con botín.
- Vamos a ser **muchos jugadores**, repartidos en **equipos autogestionados**: cada equipo decide cómo se organiza, quién entra y a qué se dedica. El número de equipos y su tamaño variarán con el tiempo: puede haber equipos de 1 persona y equipos de 8, equipos nuevos que lleguen tarde y equipos que se fusionen o se disuelvan. Las misiones y la tienda se comparten por equipo, así que **un tiempo de espera "por equipo" no es lo mismo para un jugador solo que para un grupo grande**. Tenlo en cuenta.
- Al haber muchos equipos, el comercio entre ellos (con *vendors* de Numismatics y transporte en nave) puede llegar a ser un mercado de verdad, con oferta y demanda reales, que funcione en paralelo a mi tienda de precios fijos.

## 4. Mods con impacto económico

El modpack tiene unos 350 mods. Estos son los que afectan a la economía:

| Mod | Qué hace | Efecto económico |
|---|---|---|
| **Create** y addons (Diesel Generators, Big Cannons, Ore Excavation, Enchantment Industry, Crafts & Additions, Propulsion...) | Automatización, máquinas, combustible, cañones, minería infinita de vetas, encantamientos automatizados | Producción ilimitada de materias primas y de muchos productos intermedios |
| **Create Aeronautics** y addons | Naves voladoras físicas | El transporte es caro y valioso; las piezas de nave son bienes de capital |
| **Numismatics** | Monedas físicas, cuentas bancarias, cajeros y tiendas automáticas de jugador (*vendors*) | Es la moneda del servidor (ver sección 5) |
| **Create Delivery Required** | Un **Mercado** que vende materias a precio fijo para recoger lejos, y un **Contratista** que paga monedas por llevar mercancía a 500-800 bloques | **Ya existe una economía con precios propios**: ver la sección 6 |
| **Trading Floor** | Automatiza el comercio con aldeanos | Las esmeraldas y lo que venden los aldeanos también se pueden producir en masa |
| **Modern Industrialization, Powah, Flux Networks** | Tecnología y energía | Más fuentes de producción industrial |
| **Apotheosis, Ars Nouveau, Mowzie's Mobs, Mutant Monsters, Block Factory's Bosses, Gateways to Eternity** | Magia, jefes, desafíos | Botín único, no automatizable |
| **FTB Quests** | Libro de misiones con recompensas | Lo uso para montar la tienda (ver sección 7) |
| **Waystones** | Teletransporte entre puntos | Reduce el coste de transporte para jugadores, no para mercancía pesada |
| **Open Parties and Claims** | Protección de terrenos | Propiedad privada de las islas |

## 5. La moneda: Numismatics

Es una moneda física, un objeto que se lleva en el inventario. Tiene 6 denominaciones fijas:

| Moneda | Valor en Spurs | Equivalencia |
|---|---|---|
| Spur | 1 | unidad mínima |
| Bevel | 8 | 8 Spurs |
| Sprocket | 16 | 2 Bevels |
| Cog | 64 | 4 Sprockets |
| Crown | 512 | 8 Cogs |
| Sun | 4096 | 8 Crowns |

- **La oferta monetaria parte de cero.** No se pueden fabricar ni minar monedas: solo entran al servidor desde fuentes que yo controlo (la tienda de misiones) o desde el mod Create Delivery Required (sección 6). Es una **moneda fiduciaria con un único emisor central**, que soy yo.
- Hay **bancos**: las monedas se pueden depositar en una cuenta y transferir entre jugadores. También hay *vendors*, tiendas automáticas con las que los jugadores pueden venderse cosas entre ellos.
- Limitación técnica: la tienda de misiones solo ve las monedas que el jugador lleva **en el inventario**, no las del banco.

## 6. Precios que ya trae el modpack (Create Delivery Required)

Este mod ya emite dinero, así que mi tienda tiene que convivir con él.

**Precios base en Spurs por unidad:**

| Objeto | Precio |
|---|---|
| Carbón | 2 |
| Redstone | 4 |
| Lingote de cobre | 6 |
| Lingote de hierro | 10 |
| Lingote de oro | 15 |
| Lapislázuli | 8 |
| Cuarzo | 10 |
| Fragmento de amatista | 40 |
| Diamante | 100 |
| Esmeralda | 80 |
| Chatarra de netherita | 100 |
| Lingote de netherita | 400 |
| Bola de arcilla | 2 |
| Bola de slime | 8 |
| Perla de ender | 20 |
| Vara de blaze | 15 |
| Cuero | 4 |
| Cuerda | 2 |
| Pólvora | 10 |
| Trigo | 2 |
| Pan | 3 |
| Papel | 2 |
| Cristal | 2 |
| Obsidiana | 10 |
| Fragmento de eco | 70 |
| Estrella del Nether | 1200 |
| Aleación de andesita | 4 |
| Lingote de latón | 10 |
| Chapa de latón | 11 |
| Mecanismo de precisión | 60 |
| Pociones | 12-16 |

**Cómo funcionan sus dos sistemas:**

- **Contratista:** cada 30 minutos aparecen 10 encargos del tipo "lleva X de este objeto a 500-800 bloques en un plazo de 60-120 minutos". Pagan el precio base, multiplicado por la distancia (×1 a ×2) y con bonus de hasta +10 % por estrellas y por rango del jugador. Así es como **más dinero entra** al servidor, y premia el transporte en nave.
- **Mercado:** cada 30 minutos aparecen 6 ofertas de venta de materias, que hay que recoger a 300-500 bloques. Cuestan **3 veces el precio base**, con hasta un 10 % de descuento por volumen. Es un **sumidero de dinero**.

Fíjate en que este mod paga el hierro a 10 Spurs la unidad. Con una granja de Create, eso puede ser una fuente de dinero casi ilimitada, aunque el contrato obliga a transportar la mercancía lejos y en un plazo.

## 7. La tienda que he montado (borrador actual)

La tienda está hecha con misiones repetibles: **entregas objetos y recibes monedas** (vender) o **entregas monedas y recibes objetos** (comprar). Esto es lo que puedo configurar:

- precio fijo por lote (cantidad de objetos ↔ monedas);
- **tiempo de espera** entre repeticiones, en segundos y compartido por equipo, que funciona como un cupo de venta por periodo;
- **desbloqueo por progreso**: una sección de la tienda solo se abre cuando el equipo ha completado cierta misión del juego;
- recompensas aleatorias de una tabla (cajas de botín).

**Lo que no puedo hacer:**

- precios dinámicos que reaccionen a la oferta y la demanda;
- impuestos automáticos;
- límites por jugador en vez de por equipo.

Los precios solo se pueden cambiar a mano.

**Estado actual (con precios en Spurs):**

- **Nivel 0, Puesto de novato** (desde el día uno; ventas cada 10 minutos):
  - vender basura (16 de carne podrida → 2; 64 de roca → 1);
  - comprar tonterías (galletas, antorchas, tarta, silla de montar: de 1 a 12).
  - Su función es enseñar a usar la tienda.
- **Nivel 1, Mercadillo** (desde el día uno):
  - vender materias a granel con espera de 1 h: 512 de hierro, cobre o zinc → 16; 256 de oro → 16; 256 de pan → 16;
  - vender cosas de exploración sin espera: 4 fragmentos de eco → 64; corazón del mar → 64;
  - comprar básicos: mochila 64, pergaminos de teletransporte 32...
- **Nivel 2, Taller** (al fabricar el primer latón):
  - vender productos fabricados con espera de 30 min: 32 tubos de electrones → 48; 32 chapas reforzadas → 64; 16 diamantes → 64;
  - comprar piezas de nave, munición, 4 diamantes (64) y cajas de botín.
- **Nivel 3, Lonja de lujo** (al fabricar un mecanismo de precisión):
  - vender piezas complejas: 16 mecanismos de precisión → 128;
  - vender trofeos de jefe con espera de 2 h → 512;
  - comprar artículos de lujo: netherita 512, élitros 1536, estrella del Nether 1536.

**Reglas que he seguido hasta ahora:**

1. El valor de venta depende de **lo difícil que es automatizar** algo, no de lo raro que es.
2. Comprar cuesta al menos el doble de lo que se paga al vender, para que no haya arbitraje dentro de la tienda.
3. Los tiempos de espera limitan cuánto dinero puede imprimir una sola granja.

**Mis dudas:**

- No sé si mis precios tienen sentido frente a los de Create Delivery Required. Por ejemplo, yo pago el hierro a 0,03 Spurs y ese mod a 10. Además, el diamante lo compro a 4 y lo vendo a 16, mientras que él lo pone a 100.
- No sé si habrá inflación ni qué sumideros de dinero hacen falta.

## 8. Lo que te pido

Diseña un **modelo de economía coherente** para este servidor. En concreto:

1. **Diagnóstico.** ¿Qué fallos ves en el sistema actual (emisión, sumideros, arbitraje con Create Delivery Required, inflación previsible)?
2. **Ancla de valor.** ¿En qué baso los precios? Por ejemplo: horas de jugador, complejidad de la cadena de producción, distancia de transporte entre islas o una cesta de bienes. Justifícalo.
3. **Política monetaria.** ¿Cuánto dinero debería entrar al servidor por hora y equipo en cada fase del juego (inicio, medio y final)? ¿Con qué fuentes y con qué sumideros?
4. **Tabla de precios.** Precios concretos de compra y venta, con lotes y tiempos de espera, para los objetos de la sección 7 o una alternativa mejor. Tienen que ser coherentes con los precios de Create Delivery Required, o dime qué valores de su configuración debería cambiar (multiplicadores, precios base).
5. **Progresión.** ¿Cómo tiene que cambiar la economía a medida que los jugadores automatizan más? Quiero que el dinero siga sirviendo de algo en la fase final.
6. **Comercio entre jugadores.** ¿Cómo animo a que los equipos se especialicen y comercien entre ellos (por ejemplo, una isla que produce combustible y otra que fabrica piezas de nave) en vez de ser autosuficientes?
7. **Equipos de distinto tamaño.** Los tiempos de espera y los cupos son por equipo. ¿Cómo evito que un equipo grande no gane casi nada por persona, que un jugador solo se lleve demasiado, o que la gente cree equipos "falsos" de una persona para multiplicar los cupos? ¿Cómo integro a los equipos que llegan tarde a una economía que ya está en marcha?
8. **Riesgos.** ¿Qué exploits o comportamientos degenerados prevés y cómo los evito con las herramientas que tengo?

**Restricciones del diseño:**

- Es un servidor **con muchos jugadores**, para divertirse. Prefiero un sistema **simple y comprensible** a uno perfecto.
- Todo tiene que poder hacerse con las herramientas de la sección 7: precios fijos, tiempos de espera por equipo y desbloqueos.
- Da los precios en **Spurs** e indica cómo se pagan en monedas reales; por ejemplo, 80 = 1 Cog + 2 Bevels.
