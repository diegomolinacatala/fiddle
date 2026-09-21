# Google Wallet

El código está hecho y probado contra una API de Google simulada. Para activarlo
solo faltan las credenciales. Sin ellas, Android usa la tarjeta web con avisos
([ANDROID.md](ANDROID.md)) y el botón de Google no sale.

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

Mientras Google no apruebe la cuenta, el emisor está en **modo demo**: solo pueden
guardar tarjetas los usuarios de prueba. En la consola → *Google Wallet API* →
*Usuarios de prueba*, añadir las cuentas de Google de los teléfonos con los que se
vaya a enseñar. Para abrirlo al público: *Solicitar acceso de publicación* en la
misma consola (Google revisa el aspecto de una tarjeta real; tarda unos días).

## Qué no está (a propósito)

- **Callbacks de guardado/borrado.** Google puede avisar cuando alguien guarda o
  borra la tarjeta, con mensajes firmados. No está montado: se apunta que el cliente
  "la tiene" cuando pide guardarla. Si luego no la guarda, se le intentará
  actualizar y Google responderá que nadie la tiene; no rompe nada.
- **Smart Tap** (leer la tarjeta por NFC en caja): requiere acuerdo con Google.
