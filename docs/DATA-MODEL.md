# Modelo de datos

Tres entidades. La misma API de acceso ([`src/lib/store.js`](../src/lib/store.js))
sirve para los dos backends: **Supabase** (real) o **ficheros JSON en `.data/`**
(demo). Se elige con `hasSupabase()`.

## Entidades

### `programa` (config del manager — singleton)
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | text | siempre `'default'` |
| `titulo` | text | título de la tarjeta |
| `color` | text | preset: dark/blue/green/red/purple/orange |
| `meta` | int | sellos para el premio |
| `premio` | text | descripción del premio |
| `acciones` | jsonb / array | claves de acciones activas |
| `promo` | text\|null | promo activa |

### `clientes` (la identidad detrás de cada pase)
| Campo | Tipo | Notas |
|-------|------|-------|
| `serial` | text (PK) | lo genera WalletWallet |
| `sellos` | int | contador actual |
| `premios` | int | premios canjeados |
| `creado` | timestamptz | |

### `eventos` (historial / actividad)
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | bigint (PK) | autoincremental |
| `serial` | text (FK → clientes) | |
| `tipo` | text | clave de la acción |
| `mensaje` | text | texto mostrado en el perfil |
| `ts` | timestamptz | |

## API del store

```
Programa:  getPrograma()                       -> {…}
           savePrograma(patch)                 -> {…}          (merge + persist)
Clientes:  crearCliente(serial)
           getCliente(serial)                  -> {serial,sellos,premios}|null
           saveCliente({serial,sellos,premios})
           listClientes()                      -> [ … ]
Eventos:   addEvento(serial, tipo, mensaje)
           listEventos(serial, limit=8)        -> [ … ] (recientes primero)
```

## Backend demo (ficheros)
- `.data/programa.json` — objeto de config.
- `.data/clientes.json` — mapa `{ [serial]: cliente }`.
- `.data/eventos.json`  — array de eventos.

`.data/` está en `.gitignore`. Es efímero y local: perfecto para la demo, no vale
para producción en serverless (Vercel no persiste el sistema de ficheros).

## Backend real (Supabase)
Ejecuta [`../supabase/schema.sql`](../supabase/schema.sql) (crea las 3 tablas +
la fila `programa` por defecto + índice de eventos). Variables de entorno:

```
SUPABASE_URL=…
SUPABASE_SERVICE_KEY=…        # service_role, SOLO backend
```

Con esas dos, `hasSupabase()` es true y el store pasa a Supabase sin más cambios.
