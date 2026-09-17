# Deploy

## Variables de entorno

Plantilla completa: [`.env.example`](../.env.example).

| Variable | Para qué | En producción |
|----------|----------|---------------|
| `APP_URL` | URL pública HTTPS. Va dentro de cada pase (QR y `webServiceURL`) | **obligatoria** |
| `AUTH_SECRET` | firma de las sesiones | **obligatoria** (sin ella nadie entra) |
| `PIN_<SLUG>_CAJA`, `PIN_<SLUG>_MANAGER` | PIN por negocio y rol (`PIN_NUBE_CAJA`…) | **obligatorias** (sin ellas ese rol no entra) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | base de datos (service_role, solo backend) | **obligatorias** |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_WWDR_CERT` | firma y avisos de Apple Wallet ([guía](APPLE-WALLET.md)) | para pases reales |
| `APPLE_PASS_KEY_PASSPHRASE` | si la clave está cifrada | opcional |
| `WALLETWALLET_API_KEY` | plan B sin Apple Developer (solo si no hay `APPLE_*`) | opcional |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_KEY` | botón "Guardar en Google Wallet" | opcional |

Cada integración se detecta por separado; lo que falte cae a modo demo. El manager
de cada negocio muestra **Estado de la integración** con lo que está activo.

Fuera de producción (`next dev`) hay PINs y secreto de demo. **En producción no**:
es a propósito, para que un deploy mal configurado no quede abierto.

## Vercel

1. Repo en GitHub → **Import** en Vercel (detecta Next.js).
2. **Settings → Environment Variables**: las de arriba.
3. `APP_URL` = dominio definitivo. Si vas a usar dominio propio, configúralo **antes**
   de emitir pases reales: los pases guardan la URL con la que se emitieron.
4. Deploy. Comprueba `/<negocio>/manager` → Estado de la integración.

`sharp` (imágenes del pase) y `passkit-generator` (firma) corren en las funciones
Node de Vercel sin configuración extra (`next.config.mjs` los marca como externos).

## Supabase

SQL Editor → [`supabase/schema.sql`](../supabase/schema.sql) → Run. Es idempotente:
sobre la base del deploy anterior añade columnas (`nombre`, `auth_token`,
`actualizado`) y tablas (`dispositivos`, `registros`, `intentos`) sin borrar
nada, genera `auth_token` a los clientes antiguos y activa RLS.

Opcional: limpiar intentos de login viejos con un job diario
(`delete from intentos where ts < now() - interval '1 day'`).

## Tag NFC

El sticker guarda una URL (registro NDEF URI): `APP_URL/api/tap?b=<negocio>`.
1. Manager → *Tag NFC / emitir* → **Copiar URL** (o imprime el QR que aparece).
2. NFC Tools → **Write → Add a record → URL/URI** → pega → **Write** → acerca el sticker.

Es NFC como enlace rápido. El NFC de Apple Wallet en el que el pase toca un lector
(VAS) requiere aprobación aparte de Apple y lectores compatibles.
