# Deploy

## Variables de entorno

| Variable | Para qué | Obligatoria |
|----------|----------|-------------|
| `WALLETWALLET_API_KEY` | Firma del pase + push (`ww_live_...`) | para pases reales |
| `SUPABASE_URL` | Base de datos | para producción |
| `SUPABASE_SERVICE_KEY` | Base de datos (service_role, solo backend) | para producción |
| `APP_URL` | URL pública; se usa en el QR del pase (`/w/<serial>`) | sí en real |
| `APP_MODE` | `worker` \| `manager` \| `both` (raíz "/") | no (default `both`) |
| `SELLOS_TOTAL`, `CARD_TITLE`, `PREMIO`, `CARD_COLOR` | defaults del programa | no |

Sin `WALLETWALLET_API_KEY` → firma/push simulados. Sin Supabase → estado en `.data/`.
Cada uno se detecta por separado.

## Vercel (una web)

1. Repo en GitHub → **Import** en Vercel (detecta Next.js solo).
2. **Settings → Environment Variables**: añade las de arriba.
3. `APP_URL` = la URL del deploy.
4. Deploy. Listo: `/worker`, `/manager`, `/api/tap` disponibles.

## <a name="dos-webs"></a>Vercel (dos webs separadas, un repo)

Como pediste apps separadas (caja siempre en el móvil; manager ocasional), puedes
desplegar **el mismo repo dos veces**:

| Proyecto Vercel | `APP_MODE` | Dominio sugerido | La raíz "/" abre |
|-----------------|-----------|------------------|------------------|
| tienda-caja | `worker` | `caja.tudominio.com` | la app de caja |
| tienda-manager | `manager` | `admin.tudominio.com` | el panel del manager |

Ambos comparten la MISMA `SUPABASE_URL`/`WALLETWALLET_API_KEY` (misma tienda).
`APP_URL` de cada uno = su propio dominio (el QR del pase apuntará al que emitió).
Recomendado: emite y pon `APP_URL` = el dominio de **caja** (es quien escanea).

> Alternativa avanzada: separar en dos apps Next en un monorepo. No hace falta —
> `APP_MODE` da webs separadas sin duplicar código.

## <a name="walletwallet"></a>WalletWallet — confirmaciones antes de producción

El plan entero depende de dos contratos. Confírmalos en sus docs/soporte:
1. El `PUT /api/passes/<serial>` **dispara el push** automáticamente.
2. Sus pases incluyen `webServiceURL` + `authenticationToken` por defecto (si no,
   un pase instalado no se puede actualizar nunca).
3. El tramo gratis cubre **crear y actualizar** (no solo crear).

Contratos usados por el código (`src/lib/walletwallet.js`):
- `POST /api/passes` → `{ serialNumber, shareUrl, googleSaveUrl, applePass }`
- `PUT /api/passes/<serial>` (body completo; reemplaza el pase)
- Auth: `Authorization: Bearer ww_live_...`

## Tag NFC

El sticker NFC solo guarda una URL (registro NDEF de tipo URI): `APP_URL/api/tap`.
Al tocarlo, el móvil abre esa URL → se crea un pase → "Añadir a Wallet".

**Grabarlo con NFC Tools** (gratis, iOS/Android):
1. Copia la URL desde `/manager` ("Copiar URL del tag").
2. NFC Tools → **Write → Add a record → URL/URI** → pega → **Write**.
3. Acerca el sticker al móvil hasta que confirme la escritura.

> Esto es NFC-como-enlace (abrir una URL), no el NFC de Apple donde el pase toca
> un lector (eso requiere aprobación VAS de Apple). Para "tocar → aparece el pase",
> un sticker NFC barato basta.
