# API

Todas las rutas corren en Node (`runtime = "nodejs"`) y son dinámicas. Los errores
devuelven `{ "error": "..." }`; los 500 no exponen detalles (van al log del servidor).

## Acceso

Reglas en [`src/lib/acceso.js`](../src/lib/acceso.js), aplicadas por
[`src/middleware.js`](../src/middleware.js). Los handlers comprueban además que la
sesión sea **del negocio del recurso** (`403` si no).

| Ruta | Acceso |
|------|--------|
| `/`, `/<negocio>`, `/login`, `/api/login`, `/api/logout`, `/api/manifest`, `/api/negocios` | público |
| `GET /api/tap`, `/p/<serial>`, `GET /api/pase/<serial>` | público (emitir y ver/descargar el propio pase) |
| `/api/wallet/v1/*` | Apple Wallet (token del pase en `Authorization`) |
| `/<negocio>/caja`, `/w/<serial>`, `/api/accion`, `/api/cliente/<serial>`, `GET /api/clientes`, `GET /api/negocio` | **caja** o manager de ese negocio |
| `/<negocio>/manager`, `PUT /api/negocio`, `POST /api/promo`, `POST /api/crear`, `GET /api/estado` | **manager** de ese negocio |

Sin sesión: página → `307` a `/login?b=<negocio>&next=…` · API → `401`.

### `POST /api/login`
```json
// request                          // response ok (+ cookie httpOnly "sesion")
{ "negocio": "nube", "pin": "1234" }  { "ok": true, "negocio": "nube", "rol": "caja" }
```
`400` negocio inválido · `401` PIN incorrecto · `429` demasiados intentos (10 por IP y
negocio en 15 min, 100 por negocio) · `503` falta `AUTH_SECRET` en producción.
Sesión de caja: 30 días. Sesión de manager: 12 h.

### `POST /api/logout`
Borra la cookie. `{ "ok": true }`.

## Emitir

### `GET /api/tap?b=<negocio>`
El "tap NFC". Crea cliente y pase.
- iPhone + Apple configurado → responde el **`.pkpass`** (`application/vnd.apple.pkpass`).
- Resto → `302` a `/p/<serial>` (o a la página de WalletWallet en el plan B).
- `429` si una misma IP emite más de 30 pases en 10 min.

### `POST /api/crear?b=<negocio>` · manager
```json
{ "serial": "uuid", "negocio": "nube", "proveedor": "apple", "urlPase": "https://…/p/uuid", "googleSaveUrl": null }
```

### `GET /api/pase/<serial>`
Descarga el `.pkpass` actual (botón "Añadir a Apple Wallet"). `404` si Apple no está configurado.

## Caja

### `GET /api/cliente/<serial>`
```json
{
  "cliente":  { "serial": "…", "negocio": "nube", "sellos": 5, "premios": 0, "nombre": "Marta", "creado": "…" },
  "negocio":  { "slug": "nube", "nombre": "Nube Café", "tipo": "sellos", "meta": 8, "premio": "…", "acciones": ["sellar"], "promo": null, "ubicaciones": [], "tema": { … } },
  "eventos":  [ { "tipo": "sellar", "mensaje": "Sello 5/8", "ts": "…" } ],
  "acciones": [ { "key": "sellar", "label": "Añadir sello", "icon": "➕", "descripcion": "…" } ]
}
```

### `PUT /api/cliente/<serial>` — `{ "nombre": "Marta" }`
Fija (o borra con `""`) el nombre que aparece en el pase y avisa al Wallet.
Respuesta: `{ ok, cliente, aviso }`.

### `POST /api/accion` — `{ "serial": "uuid", "accion": "sellar" }`
```json
{ "ok": true, "mensaje": "Sello añadido · 6/8", "cliente": { … }, "aviso": { "proveedor": "apple", "avisados": 1 } }
{ "ok": false, "mensaje": "Aún no llega · 3/8", "cliente": { … } }   // rechazada por la lógica
```
`400` falta serial/acción o acción desconocida · `403` acción desactivada u otro negocio · `404` cliente ·
`409` otra caja modificó al cliente a la vez (`ok: false`, se devuelve el estado actual; repetir).
Si el aviso al Wallet falla, la acción **no** falla (el estado ya está guardado):
`aviso.error` lo indica y el pase se pondrá al día en la próxima sincronización.

### `GET /api/clientes?b=<negocio>`
`[{ serial, negocio, sellos, premios, nombre, creado }]`, los 200 más recientes.
Nunca incluye `auth_token`.

## Manager

### `GET /api/negocio?b=<negocio>` · `PUT /api/negocio?b=<negocio>`
```json
{ "meta": 8, "premio": "Café gratis", "acciones": ["sellar","canjear"], "promo": null,
  "ubicaciones": [ { "lat": 40.4168, "lng": -3.7038, "texto": "opcional" } ] }
```
Campos opcionales, validados (meta 1–50, máx. 10 ubicaciones). Tras guardar se
actualizan **todos** los pases del negocio: respuesta = negocio + `aviso`.

### `POST /api/promo` — `{ "b": "nube", "texto": "Hoy 2x1" }`
Guarda la promo (vacío la quita) y avisa a todos los pases del negocio.
```json
{ "promo": "Hoy 2x1", "proveedor": "apple", "total": 12, "enviadas": 12, "fallidas": [] }
```

### `GET /api/estado`
Qué integraciones están activas (sin secretos): `proveedor`, `apple.{configurado, faltan, passTypeId, webServiceURL}`, `google`, `supabase`, `authSecret`, `appUrl`, `httpsPublico`.

## Apple Wallet web service

Base: `APP_URL/api/wallet` (es el `webServiceURL` de cada pase). Lo llama el iPhone;
protocolo de Apple. Detalle en [APPLE-WALLET.md](APPLE-WALLET.md).

| Método y ruta | Respuestas |
|---------------|-----------|
| `POST /v1/devices/:dispositivo/registrations/:passType/:serial` — `{ pushToken }` | `201` nuevo · `200` ya existía · `400` · `401` |
| `DELETE /v1/devices/:dispositivo/registrations/:passType/:serial` | `200` · `401` |
| `GET /v1/devices/:dispositivo/registrations/:passType?passesUpdatedSince=<tag>` | `200 { serialNumbers, lastUpdated }` · `204` sin cambios |
| `GET /v1/passes/:passType/:serial` | `200` `.pkpass` + `Last-Modified` · `401` |
| `POST /v1/log` — `{ logs: [...] }` | `200` (se escriben en el log con `[apple-wallet]`, sin caracteres de control; máx. 60 llamadas por IP en 10 min) |

Autenticación: `Authorization: ApplePass <authenticationToken>` (el `auth_token` del
cliente). Si Apple no está configurado, todas devuelven `404`.
