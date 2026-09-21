# Empieza aquí

**Estado (21-sep-2026):** en producción y funcionando en
**<https://fiddle-zeta.vercel.app>**, desplegado automáticamente desde `main`.

Comprobado contra el sitio real:

| Pieza | Estado |
|-------|--------|
| Pases de Apple Wallet | **firmados con nuestra cuenta** (`pass.com.fiddle`, caduca 2027-10-17) |
| Actualizaciones en el iPhone | web service + avisos APNs activos |
| Base de datos | Supabase conectado, 6 tablas |
| Login | usuario + contraseña por negocio, sesión firmada |
| Tres negocios | Nube Café, Fade Room, Forno Nostro |
| Android | tarjeta web instalable, en vivo y con avisos del navegador (probado contra FCM) |
| Google Wallet | código listo; **faltan las credenciales** ([guía](docs/GOOGLE-WALLET.md)) |

---

## Para enseñarlo (guion de 5 minutos)

Hace falta: un iPhone, un Android con Chrome y un tercer móvil (o el ordenador) haciendo
de caja con `nube-caja` abierto en `/nube/caja`.

1. **El cliente de iPhone** toca el tag (o escanea el QR del manager): sale "Añadir a
   Apple Wallet" directamente. Añadir.
2. **El cliente de Android** toca el tag: se abre su tarjeta, con la misma banda de
   sellos. Tocar **Activar** en "Avisos de tus sellos" (llega un aviso de prueba) y
   **Instalar** (queda un icono en la pantalla de inicio).
3. **La caja** escanea el QR del Android → *Añadir sello*. En el Android, con la
   tarjeta abierta, vibra y se rellena el sello al momento; con la pantalla apagada,
   llega la notificación "Sello 1 de 8. Te faltan 7 para café gratis".
4. Lo mismo con el iPhone: el pase de Wallet se actualiza y avisa en la pantalla de bloqueo.
5. **Promo**: en el manager, escribir "Hoy 2x1 en cafés" → *Lanzar*. Suena en los dos.
6. **Volver a tocar el tag** con el Android: abre SU tarjeta, no una nueva.
7. Si hay tiempo: en el manager desde el Android, *Grabar un tag con este móvil*
   escribe un tag NFC nuevo sin ninguna app.

Si algo no va: *Estado de la integración* en el manager dice qué falla y qué tocar.

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
- `/admin` → con **victor** o **diego**: todas las tiendas, crear, editar, archivar
  y comentar los campos del pase para Claude.
- `/login` → usuario **nube** (manager) o **nube-caja** (caja); la contraseña es igual
  que el usuario. En local siempre funcionan y salen listados en la propia pantalla.
- `/nube/caja` escanea pases (o acepta el código de 3 caracteres a mano) ·
  `/nube/manager` configura, lanza promos, emite y **enseña cómo queda el pase**
  en Apple y en Google.
- `/nube` es la landing pública de la tienda (lo que abre el tag NFC).
- `/p/<serial>` es la página del pase de un cliente.

```bash
npm test          # 241 tests
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
| `certs/` | clave privada de Apple, `apple.env`, `secretos.env` | ordenador de Diego + gestor de contraseñas |
| `.env.local` | variables locales de cada uno | solo en tu ordenador |
| `.data/` | datos del modo demo | solo en tu ordenador |

Las variables reales se ven y se editan en **Vercel → Settings → Environment Variables**.

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
Vercel despliega solo** a producción. Sin PR también vale (`git push origin main`),
pero perdéis la revisión.

---

## Dónde tocar cada cosa

| Quiero… | Fichero |
|---------|---------|
| Añadir o cambiar un negocio (nombre, colores, premio) | [`src/lib/negocios.js`](src/lib/negocios.js) |
| Añadir una acción de caja (sellar, canjear, …) | [`src/lib/acciones.js`](src/lib/acciones.js) · ver [docs/ACTIONS.md](docs/ACTIONS.md) |
| Cambiar lo que muestra el pase | [`src/lib/apple/pase.js`](src/lib/apple/pase.js) (campos) · [`dibujo.js`](src/lib/apple/dibujo.js) (marca, casillas, banda) |
| Cambiar el aspecto de UNA tienda | no toques código: `/admin/<tienda>`, selector con miniaturas |
| Tocar el login o los permisos | [`src/lib/auth.js`](src/lib/auth.js) · [`src/lib/acceso.js`](src/lib/acceso.js) |
| Pantallas de caja / manager | [`src/app/[negocio]`](src/app/[negocio]) |
| La tarjeta de Android (lo que ve el cliente) | [`src/app/p/[serial]`](src/app/p/[serial]) · ver [docs/ANDROID.md](docs/ANDROID.md) |
| Qué dicen los avisos de Android | [`src/lib/avisos.js`](src/lib/avisos.js) |
| Lo que sale en Google Wallet | [`src/lib/google/pase.js`](src/lib/google/pase.js) · ver [docs/GOOGLE-WALLET.md](docs/GOOGLE-WALLET.md) |
| Guardar datos nuevos | [`src/lib/store.js`](src/lib/store.js) + [`supabase/schema.sql`](supabase/schema.sql) |

Documentación: [Android](docs/ANDROID.md) · [Google Wallet](docs/GOOGLE-WALLET.md) ·
[Apple Wallet](docs/APPLE-WALLET.md) · [Arquitectura](docs/ARCHITECTURE.md) ·
[API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md) · [Deploy](docs/DEPLOY.md)

---

## Pendiente

> Las tareas sueltas van aquí; el orden y el porqué, en
> [docs/ROADMAP.md](docs/ROADMAP.md).

### Ahora
- [ ] Confirmar en el iPhone la notificación de **promo** y la de **sello**.
- [ ] Grabar los tags NFC (manager → *Tag NFC / emitir* → Copiar URL → app NFC Tools).
- [ ] Instalar la caja en el móvil de cada tienda (*Añadir a pantalla de inicio*).
- [ ] Poner la **ubicación** de cada negocio desde su manager (aviso en pantalla de bloqueo).

### Android
- [ ] **Google Wallet**: sacar las credenciales y ponerlas en Vercel (20 minutos,
      [guía](docs/GOOGLE-WALLET.md)). Añadir como usuarios de prueba las cuentas de
      Google de los móviles de la demo mientras Google no apruebe la cuenta.
- [ ] Fijar `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en Vercel (`npx web-push generate-vapid-keys`).
      Hoy se derivan de `AUTH_SECRET` y funcionan, pero si se cambia `AUTH_SECRET` los
      clientes tienen que volver a activar los avisos.
- [ ] Botón oficial "Añadir a Google Wallet" (Google exige su imagen, como Apple la suya).

### Antes de abrir al público
- [ ] Quitar `USUARIOS_DEMO` de Vercel: se desactivan los accesos de prueba y dejan de
      mostrarse en el login. Quedan solo las contraseñas de `certs/secretos.env`.
- [ ] Badge oficial "Add to Apple Wallet" en `/p/<serial>` (ahora hay un botón provisional).
- [ ] Quitar WalletWallet del código y la columna `ww_serial` (ya no se usa).
- [ ] Plan **Pro** en Vercel: el gratuito es solo para uso no comercial.

### Más adelante
- [ ] Anti-fraude: código rotativo en el QR.
- [ ] Métricas para el dueño: visitas, canjes, clientes nuevos.
- [ ] Tests end-to-end (Playwright) de caja y manager.

### Google Wallet — hecho, pendiente de credenciales (21-sep-2026)

Ya no está aparcado: clase por tienda, objeto por cliente, banda de sellos como
`heroImage`, actualización con aviso en cada sello, promos y campañas con mensaje, y
diagnóstico real en el manager. Probado con la API de Google simulada (tests en
`tests/google.test.js`); falta darle credenciales para probarlo contra Google.

---

## Operación

- **Certificado de Apple:** caduca el **17-10-2027**. Renovarlo antes ([guía](docs/APPLE-WALLET.md)).
- **Supabase gratuito** se pausa tras ~7 días sin actividad y la app deja de funcionar;
  `/api/salud` lo dice al instante.
- **Diagnóstico rápido:** `/api/salud` (público) y el panel *Estado de la integración*
  dentro de cualquier manager.
- **Copias:** `certs/pass.key.pem`, `certs/apple.env` y `certs/secretos.env` en el gestor
  de contraseñas. Si se pierde la clave privada, hay que sacar otro certificado en Apple.
