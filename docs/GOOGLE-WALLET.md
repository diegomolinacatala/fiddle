# Google Wallet

Activo en producción (`fiddle-zeta`) desde el 23-09-2026. Sin credenciales,
Android usa la tarjeta web con avisos ([ANDROID.md](ANDROID.md)) y el botón de
Google no sale.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Emisor | Consola de Google Pay & Wallet, cuenta `BCR2DN6D5K7ON22K`, **Issuer ID `3388000000023207798`** |
| Cuenta de servicio | `fiddle-wallet@fiddle-509414.iam.gserviceaccount.com`, proyecto de Google Cloud `fiddle-509414`, con rol *Desarrollador* en la consola de Wallet |
| Clave | `certs/google-wallet.json` en local (ignorado por Git, nunca subido) y `GOOGLE_WALLET_SA_JSON` en Vercel. Si se pierde, se crea otra en Google Cloud → la cuenta de servicio → *Claves*, y se cambia en Vercel |
| Perfil de Empresa | Aprobado, como particular a nombre de Diego. Logo: [`docs/marca/`](marca/) |
| Publicación | Solicitada el 23-09-2026 (Google tarda 2-3 días hábiles). Hasta que la aprueben, solo guardan tarjetas las cuentas de prueba |

## Qué hace

| Momento | Qué pasa | Código |
|---|---|---|
| Cliente toca "Añadir a Google Wallet" | `/api/google/guardar/<serial>` crea la **clase** de la tienda (si no existe) y el **objeto** del cliente con el estado de ese momento, y le redirige a Google con un enlace corto | [`googlewallet.js`](../src/lib/googlewallet.js) → `prepararGuardado` |
| La caja sella o canjea | se reescribe el objeto; si subieron o se canjearon sellos, con `notifyPreference` → Google avisa en el teléfono | `actualizarEnGoogle` |
| El manager lanza una promo | la clase recibe un mensaje con aviso: suena en todos los teléfonos que tienen la tarjeta | `tiendaEnGoogle` |
| El manager cambia la cartilla (sellos, premio) | se reescribe la clase y los objetos (el "5/8" pasa a "5/10") | `tiendaEnGoogle` |
| Campaña del CRM | mensaje con aviso a cada cliente del grupo que tenga la tarjeta en Google | `mensajeEnGoogle` |

Qué se ve en la tarjeta de Google (todo sale de las mismas funciones que el pase
de Apple, ver [`google/pase.js`](../src/lib/google/pase.js)):

- Color de la tienda de fondo, su marca como logo redondo y su nombre.
- **Sellos 5/8** (o **Cupón: Válido / Usado**) y los premios canjeados.
- Código de 3 letras y el QR que lee la caja.
- La **banda de sellos**, la misma imagen que la de Apple (1032x336).
- "Premio: Faltan 3 · café gratis", "Cómo funciona", la promo y los mensajes.
- Un cupón usado pasa a "Pases caducados", como el pase anulado de Apple.

Límite de Google: **3 avisos por cambios de puntos y 3 por mensajes, por tarjeta y
día**. Un café diario no llega; un cliente que pasa cuatro veces en un día recibe
tres avisos (la tarjeta se actualiza igual las cuatro).

## Activarlo (una vez)

1. **Emisor**: entrar en <https://pay.google.com/business/console> con la cuenta
   de Google de la empresa → *Google Wallet API* → crear el emisor. Apuntar el
   **Issuer ID** (un número largo).
2. **Cuenta de servicio**: en <https://console.cloud.google.com> → proyecto nuevo →
   *APIs y servicios* → activar **Google Wallet API** → *Credenciales* → *Crear
   cuenta de servicio* → pestaña *Claves* → *Añadir clave* → JSON. Se descarga un
   fichero `.json`.
3. **Dar permiso**: en la consola de Google Pay & Wallet → *Usuarios* → invitar el
   email de la cuenta de servicio (`...@...iam.gserviceaccount.com`) como
   **Desarrollador**.
4. **Variables en Vercel** (Settings → Environment Variables):

   | Variable | Valor |
   |---|---|
   | `GOOGLE_WALLET_ISSUER_ID` | el Issuer ID del paso 1 |
   | `GOOGLE_WALLET_SA_JSON` | el contenido entero del `.json` del paso 2 (tal cual, o en base64) |

   También vale la forma antigua: `GOOGLE_WALLET_SA_EMAIL` + `GOOGLE_WALLET_SA_KEY`.
5. Redesplegar. En cualquier manager, *Estado de la integración* → **Android ·
   Google Wallet** tiene que salir en verde: eso significa que Google ha aceptado
   la cuenta de servicio de verdad (se pide un token).

No hace falta crear las clases a mano en la consola: se crean solas la primera vez
que un cliente guarda la tarjeta de esa tienda.

## Modo demo de Google

Mientras Google no apruebe la publicación, el emisor está en **modo demo**: solo
pueden guardar tarjetas las cuentas de prueba (consola → *API de Google Wallet* →
*Configurar cuentas de prueba*). Para salir, la consola pide tres pasos:

1. **Crear una clase.** No con el botón de la consola: la crea la app al guardar
   la primera tarjeta de una tienda (vale una tablet Android con una cuenta de
   prueba). Así Google revisa la clase que ven los clientes, no una hecha a mano.
2. **Completar el Perfil de Empresa.** Dos bloques: *Business identity* (el
   perfil de pagos: quién hay detrás, legalmente) y *Business information*
   (logo de 640-1024 px, MCC 7372, web y contacto de soporte).
3. **Solicitar acceso para publicar.** Se describe en texto qué lleva la tarjeta
   y cómo llega al cliente. Una vez aprobado, **no se vuelve al modo demo**.

## El botón «Añadir a Google Wallet»

Google revisa el botón y no deja uno propio: la tarjeta web usa los SVG de su
paquete oficial (`add-to-wallet-svg.zip`, variantes `esES`) tal cual, en
[`public/marcas/`](../public/marcas/). El normal (298x50) y, en teléfonos de
menos de 360 px, el compacto. `tests/marcas.test.js` fija su hash: si alguien los
retoca, falla. `/marcas/` queda fuera del middleware (si no, pedía login) y
`marcas` es un slug reservado.

## Qué no está (a propósito)

- **Callbacks de guardado/borrado.** Google puede avisar cuando alguien guarda o
  borra la tarjeta, con mensajes firmados. No está montado: se apunta que el cliente
  "la tiene" cuando pide guardarla. Si luego no la guarda, se le intentará
  actualizar y Google responderá que nadie la tiene; no rompe nada.
- **Smart Tap** (leer la tarjeta por NFC en caja): requiere acuerdo con Google.
