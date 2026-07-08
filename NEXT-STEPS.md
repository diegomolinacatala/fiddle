# 👋 Empieza aquí (para retomar mañana)

Estado: **la demo funciona entera en local, sin cuentas** (modo demo). Para pasar
a pases reales en un iPhone, sigue estos pasos en orden. Marca según avances.

---

## 0. Arrancar en local (2 min) — ya funciona

```bash
npm install
npm run dev
```
- `http://localhost:3000/manager` → pide PIN. Demo: **manager = 4321**.
- `http://localhost:3000/worker` → pide PIN. Demo: **worker = 1234**.
- Todo se guarda en `.data/` (ficheros locales). Sin credenciales, es modo demo.

> **Login:** ya hay autenticación por PIN (caja vs manager). Cambia los PINs y el
> `AUTH_SECRET` en `.env.local` para producción (ver paso 3).

---

## 1. Supabase (base de datos) — [ ]
1. Crea un proyecto gratis en <https://supabase.com>.
2. **SQL Editor → New query →** pega [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Project Settings → API →** copia:
   - `Project URL`  → `SUPABASE_URL`
   - key **`service_role`** (¡no la anon!) → `SUPABASE_SERVICE_KEY`

## 2. WalletWallet (firma del pase + push) — [ ]
1. Crea cuenta en <https://www.walletwallet.dev> y saca tu API key `ww_live_...`.
2. **Confirma en sus docs/soporte** (crítico) — ver [docs/DEPLOY.md](docs/DEPLOY.md#walletwallet):
   - que el `PUT` dispara el push automáticamente,
   - que sus pases incluyen `webServiceURL` + `authenticationToken` por defecto,
   - que el tramo gratis cubre crear **y** actualizar.

## 3. Variables de entorno — [ ]
```bash
cp .env.example .env.local
```
Rellena `WALLETWALLET_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `APP_URL`.
En cuanto existan, el modo demo se apaga solo.

**Seguridad del login (importante):** pon un `AUTH_SECRET` largo y aleatorio y
cambia `WORKER_PIN` / `MANAGER_PIN`. Con el secreto de demo los tokens de sesión
serían falsificables.

**Google Wallet (Android, opcional):** rellena `GOOGLE_WALLET_ISSUER_ID`,
`GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_KEY` para activar el botón "Guardar
en Google Wallet". Sin ellas solo se ofrece Apple (sin romper nada).

## 4. Deploy en Vercel — [ ]
1. Sube el repo a GitHub, impórtalo en Vercel.
2. Pega las mismas variables en **Settings → Environment Variables**.
3. `APP_URL` = la URL que te da Vercel (ej. `https://tu-tienda.vercel.app`).
4. (Opcional) Dos webs separadas: ver [docs/DEPLOY.md](docs/DEPLOY.md#dos-webs).

## 5. Tag NFC — [ ]
1. Instala **NFC Tools** (iOS/Android).
2. En `/manager` → sección "Emitir pase · tag NFC" → **Copiar URL del tag**.
3. En NFC Tools: **Write → Add a record → URL/URI →** pega la URL → **Write** → acerca el sticker.
4. Toca el sticker con un móvil → debe crear un pase y salir "Añadir a Wallet".

## 6. Instalar la app de caja en el móvil — [ ]
1. Abre `https://tu-tienda.vercel.app/worker` en el móvil.
2. **iPhone:** Compartir → "Añadir a pantalla de inicio". **Android:** menú → "Instalar app".
3. Ábrela → **Escanear pase** → apunta al QR del pase de un cliente → se abre su perfil.

---

## ✅ Qué YA funciona
- **Login por PIN** — caja (worker) y manager, con sesión firmada (HMAC). El gate
  vive en [`src/middleware.js`](src/middleware.js).
- **Personalización por cliente** — nombre editable en caja que aparece en la cara
  del pase (`/w/<serial>` → guardar nombre → push).
- App de caja (móvil) con **escáner QR por cámara** + entrada manual + lista.
- App de manager (PC) para configurar funcionalidad y lanzar promos.
- Acciones modulares (sellar, quitar, canjear, confirmar) — añadir más es 1 función.
- Emisión de pases vía `/api/tap` (lo que abre el NFC).
- **Esqueleto de Google Wallet** — enlace "Guardar en Google Wallet" firmado
  (RS256) cuando hay credenciales; no-op en demo.
- Instalable en pantalla de inicio (PWA) las dos apps.
- Todo el flujo probado en modo demo (build limpio + flujos de auth verificados).

## ⚠️ Qué NO funciona todavía / pendiente
- **Push real** — sin la API key de WalletWallet, el "push al Wallet" es un no-op
  simulado. Se activa en el paso 2.
- **Persistencia en producción** — en Vercel los ficheros `.data/` NO persisten.
  Necesitas Supabase (paso 1) sí o sí para producción.
- **Cámara** — el escáner necesita HTTPS o localhost. En Vercel (HTTPS) va; abrir
  la web por IP `http://` en el móvil NO dará cámara.
- **Google Wallet — actualizaciones** — el esqueleto genera el enlace de guardado,
  pero refrescar los sellos en Android requiere la Google Wallet REST API sobre el
  objeto guardado (pendiente). Apple ya actualiza vía `updatePass`.
- **Anti-fraude del QR** — el QR es estático; con login ya no se puede *actuar* sin
  sesión de caja, pero falta el token rotativo para cerrarlo del todo.
- **Multi-tenant** — hoy `programa` es singleton (una cafetería). Para vender a N
  clientes hace falta un `tenant_id` en `programa`/`clientes`.
