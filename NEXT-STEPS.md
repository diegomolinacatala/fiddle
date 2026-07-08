# 👋 Empieza aquí (para retomar mañana)

Estado: **la demo funciona entera en local, sin cuentas** (modo demo). Para pasar
a pases reales en un iPhone, sigue estos pasos en orden. Marca según avances.

---

## 0. Arrancar en local (2 min) — ya funciona

```bash
npm install
npm run dev
```
- `http://localhost:3000/manager` → configura el programa, emite un pase de prueba.
- `http://localhost:3000/worker` → app de caja (escáner QR + lista de clientes).
- Todo se guarda en `.data/` (ficheros locales). Sin credenciales, es modo demo.

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
- App de caja (móvil) con **escáner QR por cámara** + entrada manual + lista.
- App de manager (PC) para configurar funcionalidad y lanzar promos.
- Acciones modulares (sellar, quitar, canjear, confirmar) — añadir más es 1 función.
- Emisión de pases vía `/api/tap` (lo que abre el NFC).
- Instalable en pantalla de inicio (PWA) las dos apps.
- Todo el flujo probado en modo demo.

## ⚠️ Qué NO funciona todavía / pendiente
- **Push real** — sin la API key de WalletWallet, el "push al Wallet" es un no-op
  simulado. Se activa en el paso 2.
- **Persistencia en producción** — en Vercel los ficheros `.data/` NO persisten.
  Necesitas Supabase (paso 1) sí o sí para producción.
- **Cámara** — el escáner necesita HTTPS o localhost. En Vercel (HTTPS) va; abrir
  la web por IP `http://` en el móvil NO dará cámara.
- **Sin login del trabajador** — `/w/<serial>` es público. Antes de uso real hay
  que poner autenticación de caja delante (ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#seguridad)).
- **Anti-fraude del QR** — el QR es estático; mitigación pendiente (token rotativo).
