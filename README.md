# Sellos — plataforma de fidelización en Wallet (multi-negocio)

> 🌅 ¿Retomas el proyecto? Mira [NEXT-STEPS.md](NEXT-STEPS.md).

Plataforma donde **el pase del cliente es solo un QR con su identidad**. Toda la
lógica vive en el backend. Es **multi-negocio**: cada negocio tiene su propia
tarjeta (diseño), su caja (app instalable), su manager y su tag NFC.

En vivo: **https://fiddle-zeta.vercel.app**

## Negocios de ejemplo (modular: añadir uno = una entrada en [`src/lib/negocios.js`](src/lib/negocios.js))

| Negocio | Tipo | Tarjeta | URLs |
|---------|------|---------|------|
| ☕ **Nube Café** (`nube`) | cartilla de sellos | colorida | `/nube` · `/nube/caja` · `/nube/manager` · `/api/tap?b=nube` |
| 💈 **Fade Room** (`fade`) | sellos + niveles | sleek, animada | `/fade` · `/fade/caja` · `/fade/manager` · `/api/tap?b=fade` |
| 🍕 **Forno Nostro** (`forno`) | cupón descuento | cupón pizza | `/forno` · `/forno/caja` · `/forno/manager` · `/api/tap?b=forno` |

## Cómo funciona

```
Tag NFC del negocio ─▶ /api/tap?b=<slug> ─▶ pase en el móvil   (iOS: .pkpass directo, menos fricción)

Pase del cliente (QR = /w/<serial>)
   │ la caja del negocio lo escanea con la cámara (/<slug>/caja)
   ▼
Perfil del cliente + botones ─▶ /api/accion ─▶ backend ─▶ push al Wallet (live)
```

- **Menos fricción:** en iOS, `/api/tap` devuelve el `.pkpass` firmado directamente
  → la hoja "Añadir a Wallet" sale al instante (sin página intermedia). Apple sigue
  exigiendo el toque final "Añadir" (no se puede instalar en silencio).
- **Identidad:** usamos nuestro propio `serial` (uuid). El barcode ya va correcto en
  el primer POST, y guardamos el `ww_serial` de WalletWallet para los push.

## Estructura

```
src/app/
├─ page.js                    Directorio de negocios
├─ [negocio]/                 landing · caja/ (PWA + escáner) · manager/
├─ w/[serial]/                Perfil del cliente + acciones (lo abre el QR)
├─ p/[serial]/                Pase del cliente (ThemedPass: 3 diseños)
└─ api/  tap · crear · accion · negocio · negocios · clientes · promo · manifest
src/lib/
├─ negocios.js   ★ presets de cada negocio (diseño + defaults)
├─ acciones.js   ★ registro modular de acciones
├─ store.js · walletwallet.js · emitir.js
```

## Puesta en marcha / deploy
Ver [NEXT-STEPS.md](NEXT-STEPS.md) y [docs/DEPLOY.md](docs/DEPLOY.md). Requiere Supabase
(ejecutar [`supabase/schema.sql`](supabase/schema.sql)), key de WalletWallet, y Vercel.
Con `APP_MODE`/dominios se pueden separar cajas y managers.

## Límites conocidos
- El push no es instantáneo garantizado (Apple entrega cuando hay conexión).
- iOS no permite instalar un pase en silencio (toque "Añadir" obligatorio).
- `/w/<serial>` es público: en producción necesita login de caja.
- El escáner necesita HTTPS o localhost.
