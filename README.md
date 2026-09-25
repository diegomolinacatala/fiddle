# Sellos — tarjetas de fidelización para iPhone y Android (multi-negocio)

> ¿Retomas el proyecto? Abre **[NEXT-STEPS.md](NEXT-STEPS.md)**.

Plataforma donde **el pase del cliente es solo un QR con su identidad**. Toda la lógica
vive en el backend. Cada negocio tiene su tarjeta (diseño propio), su **caja** (app
instalable que escanea), su **manager** y su **tag NFC**.

Con la cuenta de **Apple Developer** firmamos los pases y los **actualizamos solos**
(web service de Apple + avisos APNs): cada sello llega al iPhone con notificación.

En **Android** la tarjeta vive en el navegador con la misma cara que el pase de
Apple: se instala en la pantalla de inicio, se actualiza sola y avisa de cada sello
con notificaciones del navegador. Con credenciales de Google, además se guarda en
**Google Wallet** y se actualiza igual. Todo en [docs/ANDROID.md](docs/ANDROID.md).

Stack: **Next.js 15 (App Router) + Supabase + Vercel**.

En producción: **<https://fiddle-zeta.vercel.app>** (se despliega solo al fusionar en `main`).

> [Roadmap hasta el MVP](docs/ROADMAP.md) · [Android](docs/ANDROID.md) ·
> [Google Wallet](docs/GOOGLE-WALLET.md) ·
> [Apple Wallet](docs/APPLE-WALLET.md) · [Deploy](docs/DEPLOY.md) ·
> [Arquitectura](docs/ARCHITECTURE.md) · [Acciones](docs/ACTIONS.md) ·
> [API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md) · [Avisos automáticos](docs/AVISOS.md)

## Admin de la plataforma

`victor` y `diego` entran en **`/admin`**: la lista de todas las tiendas, con botón
para **crear** una nueva (cuatro datos + un *brief* en texto libre para Claude),
**editar**la, **archivar**la y, desde la pestaña de archivadas, **borrarla del todo**
escribiendo su identificador.

Dentro de cada tienda hay un **modo comentarios**: se toca cualquier campo del pase
(en Apple o en Google) y se escribe *"esto debería ser X"*. Las notas se guardan con
la tienda, así Claude ve de golpe qué hay que cambiar y dónde.

Las tiendas **viven en la base de datos**: [`negocios.js`](src/lib/negocios.js) ya solo
trae la *semilla* de La Delicantería y las plantillas de estilo.

## La tienda

| Negocio | Tipo | URLs |
|---------|------|------|
| **La Delicantería** (`delicanteria`) | dos cartillas: cookies y cafés | `/delicanteria` · `/delicanteria/caja` · `/delicanteria/manager` · `/api/tap?b=delicanteria` |

El dueño tiene tres pestañas, una por pregunta, y cada cosa en **un solo sitio**:
**Tienda** (tarjeta, caja, horario, QR), **Clientes** (quién viene; la exportación va
junto a la lista) y **Avisos** (la promo, mensajes a un grupo y los
[avisos automáticos](docs/AVISOS.md), que trabajan solos).

## Cómo funciona

```
Tag NFC / QR ─▶ /api/tap?b=<negocio> ─▶ /<negocio>: su nombre ─▶ botón de SU Wallet
                  iPhone: .pkpass firmado ─▶ "Añadir a Wallet"
                  Android: Google Wallet, o /p/<serial> ─▶ avisos · instalar
           (si ese teléfono ya tenía tarjeta, va directo a la suya)

Tarjeta (QR = /w/<serial>)
   │ la caja la escanea (/<negocio>/caja, con login)
   ▼
Perfil + botones ─▶ /api/accion ─▶ guarda ─▶ APNs ─▶ el iPhone baja el pase nuevo
                                          ├▶ web push ─▶ "Sello 5 de 8" en el Android
                                          └▶ Google Wallet ─▶ su tarjeta se actualiza
```

El pase **nunca cambia de identidad**: qué hace un escaneo lo decide el manager.

## Correr en local

```bash
npm install
npm run dev     # http://localhost:3000
npm test
```

Sin variables = **modo demo** (datos en `.data/`, sin pases reales). Para probar la
firma de Apple sin iPhone: `npm run apple:prueba` (ver [docs/APPLE-WALLET.md](docs/APPLE-WALLET.md)).

La app abre directamente en `/login`: usuario **`delicanteria`** (manager) o
**`delicanteria-caja`** (caja), contraseña igual que el usuario. En local siempre
valen y se listan en la propia pantalla de login para tocarlos y entrar.

Cada pase tiene, además de su serial, un **código de 3 caracteres** (`K7M`) que sale
debajo del QR: identifica al cliente **dentro de su tienda** (dos negocios pueden
tener el mismo código y son clientes distintos). La caja lo acepta a mano cuando el
QR no se deja leer.

Cómo ponerse a trabajar desde otro ordenador, qué tocar para cada cosa y qué queda
pendiente: **[NEXT-STEPS.md](NEXT-STEPS.md)**.

## Estructura

```
src/app/
├─ page.js                    redirige al login (o a tu sitio si ya hay sesión)
├─ admin/                     plataforma: lista de tiendas · [slug]/ editar + comentar
├─ login/                     PRIMERA PANTALLA: usuario + contraseña
├─ ui.js                      colores y estilos compartidos (tema claro)
├─ admin/Selector.js · vistas.js   selector de piezas con miniaturas dibujadas
├─ PaseVista.js               vista previa del pase: Apple / Google
├─ [negocio]/                 landing · caja/ (PWA + escáner) · manager/ (+ estado de integración)
├─ w/[serial]/                perfil del cliente + acciones + nombre (caja)
├─ p/[serial]/                la tarjeta del cliente: Apple Wallet en iPhone; en Android,
│                             instalable, en vivo, con avisos y Google Wallet
└─ api/
   ├─ tap · crear · pase/[serial]          emitir / descargar pase
   ├─ accion · cliente/[serial] · clientes caja
   ├─ negocio · promo · estado             manager
   ├─ login · logout · manifest · negocios
   ├─ tarjeta · push · google/guardar · imagen   Android (tarjeta web, avisos, Google)
   └─ wallet/v1/...                        web service de Apple Wallet
src/lib/
├─ negocios.js   ★ semillas y plantillas (las tiendas viven en la base)
├─ codigo.js       clave corta de 3 caracteres del pase (única por negocio)
├─ resumen.js      "cuántos sellos lleva": lo comparten Google Wallet y la vista previa
├─ acciones.js   ★ registro modular de acciones
├─ wallet.js       fachada: emitir + avisar por todos los canales (iPhone, Android, Google)
├─ avisos.js       qué texto suena en Android tras cada cambio
├─ apple/          pase.js · dibujo.js · glifos.js · imagenes.js · firmar.js · servicio.js · apns.js · config.js
├─ google/         config.js · pase.js (clase y objeto) · api.js (REST de Google)
├─ push/           vapid.js · suscripcion.js · enviar.js   avisos del navegador
├─ auth.js · acceso.js · limitador.js · http.js   login y permisos
├─ store.js        Supabase o ficheros locales
└─ walletwallet.js · googlewallet.js · validacion.js · url.js · tarjeta.js · recordar.js
scripts/apple-setup.mjs   CSR + certificado de Apple -> variables (sin Mac)
supabase/schema.sql       esquema idempotente
tests/                    vitest
```

## Límites conocidos
- Apple entrega los avisos cuando el iPhone tiene conexión (normalmente segundos).
- iOS no permite instalar un pase en silencio: el cliente toca "Añadir".
- El escáner de la caja necesita HTTPS (o localhost) para la cámara.
- El QR es estático: una captura se puede enseñar, pero no se puede actuar sin sesión de caja.
- En Android, los avisos del navegador solo llegan si el cliente los activa en su tarjeta
  (un toque). Google Wallet los manda solo, pero limita a 3 por tarjeta y día.
