# Sellos — fidelización en Wallet (pass = QR, backend = cerebro)

> 🌅 **¿Retomas el proyecto? Abre [NEXT-STEPS.md](NEXT-STEPS.md)** — checklist paso a paso.

Plataforma de tarjetas de fidelización donde **el pase del cliente es solo un QR
con su identidad**. Toda la lógica —qué significa un escaneo, cuántos sellos, qué
premio, qué promo— vive en el backend y se cambia sin reeditar ningún pase.

**Dos apps separadas** (instalables en el móvil como PWA):

- 📱 **Caja / trabajador** (`/worker`) — vive en la pantalla de inicio del móvil.
  **Escanea el QR del pase con la cámara**, ve el perfil del cliente y ejecuta
  acciones (sellar, canjear…).
- 🖥️ **Manager** (`/manager`) — uso ocasional. Elige la funcionalidad (meta de
  sellos, premio, qué acciones hay), lanza promos por push, emite pases.

Stack: **Next.js (App Router) + Supabase + Vercel**. Firma del pase y push
delegados en [WalletWallet](https://www.walletwallet.dev) (sin cuenta de Apple
Developer).

> 📚 Docs: [Arranque](NEXT-STEPS.md) · [Deploy](docs/DEPLOY.md) ·
> [Arquitectura](docs/ARCHITECTURE.md) · [Acciones (modularidad)](docs/ACTIONS.md) ·
> [API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md)

---

## La idea en una frase

El pase es una **tarjeta de identidad tonta**: su QR solo dice "este soy yo". La
caja lo escanea, el backend decide qué hacer **ahora** con esa persona, y empuja
el cambio al Wallet. Cambiar qué hace un escaneo = cambiar config en el manager.
El pase y el QR nunca cambian.

```
Tag NFC del mostrador ──▶ /api/tap ──▶ pase nuevo en el móvil      (EMITIR)

Pase del cliente (QR = /w/<serial>)
   │ la caja lo escanea con la cámara (app /worker)
   ▼
Perfil del cliente + botones ──▶ /api/accion ──▶ backend actualiza ──▶ push al pase
```

---

## 🟢 Correr en local (sin cuentas)

```bash
npm install
npm run dev
```
- **/manager** — configura, emite un pase, lanza una promo.
- **/worker** — app de caja: escáner QR + lista de clientes.
- **/w/&lt;serial&gt;** — perfil del cliente con botones (lo abre el QR del pase).
- **/p/&lt;serial&gt;** — el pase del cliente (su QR).

Sin credenciales = **modo demo**: firma/push simulados, estado en `.data/`.

## 🔵 Pases reales + deploy

Todo en [NEXT-STEPS.md](NEXT-STEPS.md) y [docs/DEPLOY.md](docs/DEPLOY.md). Resumen:
Supabase (`supabase/schema.sql`) + key WalletWallet + `.env.local` + Vercel + tag NFC.
Con `APP_MODE=worker|manager` puedes desplegar las dos apps en **dominios separados
desde este mismo repo**.

---

## Estructura

```
src/app/
├─ page.js                    Hub (redirige según APP_MODE)
├─ (worker)/                  ── APP DE CAJA (PWA) ──
│  ├─ layout.js               manifest + instalable
│  ├─ worker/page.js          home: escáner QR + lista
│  ├─ worker/QrScanner.js     cámara + jsQR
│  └─ w/[serial]/             perfil del cliente + acciones
├─ (manager)/                 ── APP DE MANAGER (PWA) ──
│  ├─ layout.js
│  └─ manager/page.js         config + promo + emitir + NFC
├─ p/[serial]/                pase del cliente (solo lectura + su QR)
└─ api/                       tap · crear · accion · programa · promo · clientes · cliente/[serial]

src/lib/
├─ acciones.js                ★ registro MODULAR de acciones (añade funcionalidad aquí)
├─ store.js                   Supabase real o ficheros locales (demo)
├─ walletwallet.js            buildPassBody() + createPass()/updatePass() (real o demo)
├─ emitir.js · config.js · appmode.js

public/
├─ manifest.worker.webmanifest · manifest.manager.webmanifest · sw.js · icons/
```

## Límites conocidos
- Push no instantáneo garantizado (Apple entrega cuando hay conexión).
- `/w/<serial>` es público: en producción necesita login de caja (ver ARCHITECTURE).
- El escáner necesita HTTPS o localhost (contexto seguro para la cámara).
- Sin email = sin recuperación si el cliente borra el pase.
- "Confirmar pago" registra la transacción en NUESTRO sistema; no mueve dinero.
