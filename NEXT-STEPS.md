# 👋 Empieza aquí

**Estado (17-sep-2026):** en producción y funcionando en
**<https://fiddle-zeta.vercel.app>**, desplegado automáticamente desde `main`.

Comprobado contra el sitio real:

| Pieza | Estado |
|-------|--------|
| Pases de Apple Wallet | **firmados con nuestra cuenta** (`pass.com.fiddle`, caduca 2027-10-17) |
| Actualizaciones en el iPhone | web service + avisos APNs activos |
| Base de datos | Supabase conectado, 6 tablas |
| Login | usuario + contraseña por negocio, sesión firmada |
| Tres negocios | Nube Café, Fade Room, Forno Nostro |

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
npm test          # 151 tests
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
| Guardar datos nuevos | [`src/lib/store.js`](src/lib/store.js) + [`supabase/schema.sql`](supabase/schema.sql) |

Documentación: [Apple Wallet](docs/APPLE-WALLET.md) · [Arquitectura](docs/ARCHITECTURE.md) ·
[API](docs/API.md) · [Modelo de datos](docs/DATA-MODEL.md) · [Deploy](docs/DEPLOY.md)

---

## Pendiente

### Ahora
- [ ] Confirmar en el iPhone la notificación de **promo** y la de **sello**.
- [ ] Grabar los tags NFC (manager → *Tag NFC / emitir* → Copiar URL → app NFC Tools).
- [ ] Instalar la caja en el móvil de cada tienda (*Añadir a pantalla de inicio*).
- [ ] Poner la **ubicación** de cada negocio desde su manager (aviso en pantalla de bloqueo).

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

### Google Wallet — aparcado a propósito (20-sep-2026)

Hoy `googlewallet.js` **solo genera el enlace de guardar**, y ni eso está activo
en producción (faltan las credenciales). Actualizar un pase ya guardado necesita
la Wallet REST API, que no está escrita. Decisión: **no se toca por ahora**.

Cuando toque, esto es lo que cuesta:

| Trabajo | Coste | Notas |
|---|---|---|
| OAuth de la cuenta de servicio + `PATCH` del objeto | ~3-4 h | Hace falta igual para que los puntos se muevan en Android |
| Alta en Google Pay & Wallet Console | — | Issuer ID + una LoyaltyClass por tienda. Es papeleo, no código |
| Dibujar los sellos en el pase de Android | ~1 h **encima** de lo anterior | Ruta pública que sirve la banda en PNG + `heroImage` apuntando ahí |

Lo de dibujar los sellos sale casi gratis **porque el dibujo ya es modular**: se
rasteriza `stripDelPase()` y se le da a Google una URL, así que vale para
cualquier diseño sin trabajo por tienda. Los dos problemas de verdad son que
Google **cachea las imágenes** (la URL tiene que cambiar con cada sello, p. ej.
`?v=5`, *y* hay que hacer PATCH del objeto) y que el `heroImage` es un **banner
ancho (1032x336) encima de la tarjeta**, no la cuadrícula de Apple: se parecerá,
no será igual.

---

## Operación

- **Certificado de Apple:** caduca el **17-10-2027**. Renovarlo antes ([guía](docs/APPLE-WALLET.md)).
- **Supabase gratuito** se pausa tras ~7 días sin actividad y la app deja de funcionar;
  `/api/salud` lo dice al instante.
- **Diagnóstico rápido:** `/api/salud` (público) y el panel *Estado de la integración*
  dentro de cualquier manager.
- **Copias:** `certs/pass.key.pem`, `certs/apple.env` y `certs/secretos.env` en el gestor
  de contraseñas. Si se pierde la clave privada, hay que sacar otro certificado en Apple.
