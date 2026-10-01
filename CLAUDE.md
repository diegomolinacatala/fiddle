# CLAUDE.md

Notas para Claude Code al trabajar en este repo. Lo que hay aquí son las reglas
que no se deducen leyendo el código.

Para ponerse en marcha (instalar, arrancar, desplegar): [NEXT-STEPS.md](NEXT-STEPS.md).

## Qué es esto

Tarjetas de fidelización en Apple Wallet y Android (tarjeta web con avisos, y
Google Wallet cuando haya credenciales), multi-tienda, en
Next.js 15 + Supabase, desplegado en Vercel desde `main`
(<https://fiddle-zeta.vercel.app>). Los dueños son Victor y Diego.

**Desde el 30-09-2026 hay un cliente de pago: La Delicantería.** Producción ya no es
un sitio de pruebas: hay clientes de verdad con sus sellos. Nada de accesos de
prueba, y nada se borra en la base sin preguntar.

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
- **Lo que se VE en la tarjeta se cambia tocándolo en ella**: Tienda → "Editar tarjeta"
  (`manager/EditorTarjeta.js`). Cada trozo de `PaseVista` abre su panel (`seccionDe`).
  Un dato nuevo del pase = su control en ese panel, no un campo suelto en Tienda. El
  manager NO cambia cupón/cartilla ni cuántas cartillas hay: eso es del admin.

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
- **El reverso es de las dos**: `negocio.contacto` (teléfono, web, Instagram; `lib/contacto.js`)
  sale en los `backFields` de Apple y en `linksModuleData` de la clase de Google. La vista
  previa enseña delante y detrás de las dos, y todo se edita desde ahí.
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
- **Dos cartillas**: `tema.doble` = `filas` (una fila de casillas por cartilla, la de
  siempre) o `llenar` (`svgStripLlenar`: dos dibujos que se llenan, uno a cada lado, y las
  cuentas hacia el centro). Izquierda/derecha = el orden de sus campos bajo la banda.
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
  Se calcula al firmar (`estadoParaPase`) y el reloj empuja los iPhone cada vez que el
  texto cambia (`refrescarEstadoDelPase`, lo último en `config.estadoPase`). **Solo si
  el reloj anda** (`relojVivo`): sin él diría "Abierto" toda la noche. La tarjeta web
  no la lleva en la banda: tiene su propia línea viva (`AbiertoAhora`).
- **El reloj NO va en `vercel.json`** mientras el plan sea Hobby: un cron de más de
  una vez al día hace fallar el despliegue. Lo llama Supabase (`pg_cron`).
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
- Los admins (victor, diego) siguen solo con variables: `CLAVE_ADMIN_VICTOR` y
  `CLAVE_ADMIN_DIEGO` en Vercel. Las eligen ellos y es decisión suya: no se cambian
  ni se "arreglan" desde el código. Una variable cambiada en Vercel **no vale hasta
  el siguiente despliegue** (Deployments → Redeploy).
- **Los accesos de prueba solo existen en local** (contraseña = usuario y la lista en
  el login). `USUARIOS_DEMO` ya no se lee: hasta el 01-10-2026 estaba a `1` en Vercel
  y `/api/login` publicaba todos los usuarios con su contraseña, también los de La
  Delicantería. No volver a meter un interruptor que los encienda en producción.
- Cambiar una contraseña **no cierra las sesiones ya abiertas** (la caja dura 30 días):
  el token de sesión no sabe de contraseñas. Si hiciera falta, bastaría con cambiar
  `AUTH_SECRET` (echa a todos).
- **Tras el login, `next` solo se respeta si es de la tienda que entra** (lo decide
  `/api/login`, no el navegador). Una ficha `/w/<serial>` se comprueba por la tarjeta:
  quien escaneó su propio pase no puede acabar en ella al entrar en otra tienda.

## Cuentas: lo decidido (01-10-2026, sin empezar)

Hoy una cuenta es una tienda con un rol (`delicanteria`, `delicanteria-caja`) y la
caja es una contraseña compartida. Vamos a lo más profesional a largo plazo, lo
cueste lo que cueste (es lo que hacen Square, Loopy o Boomerangme):

- **Cuentas de persona**: cada uno su email y su contraseña. Una tabla
  `miembros (persona, tienda, rol)` con los roles dueño, encargado y empleado. Un
  dueño con dos tiendas entra con una sola cuenta; quitar a alguien no toca a nadie más.
- **Quién entra lo decide Supabase Auth** (verificar el email, recuperar la contraseña,
  enlace mágico, Google/Apple, doble factor). **Qué puede hacer** lo deciden nuestras
  tablas, como ahora. Ni login hecho a mano ni Clerk (datos en EE. UU. y un encargado
  del tratamiento más).
- **La caja es un dispositivo vinculado**: el dueño pulsa "Añadir caja" en el manager y
  el móvil del mostrador escanea un código que dura unos minutos. Sin contraseña
  compartida; el manager ve sus cajas y desconecta la que quiera.
- **PIN personal por empleado** (4-6 cifras) en la caja. Cada tienda elige cuándo se
  pide: siempre, solo para dar premios o nunca.
- **Sesiones guardadas en el servidor**: cambiar la contraseña o quitar a alguien cierra
  sus sesiones (hoy no pasa).
- **Registro de actividad**: quién dio cada sello y cada premio, desde qué caja, y quién
  cambió qué.
- Invitaciones por email para todos los roles (`lib/invitaciones.js`, ampliado).
  Victor y Diego pasarán a ser cuentas de persona con rol de plataforma.

Falta decidir: **dominio propio** (sin él los correos de recuperación no llegan bien),
el **PIN por defecto** (la propuesta es "solo para premios") y si se entra con
**Google/Apple**.

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
- **La tienda es La Delicantería**: es la única semilla. En producción aún quedan
  Nube, Fade, Forno y "Project 68" en la base (pendiente de borrar desde `/admin`).
  Nube, Fade y Forno existen solo para los tests (`tests/tiendasDePrueba.js`, cargado por `setupFiles` de
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
