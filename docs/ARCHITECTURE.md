# Arquitectura

## El modelo mental

**El pase es una tarjeta de identidad tonta. La inteligencia vive en la caja + el
backend.** Su QR lleva una sola cosa: `APP_URL/w/<serial>` ("este soy yo"). Qué
significa un escaneo hoy, y qué muestra el pase, lo decide el servidor.

- **Escaneo** (pase → caja): solo un ID.
- **Actualización** (backend → pase): un aviso *después* del escaneo; el iPhone baja
  el pase nuevo. Ahí es cuando "se rellena el café".

## Piezas

| Pieza | Rol | Código |
|-------|-----|--------|
| **Negocio** | Preset (nombre, tipo, tema) + config editable (meta, premio, acciones, promo, ubicaciones) | [`negocios.js`](../src/lib/negocios.js), `store.getNegocio` |
| **Pase** | Identidad del cliente. Su cara es un espejo del estado | [`apple/pase.js`](../src/lib/apple/pase.js), [`apple/imagenes.js`](../src/lib/apple/imagenes.js) |
| **Caja** | Escanea → perfil → acción. PWA por negocio | [`[negocio]/caja`](../src/app/[negocio]/caja), [`w/[serial]`](../src/app/w/[serial]) |
| **Manager** | Configura, lanza promos, emite, ve el estado de integración | [`[negocio]/manager`](../src/app/[negocio]/manager) |
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

## Los bucles

### 1. Emitir (tap NFC)
```
tag NFC → GET /api/tap?b=nube → emitirPase(): cliente {serial uuid, auth_token aleatorio}
        → iPhone: generarPkpass() → .pkpass → "Añadir a Wallet"
        → otros:  302 /p/<serial>
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
  → notificarCliente → APNs push vacío a los push tokens del serial
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
- **Google Wallet**: `hayGoogle()` → enlace "Guardar en Google Wallet".

## <a name="seguridad"></a>Seguridad

- **Login por negocio.** PIN de caja y de manager por negocio (`PIN_<SLUG>_<ROL>`).
  Sesión HMAC `negocio.rol.exp.firma`: una sesión de Nube no vale en Fade. El
  middleware aplica las reglas de [`acceso.js`](../src/lib/acceso.js); los handlers
  comprueban el negocio del recurso (cliente, `?b=`, body). Por defecto, cualquier
  `/api` nueva exige sesión.
- **Fallo cerrado en producción.** Sin `AUTH_SECRET` no se firman ni aceptan sesiones;
  sin PIN configurado, ese rol no entra. Los valores de demo solo existen en desarrollo.
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
  servicio externo de QR).
- **Supabase.** `service_role` solo en backend; RLS activado sin políticas (la anon key
  no puede leer nada).
- **Certificados.** Clave privada y `.cer` en `certs/` (ignorado por git); en Vercel,
  como variables de entorno.
- **Pendiente.** QR estático: una captura se puede *enseñar*, pero sin sesión de caja
  no se puede actuar y el pase no se puede reenviar (`sharingProhibited`). Cerrarlo del
  todo requiere código rotativo o NFC (aprobación de Apple).
