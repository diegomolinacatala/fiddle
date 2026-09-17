# 👋 Empieza aquí

**Estado (17-sep-2026):** rama `feat/apple-wallet`. Las dos ramas (`main` con el login
y `victor-temp` con los tres negocios) están unidas, y la app **firma y actualiza los
pases de Apple Wallet por sí misma** con la cuenta de Apple Developer. Todo probado en
local: 91 tests, build limpio, flujo completo del web service de Apple verificado con
certificados de prueba. **Falta lo que requiere tus cuentas** (Apple, Supabase, Vercel)
y probar en un iPhone real.

---

## 0. Arrancar en local (2 min)

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 91 tests
```
- `/` → directorio de negocios (Nube Café, Fade Room, Forno Nostro).
- `/nube/caja` → PIN **1234** · `/nube/manager` → PIN **4321** (solo fuera de producción).
- Sin variables = **modo demo**: datos en `.data/`, sin pases reales.

## 1. Decidir la rama con Víctor — [ ]
`fiddle-zeta.vercel.app` está desplegado desde `victor-temp`, **sin login**: cualquiera
con la URL puede sellar o lanzar promos. Esta rama lo arregla. Revisad el PR y
fusionad a `main`. Al desplegarla, configurad antes los PINs y `AUTH_SECRET` (paso 3):
en producción, sin ellos **nadie puede entrar** (falla cerrado a propósito).

## 2. Supabase — [ ]
1. Proyecto en <https://supabase.com> (o el que ya use el deploy de Víctor).
2. **SQL Editor →** pega [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Es idempotente: sobre una base existente solo añade lo nuevo.
3. **Project Settings → API:** `Project URL` → `SUPABASE_URL` · `service_role` → `SUPABASE_SERVICE_KEY`.

## 3. Apple Wallet (cuenta Apple Developer) — [ ]
Guía completa: **[docs/APPLE-WALLET.md](docs/APPLE-WALLET.md)**. Resumen:
1. `npm run apple:csr -- --email tu@correo` → clave + CSR en `certs/`.
2. developer.apple.com → Identifiers → **Pass Type ID** `pass.com.TUDOMINIO.sellos`
   → **Create Certificate** → sube el CSR → descarga → `certs/pass.cer`.
3. `npm run apple:env` → `certs/apple.env` con las variables `APPLE_*`.

## 4. Variables en Vercel — [ ]
Ver [`.env.example`](.env.example). Imprescindibles en producción:

| Variable | |
|----------|--|
| `APP_URL` | URL HTTPS **definitiva** (va dentro de cada pase) |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PIN_NUBE_CAJA`, `PIN_NUBE_MANAGER`, … (uno por negocio y rol) | 6+ cifras |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | paso 2 |
| `APPLE_*` (5) | paso 3 |

Redeploy. En `/<negocio>/manager` → **Estado de la integración** debe salir todo 🟢.

## 5. Probar en un iPhone — [ ]
1. Safari → `https://TU-APP/api/tap?b=nube` → **Añadir** a Wallet.
2. Otro móvil → `/nube/caja` → escanear el pase → **Añadir sello**.
3. Debe llegar la notificación "Tienes 1 de 8 sellos" y cambiar la banda del pase.
4. Manager → lanzar promo → llega a todos.

## 6. Tag NFC y app de caja — [ ]
- Manager → *Tag NFC / emitir* → **Copiar URL** → NFC Tools → Write → URL → acercar sticker.
- En el móvil de la tienda: abrir `/nube/caja` → Compartir → *Añadir a pantalla de inicio*.

---

## ✅ Qué YA funciona
- **Tres negocios** con su tarjeta, caja, manager, tag NFC e icono (`src/lib/negocios.js`).
- **Login por negocio**: PIN de caja y de manager por negocio, sesión firmada (HMAC),
  aislamiento entre negocios, **límite de intentos** (10 fallos/IP/15 min) y fallo
  cerrado en producción sin secretos.
- **Apple Wallet propio**: `.pkpass` firmado con colores del negocio, icono, logo y
  **banda con la cartilla dibujada**; cupón que queda *anulado* al usarse; nombre del
  cliente; promo en el reverso; ubicación de la tienda (aviso en pantalla de bloqueo);
  no se puede reenviar.
- **Actualizaciones automáticas**: web service de Apple completo + avisos APNs. Cada
  sello, canje, nombre, promo o cambio de config actualiza los iPhone.
- En iPhone el tag entrega el pase **directo** (sin página intermedia).
- Página del pase `/p/<serial>` con botón *Añadir a Apple Wallet* (y Google si hay credenciales).
- QR generado en local (antes se mandaba el serial a `api.qrserver.com`).
- Plan B WalletWallet y esqueleto de Google Wallet conservados.
- Script para certificados desde Windows, 91 tests (86 % de cobertura en `src/lib`).

## ⚠️ Pendiente / límites
- **Probar en un iPhone real** con el certificado de verdad (pasos 3–5).
- **Badge oficial** "Add to Apple Wallet" en `/p/<serial>` (ahora es un botón provisional).
- **Google Wallet**: el enlace de guardado existe, pero las actualizaciones en Android
  (REST API) no. Requiere cuenta de Google Pay & Wallet Console.
- **Anti-fraude del QR**: el QR es estático (una captura sirve para enseñarlo). Mitigado:
  hace falta sesión de caja para actuar y el pase no se puede reenviar. Siguiente nivel:
  código rotativo o NFC (requiere aprobación aparte de Apple).
- **Negocios en código**: añadir uno = entrada en `src/lib/negocios.js` + redeploy
  (no hay alta desde una UI todavía).
- **Tests E2E** (Playwright) de los flujos de caja/manager: no hay.
