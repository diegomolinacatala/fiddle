# Arquitectura

## El modelo mental

**El pase es una tarjeta de identidad tonta. La inteligencia vive en la caja + el
backend.** Su QR lleva una sola cosa: `APP_URL/w/<serial>` ("este soy yo"). Qué
significa un escaneo hoy, y qué muestra el pase, lo decide el servidor.

- **Escaneo** (pase → caja): solo un ID. Si el QR no se deja leer, vale el
  **código corto** de 3 caracteres del pase, que solo significa algo dentro de
  su negocio ([`codigo.js`](../src/lib/codigo.js)).
- **Actualización** (backend → pase): un aviso *después* del escaneo; el iPhone baja
  el pase nuevo, Google empuja el suyo y la tarjeta web de Android se refresca y
  suena. Ahí es cuando "se rellena el café".

## Piezas

| Pieza | Rol | Código |
|-------|-----|--------|
| **Negocio** | Preset (nombre, tipo, tema) + config editable (meta, premio, acciones, promo, ubicaciones) | [`negocios.js`](../src/lib/negocios.js), `store.getNegocio` |
| **Pase** | Identidad del cliente. Su cara es un espejo del estado | [`apple/pase.js`](../src/lib/apple/pase.js), [`apple/imagenes.js`](../src/lib/apple/imagenes.js) |
| **Tarjeta web** | El pase en Android: misma cara que el de Apple, instalable, en vivo y con avisos | [`p/[serial]`](../src/app/p/[serial]), [`lib/push`](../src/lib/push), [ANDROID.md](ANDROID.md) |
| **Google Wallet** | Clase por tienda + objeto por cliente, reescritos con cada cambio | [`lib/google`](../src/lib/google), [GOOGLE-WALLET.md](GOOGLE-WALLET.md) |
| **Caja** | Escanea → perfil → acción. PWA por negocio | [`[negocio]/caja`](../src/app/[negocio]/caja), [`w/[serial]`](../src/app/w/[serial]) |
| **Manager** | Configura, lanza promos, emite, ve el estado de integración y cómo queda el pase (Apple/Google) | [`[negocio]/manager`](../src/app/[negocio]/manager) |
| **CRM** | Quién viene, quién dejó de venir, grupos de clientes y avisos a un grupo | [`[negocio]/crm`](../src/app/[negocio]/crm), [`lib/crm.js`](../src/lib/crm.js) |
| **Admin** | Crea, edita, archiva y borra tiendas; comenta campos del pase para Claude | [`admin/`](../src/app/admin) |
| **Backend** | Guarda estado, aplica acciones, avisa al Wallet | [`src/lib`](../src/lib), `/api/*` |

## Proveedores de Wallet

[`src/lib/wallet.js`](../src/lib/wallet.js) es la única puerta: `emitirPase`,
`notificarCliente`, `notificarNegocio`. Elige solo:

| Proveedor | Cuándo | Firma | Actualización |
|-----------|--------|-------|---------------|
| **apple** | hay variables `APPLE_*` | nosotros (passkit-generator) | web service propio + APNs |
| walletwallet | solo `WALLETWALLET_API_KEY` | WalletWallet | `PUT` a su API |
| demo | nada | — | — (el estado vive en el store) |

Las rutas no saben cuál hay debajo.

Los **avisos** van por todos los canales a la vez, cada uno a quien lo tenga
(tabla `registros`, columna `pass_type`):

| Canal | Quién | Cómo |
|-------|-------|------|
| iPhone | añadió el pase a Apple Wallet | APNs vacío → el iPhone baja el pase |
| Android (web) | activó los avisos en su tarjeta | web push firmado con VAPID → aviso del navegador |
| Google Wallet | guardó la tarjeta en Google | PUT del objeto (+ `notifyPreference`) o `addMessage` |

Qué texto suena en Android lo decide [`avisos.js`](../src/lib/avisos.js) comparando
el estado de antes y el de después (un sello sí; una corrección, no).

## Los bucles

### 1. Emitir (tap NFC)
```
tag NFC → GET /api/tap?b=nube → emitirPase(): cliente {serial uuid, auth_token aleatorio}
        → iPhone: generarPkpass() → .pkpass → "Añadir a Wallet"
        → otros:  302 /p/<serial>   (Google Wallet · avisos · instalar)
cookie tarjeta_<negocio>: el siguiente tap del mismo teléfono devuelve SU tarjeta
```

### 2. Registrar (automático, al añadir el pase)
```
iPhone → POST /api/wallet/v1/devices/<id>/registrations/<passType>/<serial>
         Authorization: ApplePass <auth_token>   { pushToken }
       → tablas dispositivos + registros
```

### 3. Escanear y actualizar
```
caja escanea QR → /w/<serial> (sesión de caja de ESE negocio)
  → POST /api/accion → acciones.js (lógica pura) → saveCliente (marca `actualizado`)
  → notificarCliente(antes, después) → APNs push vacío a los push tokens del serial
                                      → web push "Sello 5 de 8…" a sus navegadores
                                      → PUT del objeto de Google (con aviso)
  → iPhone: GET …/registrations/<passType>?passesUpdatedSince=<tag>  → [serial]
            GET /api/wallet/v1/passes/<passType>/<serial>          → pase nuevo
  → notificación en pantalla de bloqueo (campos con changeMessage)
```
Promos y cambios de config usan `notificarNegocio`: marcan todos los clientes del
negocio y avisan a todos sus dispositivos.

**El aviso nunca tumba la acción**: si APNs falla, el estado ya está guardado y el
iPhone lo recogerá en su próxima sincronización. Los tokens que Apple rechaza
(`410`, `BadDeviceToken`) se borran.

## Modo demo vs real

Cada dependencia se detecta por separado:
- **Almacenamiento**: `hasSupabase()` → Supabase; si no, JSON en `.data/` (operaciones
  en fila para que las peticiones simultáneas no se pisen).
- **Wallet**: `proveedorWallet()` (tabla de arriba).
- **Google Wallet**: `hayGoogle()` → botón "Añadir a Google Wallet" y actualizaciones.
- **Avisos web**: `hayPush()` → hay claves VAPID (propias o derivadas de `AUTH_SECRET`).

## <a name="seguridad"></a>Seguridad

- **Login por negocio.** Usuario (`nube` manager · `nube-caja`) y contraseña (`CLAVE_<SLUG>_<ROL>`).
  Sesión HMAC `negocio.rol.exp.firma`: una sesión de Nube no vale en Fade. El
  middleware aplica las reglas de [`acceso.js`](../src/lib/acceso.js); los handlers
  comprueban el negocio del recurso (cliente, `?b=`, body). Por defecto, cualquier
  `/api` nueva exige sesión.
- **Fallo cerrado en producción.** Sin `AUTH_SECRET` no se firman ni aceptan sesiones;
  sin contraseña configurada, ese usuario no entra. Los accesos de prueba (contraseña =
  usuario, visibles en el login) solo existen fuera de producción o con `USUARIOS_DEMO=1`.
- **Límites de uso** (persistidos en `intentos`): login 10 fallos por IP+negocio y 100
  por negocio en 15 min; `/api/tap` 30 pases por IP en 10 min (firmar cuesta CPU);
  log de Apple 60 por IP en 10 min.
- **Doble canje.** `saveCliente` optimista: solo escribe si el estado sigue siendo el
  leído. Dos cajas canjeando a la vez → una recibe `409` y repite.
- **Cabeceras.** CSP (solo recursos propios, sin iframes), `X-Frame-Options: DENY`,
  `nosniff`, HSTS, `Permissions-Policy` (cámara y ubicación solo del propio sitio).
  En [`next.config.mjs`](../next.config.mjs).
- **Token del pase.** `auth_token` (48 hex) autentica al iPhone ante el web service.
  Nunca sale hacia el navegador (`clientePublico`). Comparaciones en tiempo constante.
- **Redirecciones.** El `next` del login solo acepta rutas internas del mismo negocio.
- **Privacidad.** El QR se genera en el navegador (antes se enviaba el serial a un
  servicio externo de QR). La página pública de la tarjeta solo recibe los campos que
  pinta (`lib/tarjeta.js`): ni la nota interna de la tienda, ni el token, ni el brief.
- **Avisos web.** El servidor solo manda avisos a endpoints de servicios de push reales
  (FCM, Mozilla, Apple, Windows) por https: una suscripción inventada no puede hacerle
  pegar a una URL interna. Máximo 5 navegadores por tarjeta, 20 altas por IP cada 10 min.
- **Supabase.** `service_role` solo en backend; RLS activado sin políticas (la anon key
  no puede leer nada).
- **Certificados.** Clave privada y `.cer` en `certs/` (ignorado por git); en Vercel,
  como variables de entorno.
- **Pendiente.** QR estático: una captura se puede *enseñar*, pero sin sesión de caja
  no se puede actuar y el pase no se puede reenviar (`sharingProhibited`). Cerrarlo del
  todo requiere código rotativo o NFC (aprobación de Apple).
