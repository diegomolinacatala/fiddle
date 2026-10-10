# Dos entornos: `dev` para probar, `main` para los clientes

Desde octubre de 2026 hay clientes de verdad. Se trabaja igual que antes (subir y verlo
en una web al minuto), pero en `dev`. `main` solo recibe lo que ya se ha visto en `dev`.

| | `dev` | `main` |
|---|---|---|
| Web | <https://fiddle-dev.vercel.app> (dominio asignado a la rama `dev`) | <https://fiddle-zeta.vercel.app> |
| Datos | **inventados**, sin base de datos (`lib/datosDePrueba.js`) | Supabase, clientes reales |
| Se despliega | en cada `git push` a `dev` | al aceptar el PR `dev → main` |
| Variables en Vercel | *Preview*, solo rama `dev` | *Production* |

## El día a día

```bash
git switch dev
git pull
# ...cambios...
npm test
git commit -am "feat: lo que sea"
git push            # al minuto está en la web de dev
```

Cuando está bien probado en `dev`, a producción con un PR:

```bash
npm test
npm run build
gh pr create --base main --head dev --title "Lo que sube a producción"
```

- **Nunca `git push` a `main`.** Todo entra por PR desde `dev`.
- **Columna nueva = `supabase/schema.sql` en producción ANTES de aceptar el PR** (si no,
  producción da 500). Dev no lo nota: no tiene base.
- Ramas largas (`feat/...`) siguen valiendo: salen de `dev` y vuelven a `dev`.

## Cómo funciona dev sin base de datos

Sin `SUPABASE_URL`, el store guarda en ficheros (`DATA_DIR`). En Vercel eso es `/tmp`, y
con `DATOS_DE_PRUEBA=1` lo que falta arranca con La Delicantería inventada: unos 30
clientes y tres semanas de caja, con un sello fuera de horario, una corrección y siete
sellos de golpe.

- **Lo que se toca en dev no dura**: vive mientras la función de Vercel siga despierta.
  Tras un rato sin uso o un despliegue nuevo, vuelve a los datos de partida. Sirve para
  mirar pantallas y tocar; no para probar que algo se guarda de un día para otro.
- Dos personas a la vez pueden ver datos distintos si Vercel abre dos funciones.
- `DATOS_DE_PRUEBA` no hace nada en producción (`VERCEL_ENV=production`).
- En local, lo mismo con `preview_start como-dev` (`.claude/launch.json`).

## Lo que NUNCA se le da a dev

- **`SUPABASE_URL` / `SUPABASE_SERVICE_KEY`**: con ellas, dev escribe en los clientes
  reales.
- **El `AUTH_SECRET` de producción**: con el mismo, una sesión de dev valdría allí.
- **Google Wallet**: la clase de una tienda es `issuer + slug`: dev reescribiría la de La
  Delicantería y cambiaría la tarjeta de todos sus clientes de Android.
- **El reloj** (`pg_cron`) solo llama a producción.

Lo de Apple sí se comparte: un pase de dev tiene su serial y su web service, es otra
tarjeta. (Con la protección de Vercel puesta en las previews, el iPhone no llega al web
service de dev y esos pases no se actualizan.)

## Variables de dev (Vercel → *Preview*, rama `dev`)

`DATOS_DE_PRUEBA=1`, `DATA_DIR=/tmp/fiddle`, `AUTH_SECRET` (uno propio de dev), `APP_URL`
(la web de dev) y las contraseñas: `CLAVE_DELICANTERIA_MANAGER`, `CLAVE_DELICANTERIA_CAJA`,
`CLAVE_ADMIN_VICTOR`, `CLAVE_ADMIN_DIEGO` (las que se pongan; ninguna es la de producción). `CIFRADO_CLAVE` y los certificados de Apple ya
estaban en *Preview*.

## Vercel Hobby y el repo privado

Con el repo privado, Vercel Hobby solo despliega commits de quien es dueño de la cuenta
(Victor, con su GitHub conectado en *Account Settings → Authentication*). Los commits de
Diego, y los merges de PR que haga él desde GitHub, **no se despliegan**, ni en dev ni en
producción. Hasta pasar a Pro, los merges a `main` los hace Victor.

## Proteger `main` en GitHub (lo hace el dueño del repo)

*Settings → Rules → New ruleset* para `main`: pedir PR para entrar y no dejar forzar.
