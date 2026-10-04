# Deploy

## Variables de entorno

Plantilla completa: [`.env.example`](../.env.example).

| Variable | Para qué | En producción |
|----------|----------|---------------|
| `APP_URL` | URL pública HTTPS. Va dentro de cada pase (QR y `webServiceURL`) | **obligatoria** |
| `AUTH_SECRET` | firma de las sesiones. Distinto en local: con el de Vercel en `.env.local`, una sesión firmada aquí valdría allí | **obligatoria** (sin ella nadie entra) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | base de datos (service_role, solo backend) | **obligatorias** |
| `CIFRADO_CLAVE` | cifra nombres y notas ([PRIVACIDAD.md](PRIVACIDAD.md)). Perderla es perder esos datos | **obligatoria** (sin ella no se guardan nombres) |
| `CLAVE_ADMIN_VICTOR`, `CLAVE_ADMIN_DIEGO` | contraseña de los admins de la plataforma. Las eligen ellos | **obligatorias** |
| `CRON_SECRET` | protege `/api/cron/avisos`, el reloj ([AVISOS.md](AVISOS.md#encender-el-reloj-una-vez-lo-hace-fiddle)). Sin él no sale nada programado ni se borra nada solo | **obligatoria** |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_WWDR_CERT` | firma y avisos de Apple Wallet ([guía](APPLE-WALLET.md)) | para pases reales |
| `APPLE_PASS_TYPE_ID_<SLUG>`, `APPLE_PASS_CERT_<SLUG>` | Pass Type ID propio de una tienda, para que su tarjeta no se apile con las demás | opcional |
| `APPLE_PASS_KEY_PASSPHRASE` | si la clave está cifrada | opcional |
| `GOOGLE_WALLET_ISSUER_ID` + `GOOGLE_WALLET_SA_JSON` (o `_SA_EMAIL` + `_SA_KEY`) | Google Wallet: guardar, actualizar y avisar ([guía](GOOGLE-WALLET.md)) | opcional |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | avisos del navegador en Android. Sin ellas se derivan de `AUTH_SECRET` ([Android](ANDROID.md)) | opcional |
| `ALERTAS_URL` | webhook (ntfy, Slack, Discord) para contraseñas falladas y base caída | recomendada |
| `CONTACTO_PRIVACIDAD` | email de `/privacidad` si la tienda no tiene el suyo | recomendada |
| `CLAVE_<SLUG>_MANAGER`, `CLAVE_<SLUG>_CAJA` | respaldo: solo valen para un usuario **sin** fila en la tabla `accesos` (las contraseñas se generan en `/admin`). `PIN_*` también | opcional |

Cada integración se detecta por separado; lo que falte cae a modo demo. `/admin`
muestra **Estado de la integración** con lo que está activo, y `/api/salud` (público)
dice si la base responde.

Los accesos de prueba (usuario = contraseña) solo existen en local y sin
`AUTH_SECRET`. **En producción no**: es a propósito, para que un deploy mal
configurado no quede abierto. Una variable cambiada en Vercel no vale hasta el
siguiente despliegue (Deployments → Redeploy).

## Vercel

1. Repo en GitHub → **Import** en Vercel (detecta Next.js).
2. **Settings → Environment Variables**: las de arriba.
3. `APP_URL` = dominio definitivo. Si vas a usar dominio propio, configúralo **antes**
   de emitir pases reales: los pases guardan la URL con la que se emitieron.
4. Deploy. Comprueba `/admin` → Estado de la integración.

`sharp` (imágenes del pase) y `passkit-generator` (firma) corren en las funciones
Node de Vercel sin configuración extra (`next.config.mjs` los marca como externos).

## Supabase

SQL Editor → [`supabase/schema.sql`](../supabase/schema.sql) → Run. Es idempotente:
sobre la base del deploy anterior añade las columnas y tablas que falten sin borrar
nada y activa RLS. **Primero el esquema, después el código**: una columna que el
código lee antes de existir en la base devuelve 500 en producción.

La región de Supabase (eu-west-2, Londres) y la de las funciones de Vercel (`lhr1`,
en `vercel.json`) van juntas: si una cambia, la otra con ella.

El reloj (avisos, "Abierto hasta…", la limpieza del RGPD y las alertas) lo llama
Supabase con `pg_cron`, no Vercel: en el plan Hobby un cron de más de una vez al día
hace fallar el despliegue. SQL en [AVISOS.md](AVISOS.md#encender-el-reloj-una-vez-lo-hace-fiddle).

## Tag NFC

El sticker guarda una URL (registro NDEF URI): `APP_URL/api/tap?b=<negocio>`.
1. Manager → *Tag NFC / emitir* → **Copiar URL** (o imprime el QR que aparece).
2. NFC Tools → **Write → Add a record → URL/URI** → pega → **Write** → acerca el sticker.

Es NFC como enlace rápido. El NFC de Apple Wallet en el que el pase toca un lector
(VAS) requiere aprobación aparte de Apple y lectores compatibles.
