# Android

En iPhone la tarjeta vive en Apple Wallet. En Android hay dos caminos, y los dos
funcionan a la vez:

| | Tarjeta web | Google Wallet |
|---|---|---|
| Qué es | `/p/<serial>`: la tarjeta en el navegador, instalable como app | El pase dentro de la app Google Wallet |
| Hace falta | nada: funciona con lo que ya hay en Vercel | cuenta de emisor en Google Pay & Wallet Console ([guía](GOOGLE-WALLET.md)) |
| Se actualiza sola | sí, mientras está abierta (y al volver a abrirla) | sí, Google la empuja al teléfono |
| Avisos con el móvil bloqueado | sí, avisos del navegador (si el cliente los activa) | sí, los de Google (máx. 3 por tarjeta y día) |
| Botón en la tarjeta | siempre | solo si hay credenciales de Google |

## Lo que ve el cliente

1. Toca el tag NFC (o escanea el QR del mostrador) → `/api/tap?b=<tienda>` → la página
   de la tienda, que **le pide el nombre**. Al darlo se crea la tarjeta.
2. En Android, **si Google Wallet está activo, el botón es "Añadir a Google Wallet"**
   (y debajo, "Abrir en el navegador"). Si no está configurado, "Abrir mi tarjeta"
   le lleva a **su tarjeta** (`/p/<serial>`). Se dibuja con las mismas
   funciones que el pase de Apple (`camposDelPase`, `stripDelPase`, `svgLogo`):
   misma banda de sellos, mismos textos, mismo QR y código de 3 letras.
3. Debajo, según lo que permita su teléfono:
   - **Añadir a Google Wallet** (si está configurado).
   - **Avisos de tus sellos** → Activar. El navegador pide permiso y le llega un
     primer aviso de prueba ("Avisos activados…").
   - **Instalar** → la tarjeta se queda en la pantalla de inicio como una app, con
     el icono de la tienda. Si Chrome no ofrece el botón, sale la instrucción del menú.
4. Mientras la tiene abierta en caja, la tarjeta **se pone al día sola** (cada 3 s
   los primeros minutos, luego cada 10 s, nada si está en segundo plano). Cuando la
   caja sella, el teléfono vibra, la banda se anima y sale "Sello añadido".
5. **Si vuelve a tocar el tag**, se le abre SU tarjeta, sin volver a pedirle el nombre:
   el alta deja una cookie por tienda (`tarjeta_<slug>`, 1 año). En iPhone pasa lo
   mismo: se le vuelve a dar su pase y iOS lo reconoce por el serial. `?nuevo=1` pide
   otra (para probar desde el mostrador).

## Avisos del navegador (web push)

- **Cuándo suenan**: un sello, la cartilla completa, un canje, una promo nueva del
  manager y las campañas del CRM. No suenan: correcciones de la caja, cambios de
  nombre, guardar la cartilla o retirar una promo. Los textos están en
  [`src/lib/avisos.js`](../src/lib/avisos.js).
- **Claves VAPID**: si no hay `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`, se derivan
  de `AUTH_SECRET` ([`push/vapid.js`](../src/lib/push/vapid.js)). Por eso funciona
  en cuanto se despliega. Si algún día se cambia `AUTH_SECRET`, las suscripciones
  viejas dejan de valer y la tarjeta se vuelve a suscribir sola la próxima vez que
  el cliente la abra. Para no depender de eso, fijar las dos variables
  (`npx web-push generate-vapid-keys`).
- **Dónde se guardan**: en las mismas tablas que los iPhone. `dispositivos.id` =
  `web-<hash del endpoint>`, `push_token` = la suscripción en JSON, y el registro
  con `pass_type = "web"`. Sin migraciones.
- **Seguridad**: el servidor hace un POST al endpoint que manda el navegador, así
  que solo se aceptan los servicios de push reales (FCM, Mozilla, Apple, Windows)
  por https y sin puertos raros ([`push/suscripcion.js`](../src/lib/push/suscripcion.js)).
  Máximo 5 navegadores por tarjeta y 20 altas por IP cada 10 minutos.
- **CRM**: activar los avisos cuenta como "tiene la tarjeta en el teléfono"
  (`instalado`), igual que añadir el pase en un iPhone. Así las campañas llegan
  también a Android.
- **Probado de verdad**: Chrome real → suscripción en FCM → aviso de bienvenida →
  sello desde la caja → FCM acepta el aviso.

## Caja en Android

- **Escáner**: usa el lector de códigos de Chrome (`BarcodeDetector`), más rápido y
  con peor luz que jsQR. Donde no existe (iPhone, Firefox) se carga jsQR solo entonces.
- **Linterna** si la cámara la tiene, **vibración** al leer y al sellar.
- Un QR que no es de una tarjeta (el de la carta, el del wifi) se ignora con aviso.
- **Escanear al siguiente**: tras atender a un cliente, abre la cámara directamente.
- **Instalar la caja en este móvil**: botón en la propia caja cuando Chrome lo permite.

## Manager en Android

- **Grabar un tag con este móvil**: Chrome en Android escribe tags NFC (Web NFC).
  Se toca el botón, se acerca el tag y listo, sin la app NFC Tools. En iPhone y en
  ordenador no sale (queda copiar la URL).

## Iconos

`/api/imagen/<tipo>` dibuja con la marca de la tienda: icono normal y adaptable
(maskable) para la app instalada, insignia blanca para la barra de avisos, logo
redondo para Google Wallet y la banda de sellos en formato ancho. Llevan una
huella del diseño en la URL (`v=`): si la tienda cambia de marca o color, las URLs
cambian y Google y los teléfonos las piden de nuevo.
