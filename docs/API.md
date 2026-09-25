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
| `GET /api/tarjeta/<serial>`, `/api/push/<serial>`, `GET /api/google/guardar/<serial>`, `GET /api/imagen/<tipo>` | público (la tarjeta de Android: el serial es la llave) |
| `/api/wallet/v1/*` | Apple Wallet (token del pase en `Authorization`) |
| `/<negocio>/caja`, `/w/<serial>`, `/api/accion`, `/api/cliente/<serial>`, `GET /api/clientes`, `GET /api/negocio` | **caja** o manager de ese negocio |
| `/<negocio>/manager`, `PUT /api/negocio`, `POST /api/promo`, `POST /api/crear`, `GET /api/estado` | **manager** de ese negocio |
| `/<negocio>/crm`, `GET /api/crm`, `POST /api/crm/campana`, `/api/crm/cliente/<serial>` | **manager** de ese negocio |
| `/<negocio>/avisos`, `/api/automatizaciones` | **manager** de ese negocio |
| `/api/cron/avisos` | sin sesión: lo protege `CRON_SECRET` (cabecera `Authorization: Bearer …`) |
| `/admin`, `/admin/<slug>`, `/admin/crm`, `/api/admin/*` | **admin de la plataforma** (`victor`, `diego`) |

Sin sesión: página → `307` a `/login?b=<negocio>&next=…` · API → `401`.

### `GET /api/login` · `POST /api/login`
El GET dice si hay accesos de prueba (`USUARIOS_DEMO=1`) y cuáles, para pintarlos en el login.
```json
// POST request                              // response ok (+ cookie httpOnly "sesion")
{ "usuario": "delicanteria", "clave": "..." }        { "ok": true, "negocio": "delicanteria", "rol": "manager" }
```
Usuarios: `<negocio>` = manager · `<negocio>-caja` = caja. Contraseña en `CLAVE_<SLUG>_<ROL>`.
`401` usuario o contraseña incorrectos · `429` demasiados intentos (10 por IP y
negocio en 15 min, 100 por negocio) · `503` falta `AUTH_SECRET` en producción.
Sesión de caja: 30 días. Sesión de manager: 12 h.

### `POST /api/logout`
Borra la cookie. `{ "ok": true }`.

## Emitir

### `GET /api/tap?b=<negocio>[&nuevo=1]`
El "tap NFC". Crea cliente y pase, o **devuelve el que ya tenía ese teléfono**
(cookie `tarjeta_<negocio>`, 1 año). `nuevo=1` fuerza uno nuevo.
- iPhone + Apple configurado → responde el **`.pkpass`** (`application/vnd.apple.pkpass`).
- Resto → `302` a `/p/<serial>` en el mismo dominio (o a la página de WalletWallet en el plan B).
- `429` si una misma IP emite más de 30 pases en 10 min (reabrir el suyo no cuenta).

### `POST /api/crear?b=<negocio>` · manager
```json
{ "serial": "uuid", "codigo": "K7M", "negocio": "delicanteria", "proveedor": "apple", "urlPase": "https://…/p/uuid", "googleSaveUrl": null }
```

### `GET /api/pase/<serial>`
Descarga el `.pkpass` actual (botón "Añadir a Apple Wallet"). `404` si Apple no está configurado.

## Caja

### `GET /api/cliente/<serial>`
```json
{
  "cliente":  { "serial": "…", "negocio": "delicanteria", "codigo": "K7M", "sellos": 5, "premios": 0, "nombre": "Marta", "creado": "…" },
  "negocio":  { "slug": "delicanteria", "nombre": "La Delicantería", "tipo": "sellos", "meta": 8, "premio": "…", "acciones": ["sellar"], "promo": null, "ubicaciones": [], "tema": { … } },
  "eventos":  [ { "tipo": "sellar", "mensaje": "Sello 5/8", "ts": "…" } ],
  "acciones": [ { "key": "sellar", "label": "Añadir sello", "icon": "mas", "descripcion": "…", "correccion": false } ]
}
```

### `PUT /api/cliente/<serial>` — `{ "nombre": "Marta" }`
Fija (o borra con `""`) el nombre que aparece en el pase y avisa al Wallet.
Respuesta: `{ ok, cliente, aviso }`.

### `POST /api/accion` — `{ "serial": "uuid", "accion": "sellar" }`
```json
{ "ok": true, "mensaje": "Sello añadido · 6/8", "cliente": { … }, "aviso": { "proveedor": "apple", "avisados": 1, "web": 1, "google": 0 } }
{ "ok": false, "mensaje": "Aún no llega · 3/8", "cliente": { … } }   // rechazada por la lógica
```
`400` falta serial/acción o acción desconocida · `403` acción desactivada u otro negocio · `404` cliente ·
`409` otra caja modificó al cliente a la vez (`ok: false`, se devuelve el estado actual; repetir).
Si el aviso al Wallet falla, la acción **no** falla (el estado ya está guardado):
`aviso.error` lo indica y el pase se pondrá al día en la próxima sincronización.

### `GET /api/clientes?b=<negocio>`
`[{ serial, negocio, codigo, sellos, premios, nombre, creado }]`, los 200 más
recientes. Nunca incluye `auth_token`.

### `GET /api/clientes?b=<negocio>&codigo=K7M`
Un solo cliente por su **código corto** (3 caracteres), o `404`. La búsqueda se
queda dentro de `<negocio>`: el mismo código en otra tienda es otro cliente y no
se puede resolver desde aquí. Lo usa la caja cuando el QR no se deja leer.

## Manager

### `GET /api/negocio?b=<negocio>` · `PUT /api/negocio?b=<negocio>`
```json
{ "meta": 8, "premio": "Café gratis", "acciones": ["sellar","canjear"], "promo": null,
  "ubicaciones": [ { "lat": 40.4168, "lng": -3.7038, "texto": "opcional" } ] }
```
Campos opcionales, validados (meta 1–50, máx. 10 ubicaciones). Tras guardar se
actualizan **todos** los pases del negocio: respuesta = negocio + `aviso`.

### `POST /api/promo` — `{ "b": "delicanteria", "texto": "Hoy 2x1" }`
Guarda la promo (vacío la quita) y avisa a todos los pases del negocio.
```json
{ "promo": "Hoy 2x1", "proveedor": "apple", "total": 12, "enviadas": 12, "fallidas": [] }
```

### `GET /api/estado`
Qué integraciones están activas (sin secretos): `proveedor`, `apple.{ok, problemas, avisos, passTypeId, caduca, webServiceURL}` (el Pass Type ID general), `appleTiendas` (solo admin: `[{slug, ok, problemas, avisos, propio, passTypeId, caduca}]`, una por tienda con Pass Type ID propio), `google`, `supabase`, `authSecret`, `appUrl`, `httpsPublico`.

## Admin de la plataforma

Todo bajo `/api/admin/` exige sesión de admin (`rol: "admin"`), que además vale para
cualquier negocio.

### `GET /api/admin/negocios?archivados=0|1`
Lista de tiendas (activas o archivadas) con `clientes`, `brief` y `notas`.

### `POST /api/admin/negocios`
```json
{ "slug": "panaderia-rosa", "nombre": "Panadería Rosa", "tipo": "sellos",
  "estilo": "coffee", "emoji": "🥐", "accent": "#c98a3a", "meta": 10,
  "premio": "croissant gratis", "brief": "para que Claude rellene el resto" }
```
`201` con la tienda · `400` datos no válidos · `409` ese identificador ya existe.
Lo que no se envía se rellena solo a partir del estilo elegido. Tanto el POST
(en la raíz del cuerpo) como el PUT (dentro de `tema`) admiten las piezas del
dibujo, que se combinan libremente:

| Pieza | Valores |
|---|---|
| `marca` | `taza` `vaso` `grano` `tijeras` `peine` `poste` `pizza` `burger` `croissant` `helado` `copa` `jarra` `corazon` `estrella` `huella` `pesa` `flor` `libro` `texto` |
| `texto` | hasta 4 caracteres, si `marca` es `texto` (`"68"`, `"NC"`) |
| `forma` | `circulo` `redondeado` `cuadrado` `rombo` `hexagono` |
| `banda` | `clara` `oscura` `blanca` `degradado` `rayas` |
| `modo` | `casillas` (una por sello) · `relleno` (la marca se llena de abajo arriba) |

Los nombres viejos siguen valiendo (`coffee` → `taza`, `barber` → `tijeras`).
La lista real está en [`dibujo.js`](../src/lib/apple/dibujo.js); lo que no
aparezca ahí se descarta sin error. Si el `tema` del PUT trae un `estilo`
válido se entiende como cambio de plantilla: se vuelve a sembrar la paleta
entera y encima van los retoques.

### `PUT /api/admin/negocios`
Con `{ slug, nombre?, meta?, premio?, brief?, tema? }` edita la tienda y avisa a sus pases.
Con `{ slug, nota: { clave, texto } }` guarda un comentario sobre un campo del pase
(`texto` vacío lo borra). Las claves son las de la vista previa: `apple.premio`,
`apple.banda`, `google.puntos`…

### `DELETE /api/admin/negocios?slug=<slug>&modo=<modo>`
`archivar` (por defecto) la esconde de todas partes sin borrar nada · `desarchivar` la
devuelve · `borrar` la elimina para siempre **con sus clientes y su historial**, y exige
`&confirmar=<slug>` exacto.

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

## CRM

Quién es cada cliente y a quién conviene decirle algo. Las cuentas son las de
[`src/lib/crm.js`](../src/lib/crm.js) — la API no calcula nada por su cuenta.

### `GET /api/crm?b=<negocio>` · manager
Todo el panel en una petición.
```json
{
  "negocio":  { "slug": "delicanteria", "nombre": "La Delicantería", "tipo": "sellos", "meta": 8, "premio": "…", "tema": { … } },
  "metricas": { "total": 33, "activos": 11, "enRiesgo": 10, "porEstado": { "activo": 11, … },
                "visitas30": 100, "visitas30Previas": 105, "nuevos30": 6, "premios": 31,
                "instalados": 28, "tasaInstalacion": 85, "tasaVuelta": 79, "cadenciaMedia": 7.1 },
  "grupos":   [ { "key": "fieles_frios", "label": "Fieles que se enfriaron", "total": 9, "contactables": 9, … } ],
  "cohortes": [ { "mes": "2026-08", "altas": 5, "repiten": 3, "vivos": 2, "retencion": 40 } ],
  "clientes": [ { "serial": "…", "codigo": "K7M", "nombre": "Marta", "perfil": { "estado": "riesgo", "visitas": 5, "cadencia": 7.2, "retraso": 3.1, "contactable": true, … } } ],
  "campanas": [ { "id": 1, "grupo": "fieles_frios", "texto": "…", "destinatarios": 9, "avisados": 9, "volvieron": 3, "tasa": 33 } ],
  "eventos":  [ { "serial": "…", "tipo": "sellar", "mensaje": "Sello 5/8", "actor": "caja", "ts": "…" } ]
}
```
Los `eventos` van crudos (120 días, máx. 5000) porque las cuentas que dependen de
la hora local —a qué hora viene la gente— se hacen **en el navegador**: el
servidor vive en UTC y sacaría el café de las 9 a las 7.

### `POST /api/crm/campana` · manager
Manda un mensaje a un GRUPO. El negocio va en el cuerpo (como en `/api/promo`).
```json
// request                                          // response
{ "b": "delicanteria", "grupo": "fieles_frios",             { "ok": true, "campana": { "id": 1, … }, "enGrupo": 9,
  "texto": "Hace tiempo que no te vemos" }            "destinatarios": 9, "avisados": 9, "proveedor": "apple" }
```
El grupo se **recalcula en el servidor**: del navegador solo llega su clave, nunca
la lista de a quién. `texto` vacío quita el mensaje (`{ "quitado": n }`).
`400` grupo desconocido · `409` nadie del grupo tiene el pase instalado.
Tope de 400 por envío; el texto se recorta a 120 caracteres.

### `GET /api/crm/cliente/<serial>` · manager
Ficha completa: `{ cliente, perfil, eventos }` (hasta 100 eventos, del más nuevo al más viejo).

### `PUT /api/crm/cliente/<serial>` · manager
`{ "nota": "sin lactosa" }` → nota interna de la tienda. **No** sale en el pase.

La exportación a CSV ya no es una ruta: el panel de Clientes arma el fichero en el
navegador con la lista que se está viendo (`csvClientes()` de `lib/exportar.js`).

## Avisos automáticos

Detalle en [AVISOS.md](AVISOS.md). Las reglas las decide `lib/automatizaciones.js`.

### `GET /api/automatizaciones?b=<negocio>` · manager
Lo que pinta la pestaña Avisos: `{ negocio (con horario, automatizaciones y pausaAvisos),
contextos, envios, conteos: { <regla>: { encajan, llegaria } }, grupos, historial, reloj: { ultimo } }`.
Los `contextos` van al navegador para contar al momento a cuántos les llegaría una regla mientras se edita.

### `PUT /api/automatizaciones?b=<negocio>` · manager
`{ "automatizaciones": [ … ], "pausaAvisos": 3 }` → guarda la lista entera y devuelve lo mismo que el GET.
`400` con una frase que dice qué regla está mal (`"En «Racha» no existe {premo}"`). No toca los pases.

### `POST /api/automatizaciones?b=<negocio>` · manager — `{ "regla": "te-echamos-de-menos" }`
*Enviar ahora*: manda esa regla ya, sin mirar la hora (a quién, no repetir y la pausa se respetan).
`{ envio: { regla, destinatarios, avisados, web, google }, datos }`. `404` si la regla no está guardada.

### `GET|POST /api/cron/avisos` · `Authorization: Bearer <CRON_SECRET>`
Una pasada del reloj por todas las tiendas: `{ ok, resultados: [{ negocio, retirados, envios: [...] }] }`.
`503` sin `CRON_SECRET` · `401` secreto equivocado. Idempotente: llamarlo de más no repite nada.

### `GET /api/admin/crm` · admin
Las mismas cuentas de todas las tiendas juntas: `{ tiendas: [...], totales: {...} }`.

## Android

Detalle en [ANDROID.md](ANDROID.md) y [GOOGLE-WALLET.md](GOOGLE-WALLET.md).

`aviso` en las respuestas de acción, promo y campaña cuenta por canal:
`avisados`/`enviadas` (iPhone, APNs), `web` (avisos del navegador) y `google`
(tarjetas de Google Wallet actualizadas o avisadas).

### `GET /api/tarjeta/<serial>`
Estado de la tarjeta para que `/p/<serial>` se ponga al día sola. Sin nada interno
(ni nota de la tienda, ni token, ni brief).
```json
{ "cliente": { "serial": "…", "codigo": "K7M", "sellos": 5, "premios": 0, "nombre": null, "mensaje": null },
  "negocio": { "slug": "delicanteria", "nombre": "La Delicantería", "tipo": "sellos", "meta": 8, "premio": "café gratis", "promo": null, "tema": { … } } }
```

### `POST /api/push/<serial>` — `{ "suscripcion": PushSubscription.toJSON() }`
Activa los avisos del navegador para esa tarjeta y manda un aviso de bienvenida.
`{ ok, nuevo, probado }`. `400` suscripción no válida (solo servicios de push
reales, por https) · `409` ya hay 5 navegadores · `410` el navegador la rechazó ·
`429` más de 20 altas por IP en 10 min · `503` sin claves VAPID.

### `DELETE /api/push/<serial>` — `{ "endpoint": "https://fcm.googleapis.com/…" }`
Quita los avisos de esa tarjeta en ese navegador (las de otras tiendas siguen).

### `GET /api/google/guardar/<serial>`
Crea o pone al día el objeto en Google Wallet y `302` a `pay.google.com/gp/v/save/<jwt>`.
`404` si Google no está configurado.

### `GET /api/imagen/<tipo>?b=<negocio>&v=<huella>`
PNG dibujado con la marca de la tienda. `tipo`: `icono` (`t=` lado, `m=1`
adaptable), `insignia` (barra de avisos), `logo` (Google, 660x660), `banda`
(`s=` sellos o `u=0|1` en cupones, 1032x336). Con la huella vigente se cachea un año.

### `GET /api/manifest?p=<serial>`
Manifest de la tarjeta como app instalable (abre en `/p/<serial>`). Con `?b=` sigue
siendo el de la caja.
