# Sellos — fidelización en Apple Wallet (multi-negocio)

> 🌅 ¿Retomas el proyecto? Abre **[NEXT-STEPS.md](NEXT-STEPS.md)**.

Plataforma donde **el pase del cliente es solo un QR con su identidad**. Toda la lógica
vive en el backend. Cada negocio tiene su tarjeta (diseño propio), su **caja** (app
instalable que escanea), su **manager** y su **tag NFC**.

Con la cuenta de **Apple Developer** firmamos los pases y los **actualizamos solos**
(web service de Apple + avisos APNs): cada sello llega al iPhone con notificación.

Stack: **Next.js 15 (App Router) + Supabase + Vercel**.

En producción: **<https://fiddle-zeta.vercel.app>** (se despliega solo al fusionar en `main`).

> 📚 [Apple Wallet](docs/APPLE-WALLET.md) · [Deploy](docs/DEPLOY.md) ·
> [Arquitectura](docs/ARCHITECTURE.md) · [Acciones](docs/ACTIONS.md) ·
> [API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md)

## Admin de la plataforma

`victor` y `diego` entran en **`/admin`**: la lista de todas las tiendas, con botón
para **crear** una nueva (cuatro datos + un *brief* en texto libre para Claude),
**editar**la, **archivar**la y, desde la pestaña de archivadas, **borrarla del todo**
escribiendo su identificador.

Dentro de cada tienda hay un **modo comentarios**: se toca cualquier campo del pase
(en Apple o en Google) y se escribe *"esto debería ser X"*. Las notas se guardan con
la tienda, así Claude ve de golpe qué hay que cambiar y dónde.

Las tiendas **viven en la base de datos**: [`negocios.js`](src/lib/negocios.js) ya solo
trae las *semillas* (los tres de ejemplo) y las plantillas de estilo.

## Negocios de ejemplo

| Negocio | Tipo | URLs |
|---------|------|------|
| ☕ **Nube Café** (`nube`) | cartilla de sellos | `/nube` · `/nube/caja` · `/nube/manager` · `/api/tap?b=nube` |
| 💈 **Fade Room** (`fade`) | sellos + niveles | `/fade` · `/fade/caja` · `/fade/manager` · `/api/tap?b=fade` |
| 🍕 **Forno Nostro** (`forno`) | cupón de un uso | `/forno` · `/forno/caja` · `/forno/manager` · `/api/tap?b=forno` |

## Cómo funciona

```
Tag NFC ─▶ /api/tap?b=<negocio> ─▶ iPhone: .pkpass firmado directo ─▶ "Añadir a Wallet"
                                    Android/otros: /p/<serial>

Pase (QR = /w/<serial>)
   │ la caja lo escanea (/<negocio>/caja, con login)
   ▼
Perfil + botones ─▶ /api/accion ─▶ guarda ─▶ aviso APNs ─▶ el iPhone baja el pase nuevo
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

La app abre directamente en `/login`: usuario **`nube`** (manager) o **`nube-caja`**
(caja), contraseña igual que el usuario; lo mismo con `fade` y `forno`. En local
siempre valen y se listan en la propia pantalla de login para tocarlos y entrar.

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
├─ p/[serial]/                página pública del pase + "Añadir a Apple Wallet"
└─ api/
   ├─ tap · crear · pase/[serial]          emitir / descargar pase
   ├─ accion · cliente/[serial] · clientes caja
   ├─ negocio · promo · estado             manager
   ├─ login · logout · manifest · negocios
   └─ wallet/v1/...                        web service de Apple Wallet
src/lib/
├─ negocios.js   ★ semillas y plantillas (las tiendas viven en la base)
├─ codigo.js       clave corta de 3 caracteres del pase (única por negocio)
├─ resumen.js      "cuántos sellos lleva": lo comparten Google Wallet y la vista previa
├─ acciones.js   ★ registro modular de acciones
├─ wallet.js       fachada: emitir + avisar (apple > walletwallet > demo)
├─ apple/          pase.js · dibujo.js · glifos.js · imagenes.js · firmar.js · servicio.js · apns.js · config.js
├─ auth.js · acceso.js · limitador.js · http.js   login y permisos
├─ store.js        Supabase o ficheros locales
└─ walletwallet.js · googlewallet.js · validacion.js · url.js
scripts/apple-setup.mjs   CSR + certificado de Apple -> variables (sin Mac)
supabase/schema.sql       esquema idempotente
tests/                    vitest
```

## Límites conocidos
- Apple entrega los avisos cuando el iPhone tiene conexión (normalmente segundos).
- iOS no permite instalar un pase en silencio: el cliente toca "Añadir".
- El escáner de la caja necesita HTTPS (o localhost) para la cámara.
- El QR es estático: una captura se puede enseñar, pero no se puede actuar sin sesión de caja.
