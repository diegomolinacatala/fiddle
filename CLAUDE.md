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
  `.pkpass`. Nunca hacer una maqueta paralela: si se separan, mienten.
- **Nada de `<text>` en los SVG del pase.** En serverless no hay fuentes
  fiables; las letras se dibujan (`lib/apple/glifos.js`).
- **`npm test` y `npm run build` antes de abrir el PR.** Los dos, siempre.
- **PowerShell 5.1**: nada de `&&`. Encadenar con `;` o `if ($?) { ... }`.
  Y ejecutarlo uno mismo, no pasárselo al usuario para que lo pegue.
- **Cada cosa en UN sitio: el más intuitivo.** Nada de repetir una acción en cada
  pantalla "por si acaso". El dueño tiene tres pestañas, una por pregunta: **Tienda**
  (tarjeta, caja, horario, QR), **Clientes** (quién viene; exportar va junto a la lista
  y baja lo que se ve) y **Avisos** (promo, grupos y automáticos). Antes de añadir un
  botón, mirar si esa acción ya vive en otra pestaña.

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
- El QR lleva el `serial`; debajo va el **código de 3 caracteres**, único dentro
  de su tienda (`lib/codigo.js`).
- **Hoy todas las tiendas comparten Pass Type ID** y el Wallet las apila. Está
  decidido pasar a uno por tienda: ver
  [NEXT-STEPS.md](NEXT-STEPS.md#un-pass-type-id-por-tienda) antes de tocar la firma,
  el web service o APNs, que hoy dan por hecho que solo hay uno.

## El alta: primero el nombre

El QR y el tag llevan a `/api/tap`. Quien ya tiene tarjeta (cookie) va directo a
ella; al resto lo manda a `/<slug>`, que pide SOLO el nombre y luego enseña la
tarjeta con el botón de su Wallet.

- **La tarjeta la crea el POST de `/api/tap`, nunca el GET**: quien escanea y se va
  no deja un cliente vacío.
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
- **Compatibilidad**: los temas guardados solo tenían `estilo`. `piezasDeTema()`
  deduce las piezas de ahí y hay un test que fija que el SVG no cambia.

## El CRM agrupa por RITMO, no por calendario

Ver [`src/lib/crm.js`](src/lib/crm.js). Quien viene a diario y lleva una semana
sin aparecer está tan perdido como quien viene una vez al mes y lleva cuatro: casi
nada se mide en días sueltos, sino en `retraso` = días sin venir ÷ su cadencia.

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
- **El reloj NO va en `vercel.json`** mientras el plan sea Hobby: un cron de más de
  una vez al día hace fallar el despliegue. Lo llama Supabase (`pg_cron`).
- Un aviso ocupa `clientes.mensaje`, como una campaña: solo le llega a quien tiene la
  tarjeta en el teléfono, y la caja lo ve arriba de la ficha ("En su tarjeta pone…").

## Contraseñas

Ver [`src/lib/accesos.js`](src/lib/accesos.js) y [`src/lib/claves.js`](src/lib/claves.js).

- **Viven en la tabla `accesos`, solo como hash scrypt.** Se generan (nunca las elige
  nadie) al crear la tienda en `/admin`, se enseñan UNA vez y se cambian desde la
  ficha de la tienda en `/admin` o, la de la caja, desde el manager.
- Si un usuario tiene contraseña en la base, **solo vale esa**. Sin fila, vale la
  variable `CLAVE_<SLUG>_<ROL>` de Vercel (las tiendas de antes). Si la base falla,
  también se cae a la variable: una caja sin poder entrar es peor.
- Los admins (victor, diego) siguen solo con variables.
- Cambiar una contraseña **no cierra las sesiones ya abiertas** (la caja dura 30 días):
  el token de sesión no sabe de contraseñas. Si hiciera falta, bastaría con cambiar
  `AUTH_SECRET` (echa a todos).
- **Tras el login, `next` solo se respeta si es de la tienda que entra** (lo decide
  `/api/login`, no el navegador). Una ficha `/w/<serial>` se comprueba por la tarjeta:
  quien escaneó su propio pase no puede acabar en ella al entrar en otra tienda.

## Datos y permisos

- Las tiendas **viven en la base**, se crean y se borran desde `/admin`.
  `negocios.js` solo aporta semillas y plantillas.
- **La tienda es La Delicantería**: es la única semilla. Nube, Fade y Forno existen
  solo para los tests (`tests/tiendasDePrueba.js`, cargado por `setupFiles` de
  vitest; un test con `vi.resetModules()` lo vuelve a importar). No devolverlas a
  `negocios.js`.
- Tres roles: `caja`, `manager`, `admin`. El admin (victor/diego) entra en todo.
- El store tiene **dos backends** tras la misma API: Supabase o ficheros locales
  (`.data/`, sin variables de entorno). Todo cambio en `store.js` vale para los dos.
- **Nombre y nota del cliente van cifrados** (`lib/cifrado.js`, ver
  [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md)). Se cifran al guardar y se descifran
  en `normalizarCliente`: leer y escribir `clientes` siempre por esas funciones
  del store. Un dato personal nuevo se añade a `PERSONALES`. No se puede buscar
  por ellos en SQL: se filtra en JS.
- **`supabase/schema.sql` primero, código después.** Si una columna nueva se
  despliega antes de existir en la base, producción devuelve 500.

## Antes de dar algo por terminado

Mirarlo. Para el dibujo, rasterizar el SVG con sharp y abrir el PNG; para las
pantallas, levantar el preview y navegar (con User-Agent de Android para la
tarjeta: lo que se ofrece depende del teléfono). Los tests no ven si una taza
parece una taza.
