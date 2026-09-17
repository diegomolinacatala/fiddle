# Apple Wallet con cuenta de Apple Developer

Con la cuenta de Apple Developer **firmamos los pases nosotros** y **los actualizamos
nosotros** (web service + avisos APNs). Sin intermediarios, sin límites de plan y con
diseño completo: colores exactos, icono, logo y una **banda con la cartilla de sellos
dibujada** que cambia con cada sello.

> Todo se hace **desde Windows**: no hace falta Mac ni "Acceso a Llaveros". El script
> `scripts/apple-setup.mjs` genera la clave y el CSR y convierte el certificado.

---

## 1. Qué necesitas de Apple (una vez, ~10 min)

### 1.1 Clave privada + CSR (en tu ordenador)

```bash
npm run apple:csr -- --email tu@correo.com
```

Crea en `certs/` (carpeta ignorada por git):

| Fichero | Qué es | Dónde va |
|---------|--------|----------|
| `pass.key.pem` | **clave privada** | en ningún sitio público. Haz copia en tu gestor de contraseñas: si la pierdes, hay que sacar otro certificado |
| `pass.certSigningRequest` | la petición de certificado | se sube a Apple (paso 1.3) |

### 1.2 Crear el Pass Type ID

1. <https://developer.apple.com/account/resources/identifiers/list/passTypeId>
2. **+** → **Pass Type IDs** → Continue.
3. Description: `Sellos` · Identifier: `pass.com.TUDOMINIO.sellos` → **Register**.

Un solo Pass Type ID sirve para todos los negocios (cada pase lleva el nombre de su
negocio). El identificador **no se puede cambiar** una vez emitidos pases.

### 1.3 Certificado del Pass Type ID

1. Abre el Pass Type ID recién creado → **Create Certificate**.
2. Sube `certs/pass.certSigningRequest` → Continue → **Download**.
3. Guarda el fichero como **`certs/pass.cer`**.

### 1.4 Convertirlo en variables de entorno

```bash
npm run apple:env
```

El script:
- comprueba que el certificado corresponde a tu clave privada,
- lee el **Pass Type ID** y el **Team ID** del propio certificado,
- descarga el intermedio **Apple WWDR G4** de apple.com,
- escribe `certs/apple.env` con las 5 variables (certificados en base64, una línea).

Te muestra también **la fecha de caducidad**: apúntala. Antes de que caduque, repite
1.3–1.4 (mismo Pass Type ID) y actualiza las variables; los pases ya instalados siguen
funcionando.

## 2. Configurar el deploy

En Vercel → *Settings → Environment Variables* pega el contenido de `certs/apple.env`
y revisa:

| Variable | Valor |
|----------|-------|
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_WWDR_CERT` | de `certs/apple.env` |
| `APP_URL` | la URL **HTTPS definitiva** (ver aviso abajo) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | obligatorias: los registros de iPhones se guardan ahí |
| `AUTH_SECRET`, `CLAVE_<NEGOCIO>_MANAGER`, `CLAVE_<NEGOCIO>_CAJA` | obligatorias en producción |

Ejecuta de nuevo [`supabase/schema.sql`](../supabase/schema.sql) (es idempotente: añade
las tablas `dispositivos`, `registros`, `intentos` y las columnas nuevas).

> ⚠️ **Elige el dominio antes de emitir pases reales.** Cada pase guarda su
> `webServiceURL` (= `APP_URL/api/wallet`) al emitirse. Si luego cambias de dominio,
> los pases ya instalados seguirán preguntando al dominio viejo. Apple **solo** acepta
> HTTPS con certificado válido (el de Vercel vale).

Cuando esté desplegado, el manager de cualquier negocio muestra **Estado de la
integración**: tiene que salir 🟢 en Apple Wallet, URL HTTPS, base de datos y login.

## 3. Probar en un iPhone

1. En Safari del iPhone abre `https://TU-APP/api/tap?b=nube` (o toca el tag NFC).
   → Sale la hoja **Añadir a Apple Wallet** directamente. Añade.
2. En otro móvil abre `https://TU-APP/nube/caja`, entra con el usuario `nube-caja`,
   **Escanear pase** → apunta al QR del pase → **Añadir sello**.
3. En unos segundos el iPhone recibe la notificación *"Tienes 1 de 8 sellos"* y la
   banda del pase muestra el primer café relleno.
4. En el manager: **Lanzar** una promo → llega a todos los iPhone del negocio.

## Cómo funciona por dentro

```
EMITIR   /api/tap?b=nube ──▶ crea cliente {serial, auth_token}
                         └─▶ generarPkpass() ──▶ .pkpass firmado ──▶ "Añadir a Wallet"

REGISTRO (lo hace el iPhone solo al añadir el pase)
  POST /api/wallet/v1/devices/:id/registrations/:passType/:serial   Authorization: ApplePass <auth_token>
       └─▶ guarda {dispositivo, push_token} + registro (dispositivo ↔ serial)

ACTUALIZAR (cada sello, canje, nombre, promo, cambio de config)
  saveCliente() marca `actualizado`
    └─▶ APNs: push VACÍO a cada push_token del pase (cert del Pass Type ID, topic = passTypeId)
          └─▶ el iPhone pregunta:  GET  /api/wallet/v1/devices/:id/registrations/:passType?passesUpdatedSince=<tag>
                                   GET  /api/wallet/v1/passes/:passType/:serial   (pase nuevo firmado)
                └─▶ si un campo con changeMessage cambió → notificación en pantalla de bloqueo
```

| Pieza | Fichero |
|-------|---------|
| Contenido del pase (pass.json) | [`src/lib/apple/pase.js`](../src/lib/apple/pase.js) |
| Imágenes (icono, logo, banda de sellos) | [`src/lib/apple/imagenes.js`](../src/lib/apple/imagenes.js) |
| Firma del .pkpass | [`src/lib/apple/firmar.js`](../src/lib/apple/firmar.js) |
| Web service (protocolo de Apple) | [`src/lib/apple/servicio.js`](../src/lib/apple/servicio.js) + [`src/app/api/wallet/v1`](../src/app/api/wallet/v1) |
| Avisos APNs | [`src/lib/apple/apns.js`](../src/lib/apple/apns.js) |
| Elegir proveedor / orquestar | [`src/lib/wallet.js`](../src/lib/wallet.js) |

### Qué muestra cada pase

| Negocio | Estilo Apple | Cabecera | Banda | Campos | Extra |
|---------|-------------|----------|-------|--------|-------|
| sellos (Nube, Fade) | `storeCard` | premios canjeados · nivel (Fade) | cartilla dibujada | sellos "3 de 8", premio, nombre | ubicación de la tienda |
| descuento (Forno) | `coupon` | — | porciones de pizza | descuento, estado | `voided` al usarse |

Todos: colores del tema del negocio, `sharingProhibited` (no se puede reenviar por
AirDrop/Mensajes), la promo en la CARA del pase (en el reverso no notificaría) y, en el
reverso, cómo funciona y el código del cliente.

**Ubicación:** en el manager → *Ubicación de la tienda* (o 📍 *Usar mi ubicación
actual* estando en la tienda). El pase se sugiere en la pantalla de bloqueo al llegar.

## Probar en local sin iPhone

```bash
npm run apple:prueba          # certificados FALSOS en certs/prueba.env
```

Copia esas líneas a `.env.local` y arranca `npm run dev`. La firma, la descarga del
`.pkpass` y todo el web service funcionan (puedes llamarlos con `curl`), pero un
iPhone **no** aceptará esos pases y Apple rechazará los avisos (certificado falso; el
error sale en el log y la acción sigue funcionando). Los tests
(`npm test`) cubren lo mismo automáticamente, incluida la verificación de la firma.

## Problemas típicos

| Síntoma | Causa probable |
|---------|----------------|
| Safari: "no se puede descargar el archivo" / el pase no abre | Firma inválida: variables mal pegadas, clave que no corresponde al certificado (repite `npm run apple:env`), o certificado caducado. Mira los logs de Vercel. |
| El pase se añade pero no se actualiza | `APP_URL` no es HTTPS público; el pase se emitió con otra URL; no hay Supabase (los registros no persisten); revisa que la tabla `registros` tenga filas tras añadir el pase. |
| Logs `[apns] avisos con error` | `BadCertificate`/`403`: certificado de otro Pass Type ID o caducado. `TopicDisallowed`: `APPLE_PASS_TYPE_ID` no coincide con el certificado. |
| Logs `[apple-wallet] ...` | Son errores que manda el propio iPhone (`/api/wallet/v1/log`): suelen decir exactamente qué falla. |
| Llega la actualización pero sin notificación | Solo notifican los campos con `changeMessage` que cambian de valor (sellos, estado del cupón, nivel, premios, promo). |

Depuración avanzada: con el modo desarrollador activado, *Ajustes → Desarrollador*
tiene opciones de registro de PassKit; los mensajes se ven conectando el iPhone a un
Mac con la app *Consola*.

## Antes de publicar

- Sustituye el botón "Añadir a Apple Wallet" de `/p/<serial>` por el **badge oficial**
  (Apple Wallet Identity Guidelines); el actual es un botón provisional.
- Revisa que `organizationName`, textos del reverso y colores son los definitivos.
- Renovación del certificado: pon un recordatorio con la fecha que imprimió `apple:env`.
