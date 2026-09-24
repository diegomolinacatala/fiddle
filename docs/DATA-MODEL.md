# Modelo de datos

Una API de acceso ([`src/lib/store.js`](../src/lib/store.js)) para dos backends:
**Supabase** (real) o **ficheros JSON en `.data/`** (demo). Se elige con `hasSupabase()`.
Esquema: [`supabase/schema.sql`](../supabase/schema.sql) (idempotente, con RLS).

## Tablas

### `negocios` — config editable por su manager
| Campo | Tipo | Notas |
|-------|------|-------|
| `slug` | text PK | `nube`, `fade`, `forno` (el preset vive en `negocios.js`) |
| `nombre`, `tipo` | text | copia informativa del preset |
| `config` | jsonb | `{ meta, premio, acciones, promo, ubicaciones, tema, brief, notas, archivado }` |

`tema` (colores, emoji y las piezas del dibujo: `marca` · `texto` · `forma` ·
`banda` · `modo`, ver [`dibujo.js`](../src/lib/apple/dibujo.js)), `brief` (texto libre para Claude), `notas`
(`{"apple.premio": "esto debería ser X"}`, del modo comentarios del admin) y
`archivado` los edita **/admin**. Las tiendas se crean y se borran ahí: `negocios.js`
solo aporta las *semillas* y las plantillas de estilo. Un tema guardado antes de
las piezas sueltas sigue valiendo: `piezasDeTema()` las deduce de su `estilo`, y
hay un test que fija que el SVG que sale es idéntico al de antes.

### `clientes` — la identidad detrás de cada pase
| Campo | Tipo | Notas |
|-------|------|-------|
| `serial` | text PK | uuid nuestro; va en el QR (`/w/<serial>`) |
| `negocio` | text | slug |
| `codigo` | text | clave corta de 3 caracteres, **única dentro del negocio** (la misma puede repetirse en otra tienda). Se asigna al emitir; los clientes antiguos la deducen de su serial. Ver [`codigo.js`](../src/lib/codigo.js) |
| `sellos`, `premios` | int | estado |
| `nombre` | text? | personalización (sale en el pase) |
| `auth_token` | text | `authenticationToken` del pase (secreto, nunca al navegador) |
| `actualizado` | timestamptz | se marca en cada cambio; Apple pregunta "¿qué cambió desde…?" |
| `ww_serial` | text? | solo plan B WalletWallet |
| `creado` | timestamptz | |
| `visitas`, `ultima_visita` | int · timestamptz? | **resumen del historial**, mantenido al vuelo por `registrarVisita`. Sin esto, agrupar clientes por comportamiento obligaría a recorrer `eventos` entero en cada pantalla |
| `instalado`, `desinstalado` | timestamptz? | cuándo entró el pase en un Wallet y cuándo salió del último iPhone. Lo apunta el web service de Apple, que es el único que se entera |
| `origen` | text? | `tap` (tag NFC) · `manager` (mostrador) |
| `mensaje` | text? | aviso personal que sale EN el pase (campañas). Gana a `promo` del negocio |
| `nota` | text? | lo que la tienda apunta a mano. **No** sale en el pase |

### `eventos` — historial
`id` · `serial` · `negocio` · `tipo` · `mensaje` · `actor` · `ts`

`tipo` es una clave de acción (`sellar`, `canjear`…) o uno de los que pasan solos:
`alta` (pase emitido), `instalado` / `desinstalado` (Wallet) y `campana`.
`actor` dice desde dónde: `caja`, `manager`, `admin`, `tap`, `apple`.

`negocio` va **desnormalizado**: el CRM siempre pregunta por tienda ("toda la
actividad de nube") y sin esa columna habría que leer antes sus miles de seriales
solo para poder filtrar por ellos.

### `campanas` — envíos a un grupo
| Campo | Tipo | Notas |
|-------|------|-------|
| `negocio` · `grupo` | text | el grupo es una clave de [`crm.js`](../src/lib/crm.js) |
| `texto` | text | lo que se escribió en el pase |
| `destinatarios` · `avisados` | int | a cuántos y a cuántos les llegó el empujón |
| `seriales` | jsonb | a quién, para poder medir después quién volvió |
| `creado` | timestamptz | |

Se guarda con la lista porque si no, no hay forma de responder a la única
pregunta que importa: ¿volvió alguno?

### `dispositivos` — teléfonos a los que avisar (iPhone, navegador Android, Google Wallet)
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | text PK | iPhone: `deviceLibraryIdentifier` · navegador: `web-<sha256 del endpoint>` · Google: `google-<serial>` |
| `push_token` | text | iPhone: token APNs · navegador: la suscripción push en JSON · Google: id del objeto |

### `registros` — qué tarjetas tiene cada teléfono
| Campo | Tipo | Notas |
|-------|------|-------|
| `dispositivo` | text FK → dispositivos (cascade) | |
| `pass_type` | text | el canal: el Pass Type ID con que se instaló (iPhone: el general o el propio de la tienda) · `web` (avisos del navegador) · `google` (Google Wallet) |
| `serial` | text FK → clientes (cascade) | |
| `negocio` | text | desnormalizado para avisar a todo un negocio |
PK (`dispositivo`, `pass_type`, `serial`).

### `intentos` — límites de uso
`id` · `clave` · `ts`. Claves: `login:<negocio>:<ip>`, `login:<negocio>:*` (PINs
fallidos), `tap:<ip>` (emisiones), `log:<ip>` (logs de Apple). Ver
[`limitador.js`](../src/lib/limitador.js).

## API del store

```
Negocios:     getNegocio(slug) · listNegocios() · saveNegocio(slug, patch)
Clientes:     crearCliente({serial, negocio, authToken, wwSerial?}) · getCliente(serial)
              saveCliente({serial, sellos, premios}, {esperado?}) -> guardado?
                (marca actualizado; con `esperado` solo escribe si el estado no cambió:
                 dos cajas canjeando a la vez no entregan el premio dos veces)
              guardarNombre(serial, nombre) -> guardado?
              tocarClientesDeNegocio(slug) · listClientes(negocio?, {limite?}) · clientePublico(c)
              getClientePorCodigo(negocio, "K7M")  (busca solo dentro de ese negocio)
Eventos:      addEvento(serial, tipo, mensaje, {negocio?, actor?}) · addEventos(filas)
              listEventos(serial, limit=8) · listEventosDeNegocio(slug, {dias=120, limite=5000})
CRM:          registrarVisita(serial) -> bool     (suma visita y pone la fecha)
              marcarInstalacion(serial, dentro)   (el alta solo se escribe una vez)
              guardarMensajes(seriales, texto) -> n   (una campaña, en lotes de 200)
              guardarNota(serial, nota) -> bool
              crearCampana({negocio, grupo, texto, seriales, avisados}) · listCampanas(slug)
              serialesRegistrados(slug) -> Set    (a quién se puede avisar)
Apple Wallet: registrarPase({dispositivo, pushToken, passType, serial, negocio}) -> nuevo?
              borrarRegistro({dispositivo, passType, serial})
              pasesDeDispositivo({dispositivo, passType}) -> [{serial, actualizado}]
              pushTokens({seriales?, negocio?}) · borrarDispositivosPorToken(tokens)
Límites:      registrarIntento(clave) · contarIntentos(clave, desdeMs)
```

## Backend demo (ficheros)
`.data/{negocios,clientes,eventos,dispositivos,registros,intentos,campanas}.json`. En `.gitignore`.
(`.data/` de la versión anterior de un solo negocio no es compatible: bórrala si ves clientes raros.)
Todas las operaciones van en fila dentro del proceso. Vale para local; **no** para
Vercel (el sistema de ficheros no persiste). La carpeta se cambia con `DATA_DIR` (tests).
