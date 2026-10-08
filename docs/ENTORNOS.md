# Dos entornos: `dev` para probar, `main` para los clientes

Desde octubre de 2026 hay clientes de verdad. Se trabaja igual que antes (subir y verlo
en una web al minuto), pero en `dev`. `main` solo recibe lo que ya se ha visto en `dev`.

| | `dev` | `main` |
|---|---|---|
| Web | <https://fiddle-dev.vercel.app> (ver «Puesta en marcha») | <https://fiddle-zeta.vercel.app> |
| Base de datos | Supabase **fiddle-dev** (datos de prueba) | Supabase de producción (clientes reales) |
| Se despliega | en cada `git push` a `dev` | al aceptar el PR `dev → main` |
| Variables en Vercel | *Preview*, solo rama `dev` | *Production* |

## El día a día

```bash
git switch dev
git pull
# ...cambios...
npm test
git commit -am "feat: lo que sea"
git push            # al minuto está en fiddle-dev.vercel.app
```

Cuando está bien probado en `dev`, a producción con un PR:

```bash
npm test
npm run build
gh pr create --base main --head dev --title "Lo que sube a producción"
```

Lo acepta el otro (o uno mismo tras mirarlo otra vez) y Vercel despliega `main`.

- **Nunca `git push` a `main`.** Todo entra por PR desde `dev`.
- **Columna nueva = `supabase/schema.sql` en la base de dev primero**, probar, y en la de
  producción ANTES de aceptar el PR (si no, producción da 500).
- Ramas largas (`feat/...`) siguen valiendo: salen de `dev` y vuelven a `dev`.

## Lo que NUNCA se comparte entre los dos

- **Supabase**: dev con su propio proyecto. Con el de producción, probar en dev es
  sellar tarjetas de clientes reales.
- **`AUTH_SECRET`**: distinto. Con el mismo, una sesión de dev valdría en producción.
- **Google Wallet**: dev va SIN credenciales de Google. La clase de una tienda es
  `issuer + slug`: dev reescribiría la clase de La Delicantería y cambiaría la tarjeta
  de todos sus clientes de Android.
- **El reloj** (`pg_cron`) solo llama a producción. En dev no salen avisos solos.

Lo de Apple sí se comparte (mismo Pass Type ID y certificado): un pase de dev tiene su
propio serial y su propio web service, así que es otra tarjeta y no toca las reales.

## Puesta en marcha (una vez)

1. **Supabase**: crear el proyecto `fiddle-dev` en **eu-west-2** (Londres, como
   producción) y pegar `supabase/schema.sql` en su SQL Editor.
2. **Vercel → Settings → Environment Variables**, entorno *Preview*, rama `dev`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (los de fiddle-dev), `AUTH_SECRET` (uno nuevo),
   `APP_URL=https://fiddle-dev.vercel.app`, `CLAVE_ADMIN_VICTOR`, `CLAVE_ADMIN_DIEGO`.
   `CIFRADO_CLAVE` y los certificados de Apple ya están en *Preview*.
3. **Vercel → Settings → Domains**: añadir `fiddle-dev.vercel.app` y asignarlo a la rama
   `dev` (Git Branch). Así la dirección no cambia con cada despliegue.
4. **Vercel → Settings → Deployment Protection**: con «Vercel Authentication» puesto en
   las previews, el iPhone no puede hablar con el web service de dev (los pases de dev no
   se actualizan). Quitarlo para las previews: dev solo tiene datos de prueba.
5. **GitHub → Settings → Rules** (lo hace el dueño del repo): regla para `main` que pida
   PR para entrar y no deje forzar (`force push`).
6. **`.env.local`**: que apunte a la base de **dev**, no a la de producción. `npm run dev`
   en local escribe donde diga ese fichero.
