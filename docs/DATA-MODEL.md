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
| `config` | jsonb | `{ meta, premio, acciones, promo, ubicaciones: [{lat,lng,texto?}] }` |

### `clientes` — la identidad detrás de cada pase
| Campo | Tipo | Notas |
|-------|------|-------|
| `serial` | text PK | uuid nuestro; va en el QR (`/w/<serial>`) |
| `negocio` | text | slug |
| `sellos`, `premios` | int | estado |
| `nombre` | text? | personalización (sale en el pase) |
| `auth_token` | text | `authenticationToken` del pase (secreto, nunca al navegador) |
| `actualizado` | timestamptz | se marca en cada cambio; Apple pregunta "¿qué cambió desde…?" |
| `ww_serial` | text? | solo plan B WalletWallet |
| `creado` | timestamptz | |

### `eventos` — historial
`id` · `serial` · `tipo` (clave de acción) · `mensaje` · `ts`

### `dispositivos` — iPhones con algún pase
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | text PK | `deviceLibraryIdentifier` de Apple |
| `push_token` | text | destino de los avisos APNs |

### `registros` — qué pases tiene cada iPhone
| Campo | Tipo | Notas |
|-------|------|-------|
| `dispositivo` | text FK → dispositivos (cascade) | |
| `pass_type` | text | `APPLE_PASS_TYPE_ID` |
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
Eventos:      addEvento(serial, tipo, mensaje) · listEventos(serial, limit=8)
Apple Wallet: registrarPase({dispositivo, pushToken, passType, serial, negocio}) -> nuevo?
              borrarRegistro({dispositivo, passType, serial})
              pasesDeDispositivo({dispositivo, passType}) -> [{serial, actualizado}]
              pushTokens({seriales?, negocio?}) · borrarDispositivosPorToken(tokens)
Límites:      registrarIntento(clave) · contarIntentos(clave, desdeMs)
```

## Backend demo (ficheros)
`.data/{negocios,clientes,eventos,dispositivos,registros,intentos}.json`. En `.gitignore`.
(`.data/` de la versión anterior de un solo negocio no es compatible: bórrala si ves clientes raros.)
Todas las operaciones van en fila dentro del proceso. Vale para local; **no** para
Vercel (el sistema de ficheros no persiste). La carpeta se cambia con `DATA_DIR` (tests).
