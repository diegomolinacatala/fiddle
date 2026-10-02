# CLAUDE.md

Notas para Claude Code al trabajar en este repo. Lo que hay aquí son las reglas
que no se deducen leyendo el código.

Para ponerse en marcha (instalar, arrancar, desplegar): [NEXT-STEPS.md](NEXT-STEPS.md).

## Qué es esto

Tarjetas de fidelización en Apple Wallet y Android (tarjeta web con avisos, y
Google Wallet cuando haya credenciales), multi-tienda, en
Next.js 15 + Supabase, desplegado en Vercel desde `main`
(<https://fiddle-zeta.vercel.app>). Los dueños son Victor y Diego.

## Reglas de la casa

- **El código habla español.** Nombres, comentarios, textos de pantalla y
  mensajes de commit. Los comentarios explican *por qué*, no *qué*.
- **La vista previa sale de las funciones de verdad.** `PaseVista` usa
  `camposDelPase()`, `stripDelPase()` y `svgLogo()` — los mismos que arman el
  `.pkpass`. Nunca hacer una maqueta paralela: si se separan, mienten. Cómo coloca
  iOS la fila bajo la banda (`lib/vistaWallet.js`, visto en un iPhone): si no cabe,
  encoge la fila ENTERA hasta un 40 % y solo entonces el campo largo pasa a dos
  líneas; un «PARA TI» de unas 100 letras cabe junto al premio.
- **Nada de `<text>` en los SVG del pase.** En serverless no hay fuentes
  fiables; las letras se dibujan (`lib/apple/glifos.js`).
- **`npm test` y `npm run build` antes de abrir el PR.** Los dos, siempre.
- **PowerShell 5.1**: nada de `&&`. Encadenar con `;` o `if ($?) { ... }`.
  Y ejecutarlo uno mismo, no pasárselo al usuario para que lo pegue.
- **Cada cosa en UN sitio: el más intuitivo.** Nada de repetir una acción en cada
  pantalla "por si acaso". El dueño tiene tres pestañas, una por pregunta: **Tienda**
  (tarjeta, caja, horario, ubicación, QR), **Clientes** (quién viene; exportar va junto
  a la lista y baja lo que se ve) y **Avisos** (promo, grupos y automáticos). Y aparte,
  al final, **Ajustes**: lo de la cuenta (contraseña de la caja). Antes de añadir un
  botón, mirar si esa acción ya vive en otra pestaña.
- **Tienda y Ajustes se arman con filas iguales** (`app/[negocio]/Bloque.js`): icono en
  su cuadrado, título, una línea de cómo está y UN botón pequeño debajo. Lo que se pone
  una vez (horario, mapa) va plegado. Nada de títulos, colores o botones distintos
  para cosas del mismo nivel.
- **Encender/apagar = interruptor** (`app/Interruptor.js`), nunca una casilla: una
  casilla vacía no se lee como "apagado".
- **Lo que se VE en la tarjeta se cambia tocándolo en ella**: Tienda → "Editar tarjeta"
  (`manager/EditorTarjeta.js`). Cada trozo de `PaseVista` abre su panel (`seccionDe`).
  Un dato nuevo del pase = su control en ese panel, no un campo suelto en Tienda. Enseña
  Apple y Google A LA VEZ (con sitio): lo de una sola plataforma lo dice su panel. El
  manager NO cambia cupón ↔ cartilla (el pase de Apple no puede cambiar de tipo).
  Excepción a propósito: «● Abierto hasta…» (`tema.abierto`) tiene también su
  interruptor en Tienda → Horario, que es donde se piensa en ello. La tarjeta web lo
  respeta igual que Wallet.
- **En Apple no hay "detrás"**: la (i) abre la hoja de información de la tarjeta. La
  vista previa la abre con su botón «ⓘ Información», que tiene que verse tocable.

## Lo que hay que saber del pase de Apple

- Con imagen de banda (*strip*), **iOS junta `secondaryFields` y
  `auxiliaryFields` en UNA fila**. Por eso el pase lleva pocos campos: no caben.
- **El nombre del cliente NO va en la cara del pase.** Lo sabe él y lo ve la
  tienda; el sitio es escaso.
- Los avisos en la pantalla de bloqueo los dispara un **campo que cambia**, no
  una imagen. La banda se actualiza en silencio: por eso `changeMessage` vive en
  PREMIO, cuyo valor cambia con cada sello.
- **Wallet apila los pases que comparten Pass Type ID.** Una tienda puede tener
  uno propio (`APPLE_PASS_TYPE_ID_<SLUG>` + `APPLE_PASS_CERT_<SLUG>`, ver
  `lib/apple/config.js`). Un pase instalado no cambia nunca de ID: por eso el
  web service y los avisos aceptan el de la tienda Y el general
  (`configsDeTienda()`), y cada aviso sale con el certificado de su ID.
- **Para Wallet, un pase es Pass Type ID + serial.** Volver a descargar una tarjeta
  firmada con otro ID NO la actualiza: mete otra al lado (mismos sellos, sin apilar).
  `/api/pase/<serial>` firma con el ID con que ya está registrada
  (`configDeDescarga`, mirando `registros`). Toda descarga nueva tiene que pasar por ahí.
- El QR lleva el `serial`; debajo va el **código de 3 caracteres**, único dentro
  de su tienda (`lib/codigo.js`).

## El alta: ¿nombre o directo?

El QR y el tag llevan a `/api/tap`. Quien ya tiene tarjeta (cookie) va directo a
ella. Al resto, según `pedirNombre` de la tienda (Tienda → "Pedir el nombre al
escanear"; **apagado de partida**):

- **Apagado**: el GET crea la tarjeta sin nombre y va directo a la Wallet. Un paso
  menos en el mostrador; a cambio, quien escanea y se va deja un cliente vacío.
- **Encendido**: el GET no crea nada y manda a `/<slug>`, que pide SOLO el nombre;
  la tarjeta la crea el POST y luego enseña el botón de su Wallet.
- Es lo primero que ve el cliente: pocas palabras, los colores de la tienda y los
  botones oficiales de Wallet (`app/BotonesWallet.js`) sin tocar.
- La tarjeta de esa página es `app/CaraDelPase.js`, la misma que la tarjeta web.

## Una tarjeta por iPhone y tienda

Ver [`src/lib/unaTarjeta.js`](src/lib/unaTarjeta.js). Dos capas:

- **Cookie del tap** (`lib/recordar.js`): quien vuelve a escanear recibe la misma
  tarjeta. En iPhone el `.pkpass` va tras una redirección para que la cookie viaje
  en una respuesta normal.
- **Fusión al registrar en el Wallet**: si un iPhone (`deviceLibraryIdentifier`)
  añade una tarjeta nueva de una tienda de la que ya tuvo otra, la vieja se fusiona
  en la nueva (sellos, premios, código, nombre, historial) y queda anulada con
  `fusionado_en`. `tarjetas_de_dispositivo` NO se borra al quitar el pase: es lo
  que permite devolverle los sellos.
- **Nunca se fusiona una tarjeta que sigue registrada en OTRO teléfono**
  (`dispositivosDeTarjeta`). El `deviceLibraryIdentifier` lo pone quien llama y el
  serial va en el QR: sin esto, quien viera el QR de otro se llevaba sus sellos. Una
  tarjeta sin registro en ningún sitio sigue pudiendo fusionarse: el serial es su llave.
- **La página de la tienda recuerda la tarjeta un año** y saluda por el nombre; debajo,
  «¿No eres Ana?» saca otra (`?nuevo=1`) para quien usa un teléfono que no es el suyo.
- Una tarjeta con `fusionado_en` **no es un cliente**: `listClientes` la esconde,
  `/api/accion` la rechaza y `/w`, `/p`, `/api/pase` y el tap saltan a la vigente
  (`clienteVigente`). Lo que lea `clientes` a mano tiene que filtrarla igual.
- En Android no hay id del teléfono: ahí solo está la cookie.

## Lo que hace que la web vaya rápida

- **Vercel corre en `lhr1` (Londres) porque Supabase está en eu-west-2** (`vercel.json`).
  Si la base cambia de región, la de las funciones va con ella.
- **Manager y CRM cargan en el servidor** (`page.js` lee y pasa `inicial` al panel de
  cliente) y cada ruta tiene `loading.js` con su esqueleto (`app/Esqueleto.js`).
  Nada de pantallas que arrancan vacías y piden sus datos con `fetch`.
- **La caja pinta la acción al instante**: aplica `ACCIONES[x].aplicar` en el navegador y
  la petición va detrás, en fila (`TarjetaCaja.js`). Por eso `aplicar` tiene que seguir
  siendo PURA y sin imports del servidor.

## La caja

Qué PUEDE hacer la caja son las `acciones` de la tienda; cómo se le ENSEÑA, `config.caja`
(`lib/caja.js`, todo con el valor de siempre de partida). Se edita en Tienda → "Editar vista
de caja", con la caja de verdad (`TarjetaCaja demo`) al lado. Una FILA por cartilla que suma
entera, con el "−" pequeño dentro (corregir no merece un botón igual de grande), y el "+2"
si la tienda lo quiere. Un botón nuevo de la caja = una fila en `filasDeCaja`, no un botón suelto.

## El premio: dar o guardar

Con la cartilla llena la caja pregunta "¿lo quiere ahora o se lo guardas?"
(`premiosDe()` en `lib/acciones.js`). Guardar vacía la cartilla y suma en
`guardados` / `guardados2` (una columna por cartilla, como `sellos` / `sellos2`).
Todo lo que mueva el saldo pasa por `SALDO` en `store.js`, que es lo que compara el
guardado optimista: una columna de saldo nueva va ahí.

## Android

Ver [docs/ANDROID.md](docs/ANDROID.md) y [docs/GOOGLE-WALLET.md](docs/GOOGLE-WALLET.md).

- **La tarjeta web (`/p/<serial>`) es el pase de Android** y sigue la misma regla que
  la vista previa: `camposDelPase()`, `stripDelPase()`, `svgLogo()`. Nada de estilos
  dibujados a mano por tienda. Lo mismo el objeto de Google (`lib/google/pase.js`).
- **Al navegador del cliente solo va `clienteDeTarjeta()` / `negocioDeTarjeta()`**
  (`lib/tarjeta.js`). Nunca `clientePublico()` ni el negocio entero: llevan la nota
  interna de la tienda, el brief y los comentarios del admin.
- **Los avisos van por canales** en la tabla `registros` (`pass_type`): Pass Type ID
  de Apple, `"web"` y `"google"`. Todo envío filtra por su canal; sin filtro solo
  para "¿le llega algo?" (CRM). No hacen falta tablas nuevas para un canal nuevo.
- **Qué suena en Android lo decide `avisoDeCambio(antes, después)`** en `lib/avisos.js`.
  Por eso `notificarCliente` recibe `{ antes }`: sin él no se sabe si fue un sello o
  una corrección, y no suena.
- **El reverso es de las dos**: `negocio.contacto` (teléfono, web, Instagram; `lib/contacto.js`)
  sale en los `backFields` de Apple y en `linksModuleData` de la clase de Google. La vista
  previa enseña la cara y la información (la i) de las dos, y todo se edita desde ahí.
- **Ningún canal tumba la acción.** Apple, web push y Google se llaman después de
  guardar y nunca lanzan hacia fuera.
- **Endpoints de push**: solo servicios reales (`push/suscripcion.js`). Aflojar esa
  lista convierte el servidor en un proxy para pegar a URLs internas.
- **Emojis fuera de la interfaz.** Iconos con `app/Icono.js` y la marca de la tienda
  con `app/MarcaTienda.js`.

## El aspecto se arma con piezas

Ver la cabecera de [`src/lib/apple/dibujo.js`](src/lib/apple/dibujo.js). Un tema
no es una plantilla cerrada: es `marca` + `texto` + `forma` + `banda` + `modo`,
y se combinan libres. Un ESTILO solo es una combinación de partida con nombre.

- **Añadir una marca** = una entrada en `DIBUJOS` (SVG de un color en un lienzo
  512x512). Sale sola en el logo, el icono, los sellos, el modo relleno y el
  selector del admin. Si se usa en modo relleno, añadirla también a `CAJA`.
- **Dos cartillas**: `tema.doble` = `filas` (una encima de otra) o `lados`; y CADA
  cartilla su `modo` y su `forma` (cualquiera de MODOS, como una tienda de una). Cada
  modo se pinta en su trozo con la caja que aguanta (`ASPECTO` en dibujo.js: un modo
  nuevo que se coma la cifra en una mitad necesita su entrada ahí). Dos casillas en filas
  y dos rellenos lado a lado tienen dibujo propio. `llenar` es el nombre viejo de lados+relleno.
- **De dos cartillas a una no se borra nada**: la segunda se aparca en
  `cartillasAparcadas` y los `sellos2`/`guardados2` de cada cliente se quedan. Nunca
  limpiar esas columnas al quitar la segunda cartilla.
- **Logo propio** (`lib/logo.js`, `lib/logoImagen.js`): `tema.logoImagen = {id, b, opaco}`,
  la imagen en Storage (cubo privado `logos`, se crea solo) o `.data/logos/`. Se sirve por
  `/api/logo` y cada sitio la compone a su manera (a sangre si es opaca). Los SELLOS
  siguen siendo el dibujo. Lo que pinte un logo en el navegador usa `LogoTienda` o
  `MarcaTienda`, nunca `svgLogo` a pelo.
- **Google tiene UN color** (el fondo, `fondoGoogle`: el de la tienda, el de la tarjeta u
  otro, `tema.google`); el texto lo elige Google. «Abierto hasta…» en Google es un módulo
  de la CLASE (`estadoPase`), que el reloj reescribe con una llamada por tienda.
- **Compatibilidad**: los temas guardados solo tenían `estilo`. `piezasDeTema()`
  deduce las piezas de ahí y hay un test que fija que el SVG no cambia.

## El CRM agrupa por RITMO, no por calendario

Ver [`src/lib/crm.js`](src/lib/crm.js). Quien viene a diario y lleva una semana
sin aparecer está tan perdido como quien viene una vez al mes y lleva cuatro: casi
nada se mide en días sueltos, sino en `retraso` = días sin venir ÷ su cadencia.

- **Una visita es un rato en el mostrador, no un sello.** `registrarVisita` no suma si
  la anterior fue hace menos de `UMBRALES.horasVisita` (3 h), y `perfilDe` no cree más
  visitas de las que caben en el tiempo pasado (los contadores viejos sí sumaban cada
  sello). La cadencia no baja de un día y nadie está "en riesgo" por faltar menos de
  `riesgoMinDias` (7). Sin esto, diez sellos de prueba = "habitual que viene cada
  segundo y lleva horas sin venir".

- **Añadir un grupo** = una entrada en `GRUPOS` con su `incluye(perfil)`. Sale
  solo en el panel, en el selector de campañas y en la exportación.
- `ESTADOS` son EXCLUYENTES (cada cliente está en uno) y `GRUPOS` SE SOLAPAN a
  propósito: estar a un sello del premio y llevar semanas sin venir es la misma
  persona, y las dos cosas merecen un aviso.
- **Apple no tiene mensajes propios.** El aviso lo dispara un CAMPO del pase que
  cambia, así que una campaña escribe `clientes.mensaje` a cada uno y ese texto
  ocupa el sitio de la promo. Consecuencia: **solo se puede avisar a quien
  instaló el pase**; la pantalla lo dice antes de enviar.
- Una campaña **recalcula el grupo en el servidor**. Del navegador llega su
  clave, nunca la lista de a quién.
- El reloj: lo que dependa de la hora local (a qué hora viene la gente) se
  calcula **en el navegador**. El servidor vive en UTC y sacaría el café de las 9
  a las 7.

## Avisos automáticos

Ver [docs/AVISOS.md](docs/AVISOS.md) y [`src/lib/automatizaciones.js`](src/lib/automatizaciones.js).

- **Todo apagado de partida.** Nada sale solo sin el interruptor de la tienda
  (`avisosActivos`) Y la regla encendida (`activa`) Y horario. Plantillas y semillas
  van con `activa: false`, y una regla guardada sin `activa` cuenta como apagada.
  No cambiar eso: un despliegue no puede empezar a escribir a los clientes de nadie.

- **Un tipo de aviso = una entrada en `DISPAROS`.** Sale solo en el selector del
  manager y en el motor. Cualquier grupo del CRM ya vale con el disparo `grupo`.
- **Lo de una tienda se cambia desde su manager** (a quién, cuántos días, hora, días,
  texto, horario). Si una tienda pide otro texto u otra hora, no se toca código.
- **La memoria es `campanas`** (`grupo = "auto:<id>"`): de ahí salen "ya se lo
  dijimos", la pausa entre avisos y el "¿volvió?". Nada de tablas nuevas ni de
  apuntar "ya corrió hoy": el motor es idempotente y el reloj puede pasar de más.
- **La hora es la de la tienda** (`horario.zona`), nunca la del servidor: todo lo que
  mire el reloj pasa por `lib/horario.js`. **Sin horario, nada sale solo**: el reloj
  pasa por todas las tiendas de la base, también las de prueba.
- **El horario admite dos tramos por día** (mañana y tarde): `semana[i]` es una lista
  de `{abre, cierra}` o null. Lo de antes (un tramo suelto) lo pasa a lista
  `normalizarDia`. "¿Está abierta a las 15:00?" es `tramoEn`, no `tramoDe` (que va de
  la primera apertura al último cierre, descanso incluido).
- **"● Abierto hasta las 14:00" en el pase de Wallet**: no hay campo bajo el nombre,
  así que se DIBUJA en lo alto de la banda, sobre `cardBg` (se lee como cabecera) y
  los sellos bajan `ALTO_ESTADO` puntos (`lineaDeEstado` en `dibujo.js`). Las letras
  son contornos de Inter generados en `lib/apple/letras.js` (`scripts/gen-letras.mjs`;
  una letra nueva = añadirla ahí y volver a generar), escritos con `lib/apple/texto.js`.
  Se calcula al firmar (`estadoDeTienda`, que respeta `tema.abierto === false`) y el reloj empuja los iPhone cada vez que el
  texto cambia (`refrescarEstadoDelPase`, lo último en `config.estadoPase`). **Solo si
  el reloj anda** (`relojVivo`): sin él diría "Abierto" toda la noche. La tarjeta web
  no la lleva en la banda: tiene su propia línea viva (`AbiertoAhora`).
- **El reloj NO va en `vercel.json`** mientras el plan sea Hobby: un cron de más de
  una vez al día hace fallar el despliegue. Lo llama Supabase (`pg_cron`).
- **Programados** (Avisos → Programados): reglas con `cada: "vez"` en la misma lista,
  un día (`fecha`) o cada semana, a todos (disparo `todos`, solo programado) o a un grupo.
  Salen una vez por envío (no por ausencia) y pueden saltarse la pausa (`ignorarPausa`),
  pero NUNCA `limiteAvisosDia` (1–3, de partida 1: Google suena como mucho 3 al día).
- **Lo escaso viene de partida; lo frecuente se elige y la pantalla avisa.** Un
  programado nuevo sale UN día; "Cada semana" es UN día; varios días se eligen aparte
  con aviso (`frecuenciaSemanal`: todos los que abre = aviso DIARIO). Pausa de partida
  7 días, máximo 1 al día; menos pausa o más al día, con aviso (`Limites.js`).
- **El texto de un aviso no enseña llaves sueltas** (`avisos/TextoAviso.js`): botones
  con nombre (`VARIABLES[].nombre`), el texto ya relleno debajo y las `FRASES`, que
  solo ven los que encajan (`{si_cerca}`…). Una variable nueva lleva su `nombre`.
- **Lo que dicen los números** (Clientes → Resumen, `lib/observaciones.js`): reglas fijas,
  sin IA, sobre la rejilla horaria y el horario. Su botón abre Avisos ya relleno
  (`?programar=<base64>` o `?grupo=<clave>`): aquí se ve a quién, allí se dice qué.
- Un aviso ocupa `clientes.mensaje`, como una campaña: solo le llega a quien tiene la
  tarjeta en el teléfono, y la caja lo ve arriba de la ficha ("En su tarjeta pone…").

## Contraseñas

Ver [`src/lib/accesos.js`](src/lib/accesos.js) y [`src/lib/claves.js`](src/lib/claves.js).

- **Viven en la tabla `accesos`, solo como hash scrypt.** Se generan al crear la tienda
  en `/admin`, se enseñan UNA vez y se cambian desde la ficha de la tienda en `/admin`
  o, la de la caja, desde el manager. La única vez que las elige alguien es la
  **invitación** (`lib/invitaciones.js`): el dueño pone la suya y la de la caja.
- **La invitación nunca lleva la contraseña.** Lleva un token de un solo uso que caduca,
  detrás de `#` (no llega a los logs) y en la base solo su huella. Se envía con `mailto`
  desde el correo del admin: no hay proveedor de correo.
- `hashClave` normaliza igual que `comprobarClave`. Si se toca una, la otra también: una
  elegida con forma de generada ("cafe12345678") dejaría de entrar.
- Si un usuario tiene contraseña en la base, **solo vale esa**. Sin fila, vale la
  variable `CLAVE_<SLUG>_<ROL>` de Vercel (las tiendas de antes). Si la base falla,
  también se cae a la variable: una caja sin poder entrar es peor.
- Los admins (victor, diego) siguen solo con variables.
- **Cambiar una contraseña saca a quien ya estaba dentro** (la caja perdida, el empleado
  que se va): `lib/sesionVigente.js` rechaza la sesión firmada antes de
  `accesos.actualizado`, y también la de una tienda archivada o borrada. Lo miran
  `exigirNegocio` y las páginas del personal (`sesionDeCookie`), no el middleware (Edge,
  solo la firma). Página o API nueva del personal = por ahí, nunca `verificarSesion` a pelo.
- **Lo de `/api/admin/*` comprueba el admin también dentro** (`exigirAdmin`), aunque el
  middleware ya lo haga: si una ruta se le escapa, no queda abierta.
- **Una tienda no puede llamarse como un usuario** (`slugDeTiendaLibre`): `pan-caja` haría
  de su manager la caja de `pan`. Por lo mismo, `comprobarAcceso` ignora una fila de
  `accesos` que diga ser de otra tienda u otro rol.
- **Accesos de prueba (usuario = contraseña) solo en local y sin `AUTH_SECRET`**: con el
  de Vercel pegado en `.env.local`, una sesión firmada aquí valdría en producción.
- **Tras el login, `next` solo se respeta si es de la tienda que entra** (lo decide
  `/api/login`, no el navegador). Una ficha `/w/<serial>` se comprueba por la tarjeta:
  quien escaneó su propio pase no puede acabar en ella al entrar en otra tienda.

## Pantallas en el móvil

- **Los contenedores de página van a `min(Npx, 100%)`, nunca a `vw`**: `96vw` más el margen
  de `pagina` ya se sale. Y `pagina` lleva `gridTemplateColumns: "minmax(0, 1fr)"`: sin
  eso, una tabla ancha hace crecer la rejilla y se desborda TODA la página, no la tabla.
- Tablas anchas dentro de `overflowX: "auto"`. Filas de botones con `flexWrap`.
- **Recorrido de bienvenida** (`app/Recorrido.js`): cada paso señala un elemento con
  `data-recorrido="<ancla>"`. Mover o quitar ese atributo no rompe nada visible: el paso
  se salta en silencio. Al tocar manager o caja, mirar que las anclas siguen.
- **Dominios externos**: la CSP (`next.config.mjs`) solo abre OpenStreetMap (teselas y
  Nominatim, para el mapa del manager). Otro servicio = otra línea ahí, o no carga.

## Datos y permisos

- Las tiendas **viven en la base**, se crean y se borran desde `/admin`.
  `negocios.js` solo aporta semillas y plantillas.
- **La tienda es La Delicantería**: es la única semilla. Nube, Fade y Forno existen
  solo para los tests (`tests/tiendasDePrueba.js`, cargado por `setupFiles` de
  vitest; un test con `vi.resetModules()` lo vuelve a importar). No devolverlas a
  `negocios.js`.
- **En producción solo trabajamos con La Delicantería** (desde el 02-10-2026). Las de
  antes (`fade`, `forno`, `nube`, `project-68`) están **archivadas, no borradas**: no
  salen en ningún sitio ni dejan entrar, pero sus datos siguen por si hacen falta. No
  desarchivarlas ni borrarlas para siempre sin hablarlo entre los dos. Ni el
  directorio (`/api/negocios`) ni el reloj de avisos las ven: `listNegocios()` y
  `getNegocio()` esconden lo archivado salvo que se pida (`incluirArchivados`, solo
  en `/admin`). Se ven en `/admin` → Archivadas.
- Tres roles: `caja`, `manager`, `admin`. El admin (victor/diego) entra en todo.
- El store tiene **dos backends** tras la misma API: Supabase o ficheros locales
  (`.data/`, sin variables de entorno). Todo cambio en `store.js` vale para los dos.
- **Nombre y nota del cliente van cifrados** (`lib/cifrado.js`, ver
  [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md)). Se cifran al guardar y se descifran
  en `normalizarCliente`: leer y escribir `clientes` siempre por esas funciones
  del store. Un dato personal nuevo se añade a `PERSONALES`. No se puede buscar
  por ellos en SQL: se filtra en JS. **En producción, sin `CIFRADO_CLAVE` no se
  guardan**: `cifrar` lanza en vez de escribir en claro.
- **Al personal, `negocioDelPersonal()`** (`lib/tarjeta.js`): la tienda sin el brief ni
  los comentarios del admin. Al cliente, `negocioDeTarjeta()`. El negocio entero, solo
  en `/api/admin/*`.
- **El service worker no guarda las pantallas del personal** (`DEL_PERSONAL` en
  `public/sw.js`): llevan nombres y notas en el HTML. Si cambia lo que guarda, subir
  `CACHE` para que se borre lo de antes.
- **`supabase/schema.sql` primero, código después.** Si una columna nueva se
  despliega antes de existir en la base, producción devuelve 500.

## Antes de dar algo por terminado

Mirarlo. Para el dibujo, rasterizar el SVG con sharp y abrir el PNG; para las
pantallas, levantar el preview y navegar (con User-Agent de Android para la
tarjeta: lo que se ofrece depende del teléfono). Los tests no ven si una taza
parece una taza.
