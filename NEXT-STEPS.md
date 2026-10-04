# Empieza aquí

**Estado (05-10-2026):** en producción en **<https://fiddle-zeta.vercel.app>**,
desplegado automáticamente desde `main`. Un cliente de pago: **La Delicantería**.

| Pieza | Estado |
|-------|--------|
| Pases de Apple Wallet | firmados con nuestra cuenta (`pass.com.fiddle`, caduca **17-10-2027**) |
| Actualizaciones en el iPhone | web service + avisos APNs |
| Android | tarjeta web instalable, en vivo y con avisos del navegador |
| Google Wallet | funcionando |
| Base de datos | Supabase (eu-west-2), 13 tablas; nombres y notas cifrados |
| Login | contraseñas en la base (`accesos`), sin accesos de prueba en producción |
| Reloj | en marcha (`pg_cron`): «Abierto hasta…», envíos a una hora, limpieza del RGPD y alertas |
| Tiendas | solo La Delicantería; Nube, Fade, Forno y Project 68, archivadas |

---

## Para enseñarlo (guion de 5 minutos)

Hace falta: un iPhone, un Android con Chrome y un tercer móvil (o el ordenador) haciendo
de caja con `delicanteria-caja` abierto en `/delicanteria/caja`.

1. **El cliente de iPhone** toca el tag (o escanea el QR del manager): sale "Añadir a
   Apple Wallet" directamente. Añadir.
2. **El cliente de Android** toca el tag: sale guardarla en Google Wallet. (Sin Google
   Wallet, se abre la tarjeta web: **Activar** los avisos e **Instalar**.)
3. **La caja** escanea el QR del Android → la fila de la cartilla suma un sello. La
   tarjeta se pone al día y avisa.
4. Lo mismo con el iPhone: el pase de Wallet se actualiza y avisa en la pantalla de bloqueo.
5. **Promo**: *Avisos → Enviar → Promo para todos*, escribir "Hoy 2x1 en cafés" →
   *Poner ahora en todas*. Suena en los dos.
6. **Volver a tocar el tag** con el Android: abre SU tarjeta, no una nueva.
7. Si hay tiempo: *Tienda → Editar tarjeta*, tocar cualquier trozo de la vista previa y
   cambiarlo; o, desde el Android, grabar un tag NFC nuevo sin ninguna app.

Si algo no va: *Estado de la integración* en `/admin` dice qué falla y qué tocar.

---

## Trabajar en el proyecto desde cualquier ordenador

**No hace falta ningún secreto para desarrollar.** Sin variables de entorno la app
arranca en *modo demo*: guarda en ficheros locales (`.data/`) y no firma pases reales.

```bash
git clone https://github.com/diegomolinacatala/fiddle.git
cd fiddle
npm install
npm run dev      # http://localhost:3000
```

Necesitas **Node 22 o superior** (`node -v`) y git. Nada más.

- `/` → lleva directo al **login** (o a tu sitio, si ya has entrado).
- `/admin` → con **victor** o **diego**: todas las tiendas, crear, editar, archivar,
  contraseñas, invitaciones, datos legales y comentar los campos del pase para Claude.
- `/login` → usuario **delicanteria** (manager) o **delicanteria-caja** (caja); en local y
  sin `AUTH_SECRET` la contraseña es igual que el usuario y salen listados en la pantalla.
- `/delicanteria/caja` escanea pases (o acepta el código de 3 caracteres a mano) ·
  `/delicanteria/manager` la pestaña **Tienda** · `/delicanteria/crm` **Clientes** ·
  `/delicanteria/avisos` **Avisos** · `/delicanteria/ajustes` la contraseña de la caja.
- `/delicanteria` es la página pública de la tienda (lo que abre el tag NFC).
- `/p/<serial>` es la tarjeta de un cliente; `/p/<serial>/datos`, sus datos (RGPD).

```bash
npm test          # 651 tests
npm run build     # comprobar que compila antes de subir
```

### Probar la firma de pases en local (opcional)

```bash
npm run apple:prueba     # certificados FALSOS -> certs/prueba.env
```

Copia esas líneas a `.env.local` y reinicia `npm run dev`: se generan `.pkpass`
firmados y funciona todo el web service de Apple. Un iPhone **no** aceptará esos
pases; sirve para desarrollar. Los certificados de verdad **solo viven en Vercel**.

### Qué NO está en el repositorio (y no debe estarlo)

| Carpeta / fichero | Qué es | Dónde está |
|---|---|---|
| `certs/` | clave privada de Apple, `apple.env`, `secretos.env`, `cifrado.env` | ordenador de Diego + gestor de contraseñas |
| `.env.local` | variables locales de cada uno | solo en tu ordenador |
| `.data/` | datos del modo demo | solo en tu ordenador |

Las variables reales se ven y se editan en **Vercel → Settings → Environment Variables**
(lista completa en [docs/DEPLOY.md](docs/DEPLOY.md)).

### Cómo subir cambios

```bash
git switch main && git pull
git switch -c feat/lo-que-sea
# ... trabajar ...
npm test
npm run build
git push -u origin feat/lo-que-sea
```

Abre el Pull Request en GitHub, revisa y fusiona a `main`. **Al fusionar en `main`,
Vercel despliega solo** a producción. Si el cambio trae columnas o tablas nuevas,
**primero** `supabase/schema.sql` en Supabase y **después** fusionar.

---

## Dónde tocar cada cosa

| Quiero… | Fichero |
|---------|---------|
| Crear o cambiar una tienda | no toques código: `/admin` (`negocios.js` solo trae la semilla de La Delicantería) |
| Cambiar el aspecto de UNA tienda | no toques código: su manager, *Tienda → Editar tarjeta* |
| Añadir una acción de caja (sellar, canjear, …) | [`src/lib/acciones.js`](src/lib/acciones.js) · ver [docs/ACTIONS.md](docs/ACTIONS.md) |
| Cambiar lo que muestra el pase | [`src/lib/apple/pase.js`](src/lib/apple/pase.js) (campos) · [`dibujo.js`](src/lib/apple/dibujo.js) (marca, casillas, banda) |
| Tocar el login o los permisos | [`src/lib/auth.js`](src/lib/auth.js) · [`acceso.js`](src/lib/acceso.js) · [`accesos.js`](src/lib/accesos.js) |
| Pantallas de caja / manager | [`src/app/[negocio]`](src/app/[negocio]) |
| La tarjeta de Android (lo que ve el cliente) | [`src/app/p/[serial]`](src/app/p/[serial]) · ver [docs/ANDROID.md](docs/ANDROID.md) |
| Qué dicen los avisos de Android | [`src/lib/avisos.js`](src/lib/avisos.js) |
| Un tipo nuevo de aviso automático | [`src/lib/automatizaciones.js`](src/lib/automatizaciones.js) (`DISPAROS`) · ver [docs/AVISOS.md](docs/AVISOS.md) |
| Los avisos, el horario o los textos de UNA tienda | no toques código: su manager, en *Avisos* y *Tienda → Horario* |
| Lo que sale en Google Wallet | [`src/lib/google/pase.js`](src/lib/google/pase.js) · ver [docs/GOOGLE-WALLET.md](docs/GOOGLE-WALLET.md) |
| Guardar datos nuevos | [`src/lib/store.js`](src/lib/store.js) + [`supabase/schema.sql`](supabase/schema.sql) |
| Algo de datos personales | [docs/RGPD.md](docs/RGPD.md) · [`src/lib/legal.js`](src/lib/legal.js) |

Documentación: [Arquitectura](docs/ARCHITECTURE.md) · [API](docs/API.md) ·
[Modelo de datos](docs/DATA-MODEL.md) · [Deploy](docs/DEPLOY.md) ·
[Apple Wallet](docs/APPLE-WALLET.md) · [Android](docs/ANDROID.md) ·
[Google Wallet](docs/GOOGLE-WALLET.md) · [Avisos](docs/AVISOS.md) ·
[RGPD](docs/RGPD.md) · [Privacidad](docs/PRIVACIDAD.md) · [Incidentes](docs/INCIDENTES.md)

---

## Pendiente

La única lista. Lo hecho sale de aquí: el historial ya está en git.

### Comprobar (probablemente hecho)
Cosas de configuración que no se ven desde el código. Tachar o borrar al confirmarlas.
- [ ] **Avisos automáticos**: están apagados por tienda hasta que el admin los enciende
      (`/admin/delicanteria` → *Avisos automáticos y programados*). Si se encienden, probar una regla con
      *Enviar ahora* y escanear a uno de ellos: arriba en la caja sale "En su tarjeta pone…".
- [ ] En un iPhone: la notificación de **promo** y la de **sello**.
- [ ] Tags NFC grabados, caja instalada en el móvil de la tienda (*Añadir a pantalla de
      inicio*) y **ubicación** puesta en su manager (aviso en pantalla de bloqueo).
- [ ] La Delicantería con su **Pass Type ID propio** (`APPLE_PASS_TYPE_ID_DELICANTERIA`,
      [guía](docs/APPLE-WALLET.md#4-pass-type-id-propio-de-una-tienda)). Las tarjetas que ya
      estén en un iPhone se quedan con el ID con que se emitieron.
- [ ] Google Wallet: si la cuenta de emisor sigue en modo demo, solo funciona para los
      usuarios de prueba; pedir a Google el acceso de publicación.
- [ ] En Vercel: `ALERTAS_URL`, `CONTACTO_PRIVACIDAD` y `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
      fijas (hoy, si no están, se derivan de `AUTH_SECRET` y cambiarlo obliga a los clientes
      a reactivar los avisos).
- [ ] Limpieza en Vercel: las `CLAVE_*`/`PIN_*` de Nube, Fade y Forno (archivadas, ya no
      dejan entrar) y `WALLETWALLET_API_KEY`. En Supabase:
      `alter table clientes drop column if exists ww_serial;`

### Legal y papeles (sin código)
- [ ] **Contrato de encargado del tratamiento** (art. 28 RGPD) con La Delicantería: plantilla
      gratuita de la AEPD, basta un anexo firmado. Ellos responsables, nosotros encargados.
- [ ] **Datos legales** de la tienda en `/admin/delicanteria` → *Datos legales*, con el contrato
      delante. Salen en su `/privacidad`.
- [ ] Hoja de **condiciones del servicio**: qué incluye, precio, disponibilidad sin garantía
      y qué pasa con los datos si lo dejan (se borran).
- [ ] Aceptar los **DPA** de Supabase y Vercel desde sus paneles, y 2FA en todas las cuentas.
- [ ] Plan **Pro** de Vercel: el gratuito es solo para uso no comercial.
- [ ] Forma legal (autónomo o SL), **aviso legal** en la web con titular, NIF y contacto
      (LSSI), y facturas.
- [ ] Registro de actividades de tratamiento (una tabla de una página, art. 30.2).
- [ ] [docs/INCIDENTES.md](docs/INCIDENTES.md): decidir **quién decide** si hay una brecha.
- [ ] Revisión por alguien que sepa de RGPD antes de pasar de unas pocas tiendas.

### Código
- [ ] **Cuentas de persona**: lo decidido está en
      [CLAUDE.md](CLAUDE.md#cuentas-lo-decidido-01-10-2026-sin-empezar). Antes de empezar:
      dominio propio, PIN por defecto y si se entra con Google/Apple.
- [ ] **Quien pierde el móvil**: hoy la ficha del cliente (Clientes) tiene *Ver su pase*
      (`/p/<serial>`) y ese enlace se le puede mandar a mano. Falta un botón para enviárselo.
- [ ] Tests end-to-end (Playwright) del camino feliz: login → escanear → sellar → canjear.

### Dejado fuera a propósito
- **QR rotativo.** Una captura se puede enseñar, pero sin sesión de caja no se puede
  actuar. Riesgo asumible con pocas tiendas.
- **Facturación automática y alta autoservicio.** Con menos de diez tiendas, a mano.

---

## Operación

- **Certificado de Apple:** caduca el **17-10-2027** (y cada Pass Type ID propio, el suyo).
  Renovarlo antes ([guía](docs/APPLE-WALLET.md)): es punto único de fallo para todas las tiendas.
- **Diagnóstico rápido:** `/api/salud` (público) y *Estado de la integración* en `/admin`.
- **Supabase gratuito** se pausa tras ~7 días sin actividad; el reloj lo mantiene despierto.
- **Copias:** `certs/pass.key.pem`, `certs/apple.env`, `certs/secretos.env` y
  `CIFRADO_CLAVE` en el gestor de contraseñas. Sin la clave privada hay que sacar otro
  certificado en Apple; sin `CIFRADO_CLAVE` no se leen los nombres.
