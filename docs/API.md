# API

Base: la URL de la app. Todas las rutas corren en Node (`runtime = "nodejs"`) y
son dinámicas. En modo demo no requieren credenciales.

## Emitir

### `GET /api/tap`
El "tap NFC". Crea un pase y **redirige (302)** a su `shareUrl`. Es la URL que se
carga en el tag NFC / QR del mostrador.

### `POST /api/crear`
Crea un pase y devuelve JSON (lo usa el botón del manager).
```json
{ "serial": "uuid", "shareUrl": "https://…/p/uuid", "demo": true }
```

## Trabajador

### `GET /api/cliente/<serial>`
Perfil completo para la vista del trabajador.
```json
{
  "cliente":  { "serial": "…", "sellos": 5, "premios": 0 },
  "programa": { "titulo": "…", "meta": 8, "premio": "…", "acciones": ["sellar"], "promo": null },
  "eventos":  [ { "tipo": "sellar", "mensaje": "Sello 5/8", "ts": "…" } ],
  "acciones": [ { "key": "sellar", "label": "Añadir sello", "icon": "➕", "descripcion": "…" } ]
}
```
`404` si el cliente no existe.

### `POST /api/accion`
Ejecuta una acción sobre un cliente.
```json
// request
{ "serial": "uuid", "accion": "sellar" }
// response ok
{ "ok": true, "mensaje": "Sello añadido · 6/8", "cliente": { "serial": "…", "sellos": 6, "premios": 0 } }
// response rechazada por la lógica (p.ej. canjear sin cartilla llena)
{ "ok": false, "mensaje": "Aún no llega · 3/8" }
```
Errores: `400` falta serial/accion o acción desconocida · `403` acción no activada
por el manager · `404` cliente no encontrado.

## Manager

### `GET /api/programa`
Devuelve la config actual (`titulo, color, meta, premio, acciones, promo`).

### `PUT /api/programa`
Guarda la config. Campos opcionales; se validan y recortan.
```json
{ "titulo": "Café Nostra", "color": "dark", "meta": 8, "premio": "Café gratis",
  "acciones": ["sellar","canjear"], "promo": null }
```

### `POST /api/promo`
Guarda la promo a nivel de programa y la **empuja a todos** los pases. `texto`
vacío/omitido la quita.
```json
// request
{ "texto": "Hoy 2x1 en lattes" }
// response
{ "promo": "Hoy 2x1 en lattes", "total": 12, "enviadas": 12, "fallidas": [] }
```

### `GET /api/clientes`
Lista de clientes `[{ serial, sellos, premios, creado }]` (desc por creación).

## Notas
- El serial lo genera **WalletWallet** (o un UUID en demo); el cliente no lo elige.
- `updatePass` reemplaza el pase entero (no es patch): el aspecto se reconstruye
  con `buildPassBody(cliente, programa)`. Ver [ARCHITECTURE](ARCHITECTURE.md).
