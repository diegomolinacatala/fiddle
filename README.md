# Sellos — fidelización en Apple Wallet (multi-negocio)

> 🌅 ¿Retomas el proyecto? Abre **[NEXT-STEPS.md](NEXT-STEPS.md)**.

Plataforma donde **el pase del cliente es solo un QR con su identidad**. Toda la lógica
vive en el backend. Cada negocio tiene su tarjeta (diseño propio), su **caja** (app
instalable que escanea), su **manager** y su **tag NFC**.

Con la cuenta de **Apple Developer** firmamos los pases y los **actualizamos solos**
(web service de Apple + avisos APNs): cada sello llega al iPhone con notificación.

Stack: **Next.js 15 (App Router) + Supabase + Vercel**.

> 📚 [Apple Wallet](docs/APPLE-WALLET.md) · [Deploy](docs/DEPLOY.md) ·
> [Arquitectura](docs/ARCHITECTURE.md) · [Acciones](docs/ACTIONS.md) ·
> [API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md)

## Negocios de ejemplo

Añadir uno = una entrada en [`src/lib/negocios.js`](src/lib/negocios.js).

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
   │ la caja lo escanea (/<negocio>/caja, con PIN)
   ▼
Perfil + botones ─▶ /api/accion ─▶ guarda ─▶ aviso APNs ─▶ el iPhone baja el pase nuevo
```

El pase **nunca cambia de identidad**: qué hace un escaneo lo decide el manager.

## Correr en local

```bash
npm install
npm run dev     # http://localhost:3000   (PIN demo: caja 1234 · manager 4321)
npm test
```

Sin variables = **modo demo** (datos en `.data/`, sin pases reales). Para probar la
firma de Apple sin iPhone: `npm run apple:prueba` (ver [docs/APPLE-WALLET.md](docs/APPLE-WALLET.md)).

## Estructura

```
src/app/
├─ page.js                    directorio de negocios
├─ login/                     PIN por negocio
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
├─ negocios.js   ★ presets de cada negocio
├─ acciones.js   ★ registro modular de acciones
├─ wallet.js       fachada: emitir + avisar (apple > walletwallet > demo)
├─ apple/          pase.js · imagenes.js · firmar.js · servicio.js · apns.js · config.js
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
