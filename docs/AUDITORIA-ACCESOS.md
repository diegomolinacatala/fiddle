# Auditoría de accesos: contraseñas, sesiones, invitaciones y PIN

**Fecha:** 15-10-2026. **Base auditada:** `main` en `295c855` (lo que corre en producción,
<https://fiddle-zeta.vercel.app>). Incluye el PR
[#25](https://github.com/diegomolinacatala/fiddle/pull/25) `dev → main` del 13-10 (la
Plantilla con PIN por empleado) y el #26 (la invitación pide cada contraseña dos veces).
La lectura se hizo sobre `ac9580b` (lo que tenía la carpeta esa mañana) y, para la
Plantilla y el PIN, sobre `dev` en `4dce73c`; después se contrastó con `295c855`: en los
ficheros de acceso solo cambian estilos (modo oscuro), el logo del login y `/home` como ruta
pública. **Los números de línea de abajo son de `295c855`.** `dev` se quedó 20 commits por
detrás de `main` (ver el apartado 5).

**Para quién es:** para los agentes que vayan a arreglarlo. Cada hallazgo lleva un id, la
severidad, dónde está (fichero y línea en `main` salvo que diga `dev`), cómo se reproduce,
qué hacer y qué test fija el arreglo. Al final, el plan por lotes y las reglas para entregar.

**Disparador:** el manager de La Delicantería perdió su contraseña, se le mandó un enlace
de invitación y «no funcionó». Sigue sin poder entrar.

---

## 0. Resumen

**El servidor no está roto.** El flujo entero (crear enlace, abrirlo, fijar las dos
contraseñas, entrar, gastar el enlace, login con las nuevas) se ha reproducido en local de
punta a punta y funciona; los 110 tests de acceso pasan. Lo que falla es **el camino** del
enlace hasta el dueño y **la falta de recuperación**: hoy no hay forma de que un manager
recupere o cambie su contraseña sin que fiddle actúe, y la única herramienta de
«autoservicio» (la invitación) está pensada para el alta, no para recuperar: **resetea
también la caja** y echa al móvil del mostrador.

Lo que más pesa, por orden:

1. **C1** No hay recuperación ni cambio de contraseña del manager. Ajustes dice «pídeselo a
   fiddle». Si el enlace falla, el dueño se queda fuera hasta que alguien de fiddle se lo
   resuelva a mano.
2. **A1** La página `/invitacion` **pierde el token en cuanto carga** (quita el `#…` de la
   barra). Recargar, volver atrás o reabrir la pestaña = «Enlace incompleto. Ábrelo tal cual
   llegó en el correo». Reproducido.
3. **A3** El admin **no ve el estado** del enlace (pendiente, usado, caducado, anulado) y hay
   **dos botones «Invitar»** (el panel de «tienda creada» y la ficha) que se anulan entre sí
   sin aviso. Crear uno nuevo mata el que ya se mandó. Nada de esto queda en la auditoría.
4. **A2** `/login` rellena el usuario del **manager** aunque se venga de la caja
   (`/login?b=delicanteria&next=/delicanteria/caja` pone `delicanteria`, no
   `delicanteria-caja`). La caja teclea bien su contraseña, falla, y a los 10 fallos la IP
   del local queda 15 minutos bloqueada. Reproducido.
5. **A4** Sesión del manager de 12 horas sin renovar, con una contraseña generada de 12
   caracteres que no se puede cambiar: la receta para que se pierda.

Lo que está bien y **no hay que tocar** está en el anexo B (hash scrypt, sesión HMAC
firmada, fallo cerrado sin `AUTH_SECRET`, límites de intentos persistidos, sesión que cae al
cambiar la contraseña, aislamiento entre tiendas, RLS en Supabase).

---

## 1. Alcance y método

**Leído entero** (en `ac9580b` y, lo de la Plantilla, en `4dce73c`; contrastado con
`295c855`): `src/lib/auth.js`,
`acceso.js`, `accesos.js`, `claves.js`, `sesionVigente.js`, `limitador.js`,
`invitaciones.js`, `http.js`, `auditoria.js`, `alertas.js`, `url.js`, `src/middleware.js`,
las rutas `/api/login`, `/api/logout`, `/api/invitacion`, `/api/admin/invitacion`,
`/api/admin/accesos`, `/api/accesos/caja`, `/api/admin/negocios`, `/api/estado`,
`/api/tutorial`, las pantallas `/login`, `/invitacion`, `/admin` (`Invitar.js`,
`Accesos.js`, `[slug]/page.js`, `page.js`), `[negocio]/ajustes`, `manager/page.js`,
`caja/page.js`, `w/[serial]/page.js`, `ClaveNueva.js`, `LogoutButton.js`, el
`supabase/schema.sql` (tablas `accesos`, `invitaciones`, `auditoria`, `intentos`),
`next.config.mjs`, `public/sw.js`, `.env.example`, `docs/ARCHITECTURE.md` (Seguridad),
`docs/API.md`, `docs/DEPLOY.md`, `docs/INCIDENTES.md`, y lo de la Plantilla:
`lib/plantilla.js`, `lib/quien.js`, `/api/plantilla`, `/api/plantilla/quien`,
`caja/QuienAtiende.js`, `plantilla/Equipo.js`, `datosDePrueba.js`, `docs/ENTORNOS.md`.

**Tests:** `auth`, `accesos`, `invitaciones`, `login`, `sesion-vigente`, `aislamiento`,
`admin`, `acceso` → 8 ficheros, **110 pruebas, todas pasan** (en `ac9580b`; `main` añade
los de la Plantilla, `plantilla.test.js` y `rutas-plantilla.test.js`).

**Reproducido en local** (modo demo con ficheros, `preview_start demo`, puerto 3100, código
de `ac9580b`; la página de la invitación y el login son los mismos en `295c855` salvo el
segundo campo «Repítela» y los estilos):

| Qué | Resultado |
|---|---|
| `GET /login?b=delicanteria&next=/delicanteria/caja` | El campo Usuario sale con `delicanteria` (el manager), no con `delicanteria-caja`. |
| Crear invitación como admin, abrir `/invitacion#<token>` | Carga bien, UNA llamada a `/api/invitacion`, la barra pasa a `/invitacion` (sin token). |
| Recargar esa pestaña | «Este enlace no sirve. Enlace incompleto. Ábrelo tal cual llegó en el correo.» |
| Volver a pegar el enlace con `#` en la MISMA pestaña (solo cambia el hash) | La página no reacciona: sigue en el error. Solo una carga completa lo arregla. |
| Completar los dos pasos | Entra a `/delicanteria/manager`; `delicanteria` y `delicanteria-caja` entran con las nuevas; la de la caja no abre el manager; el enlace responde 410 «ya se usó». |

**Producción** (sin tocar nada): `/invitacion` y `/login` responden 200 con la CSP del
repo; `GET /api/login` devuelve `{ demo: false }` (sin accesos de prueba).

---

## 2. Cómo funciona hoy (el mapa)

### 2.1 Usuarios y roles
- Un usuario es una tienda con un rol: `delicanteria` (manager) y `delicanteria-caja` (caja).
  Lo decide `resolverUsuario` ([auth.js:87](../src/lib/auth.js)). `victor` y `diego` son admin
  de la plataforma (`ADMINS`, [auth.js:37](../src/lib/auth.js)).
- No hay cuentas de persona ni email. Lo decidido para eso está en
  [CLAUDE.md → Cuentas](../CLAUDE.md#cuentas-lo-decidido-01-10-2026-sin-empezar).

### 2.2 Login y sesión
- `POST /api/login` ([route.js:37](../src/app/api/login/route.js)): resuelve el usuario,
  comprueba que la tienda existe y no está archivada, el límite de intentos
  (`loginBloqueado`), la contraseña (`comprobarAcceso`) y deja la cookie `sesion`
  (`httpOnly`, `SameSite=Lax`, `secure` en producción).
- El token es `negocio.rol.exp.firma` (HMAC-SHA256 con `AUTH_SECRET`,
  [auth.js:156](../src/lib/auth.js)). **Sin fecha de emisión**: `sesionVigente` la deduce
  restando el TTL ([sesionVigente.js:27](../src/lib/sesionVigente.js)).
- Duración ([auth.js:32](../src/lib/auth.js)): caja 30 días, manager 12 h, admin 12 h.
  **No se renueva**: a las 12 h el manager vuelve al login.
- El middleware (Edge) solo mira la firma; las páginas del personal y las API con
  `exigirNegocio` miran además que la sesión siga vigente (`accesos.actualizado` posterior
  = fuera; tienda archivada = fuera). Si la base falla, vale la firma (a propósito).
- `POST /api/logout` solo borra la cookie: el token sigue valiendo hasta que caduque.

### 2.3 Dónde viven las contraseñas (orden de verdad, [accesos.js:30](../src/lib/accesos.js))
1. Fila en `accesos` (hash scrypt, [claves.js](../src/lib/claves.js)): **solo vale esa**.
2. Sin fila: la variable `CLAVE_<SLUG>_<ROL>` (o `PIN_…`, nombre antiguo).
3. Solo en local y sin `AUTH_SECRET`: contraseña = usuario.
- Los admins van **solo** por variable (`CLAVE_ADMIN_VICTOR`, `CLAVE_ADMIN_DIEGO`).
- Las generadas son `XXXX-XXXX-XXXX` (31 símbolos, ~59 bits); se comparan sin mayúsculas,
  espacios ni guiones. Las elegidas (invitación): mínimo 10 caracteres, distinta del
  usuario, no un carácter repetido.

### 2.4 Quién puede cambiar qué
| Quién | Qué | Dónde |
|---|---|---|
| Admin | Generar una nueva (manager o caja) de cualquier tienda; se ve UNA vez | `/admin/<slug>` → Accesos ([Accesos.js](../src/app/admin/Accesos.js), `POST /api/admin/accesos`) |
| Admin | Crear un enlace de invitación (el dueño elige las dos) | `/admin/<slug>` → «Invitar al dueño por correo» y el panel de tienda recién creada ([Invitar.js](../src/app/admin/Invitar.js)) |
| Manager | Generar una nueva **de la caja** | Ajustes (`cambiarClaveCaja` en [PanelAjustes.js](../src/app/[negocio]/ajustes/PanelAjustes.js), `POST /api/accesos/caja`) |
| Manager | **Nada sobre la suya** | Ajustes → «Tu acceso: para cambiar tu contraseña, pídeselo a fiddle» ([PanelAjustes.js:80](../src/app/[negocio]/ajustes/PanelAjustes.js)) |
| Caja | Nada | |

### 2.5 La invitación ([invitaciones.js](../src/lib/invitaciones.js))
- Token de 32 bytes en base64url (43 caracteres) detrás de `#`; en la base solo su sha256
  (`invitaciones.huella`), caduca a los 7 días, un solo uso (`usada`), y **crear otra anula
  las anteriores sin usar de esa tienda** (`crearInvitacion`,
  [store.js:1466](../src/lib/store.js)).
- La página lee el hash al montar, **lo quita de la barra** con `history.replaceState`
  ([invitacion/page.js:36](../src/app/invitacion/page.js)) y pregunta a `POST /api/invitacion
  { token }` si vale. Pide cada contraseña dos veces (PR #26). Al terminar, `POST { token,
  manager, caja }` fija **las dos** contraseñas (sobrescribe los dos hashes), gasta el enlace
  y deja la sesión de manager.
- El correo lo manda el admin desde su propio cliente (`mailto:` con el cuerpo ya escrito,
  [Invitar.js:104](../src/app/admin/Invitar.js)) o copia el enlace. El `#` va bien codificado
  en el `mailto` (`encodeURIComponent`).
- La URL sale de `APP_URL` ([url.js:4](../src/lib/url.js)); sin la variable, `http://localhost:3000`.

### 2.6 Recuperación de contraseña
**No existe.** Ni enlace «¿has olvidado tu contraseña?» en `/login`, ni email del manager
en ninguna parte (solo `legal.email` de la tienda, para el aviso de privacidad), ni
proveedor de correo. El único camino es que el admin genere otra y se la haga llegar, o
mande una invitación (que también cambia la de la caja).

### 2.7 PIN de empleados
- La cuenta de la caja sigue siendo **una contraseña compartida** por todo el personal. El
  PIN no sustituye esa puerta: pone nombre a cada sello.
- **En producción desde el PR #25 (13-10-2026)** (commit `84a8bac`): pestaña Plantilla,
  `config.plantilla` con `{id, nombre, alta, baja, pin (hash scrypt), largoPin}`; cada
  empleado elige su PIN
  (4 a 6 cifras) la primera vez que se elige en la caja; la cookie `quien` va firmada con
  `AUTH_SECRET`, dura 2 h desde el último uso y lleva la huella del hash (quitar el PIN la
  invalida); 5 fallos por persona e IP cada 15 min (30 por persona); `/api/accion` devuelve
  428 si hay plantilla y nadie se identificó. Está probado (`rutas-plantilla.test.js`,
  `plantilla.test.js`) y documentado (`docs/ARCHITECTURE.md`, `API.md`, `RGPD.md`). Lo que
  llama «PIN» el resto del código (`PIN_<SLUG>_<ROL>`, comentarios del limitador) es el
  nombre antiguo de la contraseña, no esto (B1).

### 2.8 Límites y alertas
- Login: 10 fallos por IP+tienda y 100 por tienda en 15 min, en la tabla `intentos`
  ([limitador.js:26](../src/lib/limitador.js)). La IP es el primer valor de
  `x-forwarded-for` ([limitador.js:124](../src/lib/limitador.js)).
- Invitación: 20 aceptaciones por IP en 10 min. La comprobación del enlace (`{token}`) no
  se limita (no hace falta: 256 bits).
- Alertas ([alertas.js](../src/lib/alertas.js)): 30 fallos de login en 15 min → webhook
  `ALERTAS_URL`, **solo si la variable está puesta** (comprobar en Vercel).

### 2.9 Auditoría
Queda apuntado: generar contraseña desde admin o manager (`clave`), config, archivar,
borrar, entradas del admin. **No queda**: crear una invitación, aceptarla (que sobrescribe
dos contraseñas), ni ningún login. El admin se apunta como «admin» sin decir si fue Victor
o Diego ([auditoria.js:14](../src/lib/auditoria.js)).

---

## 3. El caso: el manager perdió la contraseña y el enlace «no funcionó»

### 3.1 Qué pudo pasar (de más a menos probable) y qué vería el dueño

| # | Causa | Mensaje que vio | Cómo comprobarlo |
|---|---|---|---|
| 1 | Abrió el enlace, no terminó (o se fue a mirar algo), y **recargó o volvió** a la pestaña: el token ya no estaba en la barra (A1) | «Enlace incompleto. Ábrelo tal cual llegó en el correo.» | La fila en `invitaciones` sigue con `usada = null` y sin caducar |
| 2 | **Se creó otro enlace después** (desde la ficha o desde el panel de «tienda creada», por Victor o por Diego, o con «Otro enlace») y el que tenía el dueño quedó anulado (A3) | «Este enlace no vale. Puede que se haya enviado otro más nuevo.» | Varias filas en `invitaciones` para `delicanteria` con `creado` distinto; la que tiene el dueño ya no existe (se borra al crear la nueva) |
| 3 | **Caducó**: pasaron más de 7 días | «Este enlace ha caducado. Pide otro.» | `caduca < now()` |
| 4 | El **cliente de correo o mensajería recortó el `#…`** (Outlook con Safe Links, vistas previas, copiar a mano «hasta la barra») (A5) | «Enlace incompleto…» | Pedirle al dueño que reenvíe el enlace tal cual lo abrió |
| 5 | El enlace se generó en **fiddle-dev** (sin base: vive en el `/tmp` de UNA función, y las previews llevan la protección de Vercel) (M7) | «Este enlace no vale» o la pantalla de acceso de Vercel | El enlace empieza por `https://fiddle-dev.vercel.app` |
| 6 | Lo completó, entró, **no apuntó la contraseña** y a las 12 h la sesión caducó (A4, C1) | «Este enlace ya se usó. Entra con tu usuario y tu contraseña.» | `usada` con fecha y `accesos.actualizado` de `delicanteria` en esa misma fecha |
| 7 | `APP_URL` mal (dominio viejo o vacío) | El enlace no abre nada o abre otra web | `/admin` → Estado de la integración → `appUrl` |

### 3.2 Para saber cuál fue (consultas en Supabase, solo lectura)

```sql
select huella, creado, caduca, usada from invitaciones where negocio = 'delicanteria' order by creado desc;
select usuario, rol, actualizado from accesos where negocio = 'delicanteria';
select ts, usuario, rol, accion, detalle from auditoria where negocio = 'delicanteria' order by ts desc limit 30;
select clave, count(*) from intentos where clave like 'login:delicanteria:%' group by clave;
```

Si aún se tiene el enlace que se mandó, su huella es el sha256 de lo que va tras `#`:

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "<token>"
```

Los 410 de `/api/invitacion` **no dejan rastro en los logs de Vercel** (solo los 500):
hoy no hay forma de ver desde el servidor cuántas veces se abrió ni con qué resultado (A5).

### 3.3 Qué hacer hoy, sin tocar código

Camino recomendado (no toca la caja):

1. Entrar en `/admin/delicanteria` → Accesos → **Cambiar** en «Dueño / manager». Sale
   `XXXX-XXXX-XXXX` una sola vez (queda en `auditoria` como `clave manager`).
2. Dársela al dueño por un canal vivo (teléfono o en persona; si es WhatsApp, que la
   borre después). Se puede teclear en minúsculas y sin guiones.
3. Decirle que la guarde en el gestor de contraseñas del móvil: **hoy no puede
   cambiarla** (C1) y la sesión le caduca cada 12 h (A4).

Si se prefiere la invitación, avisar antes de que **también cambia la contraseña de la
caja y echa al móvil del mostrador** (habrá que volver a entrar en la caja con la nueva), y
dar estas instrucciones con el enlace: abrirlo en Safari o Chrome, **no recargar ni
cerrar hasta ver el manager**, y si sale «no sirve», pedir otro (cada enlace nuevo mata el
anterior: que lo cree una sola persona, una sola vez).

---

## 4. Hallazgos

| Id | Sev. | Qué | Dónde |
|---|---|---|---|
| C1 | CRÍTICO | No hay recuperación ni cambio de la contraseña del manager; la invitación resetea también la caja | `ajustes/PanelAjustes.js`, `lib/invitaciones.js` |
| A1 | ALTO | `/invitacion` pierde el token al recargar o volver; no reacciona a un cambio de hash | `app/invitacion/page.js:32-44` |
| A2 | ALTO | `/login` rellena el usuario del manager cuando se viene de la caja; 10 fallos bloquean la IP del local | `app/login/page.js:19`, `middleware.js:31`, `LogoutButton.js:12` |
| A3 | ALTO | El admin no ve el estado del enlace; dos «Invitar» se anulan sin aviso; sin auditoría | `admin/Invitar.js`, `admin/page.js:127`, `admin/Accesos.js:61`, `api/admin/invitacion` |
| A4 | ALTO | Sesión del manager de 12 h sin renovar + contraseña generada que no puede cambiar | `lib/auth.js:32`, `api/login/route.js:70` |
| A5 | ALTO | El enlace depende del fragmento `#`, sin alternativa, y los fallos no dejan rastro | `lib/invitaciones.js:36,44`, `api/invitacion/route.js:19` |
| M1 | MEDIO | `aceptarInvitacion` gasta el enlace antes de guardar las contraseñas | `lib/invitaciones.js:77-82` |
| M2 | MEDIO | Auditoría incompleta: invitaciones, logins, y «admin» sin nombre | `lib/auditoria.js`, `api/invitacion`, `api/admin/invitacion` |
| M3 | MEDIO | Sesiones sin revocación individual, sin `iat`; `logout` no invalida; admin solo con `AUTH_SECRET` | `lib/auth.js`, `lib/sesionVigente.js:27` |
| M4 | MEDIO | Una contraseña elegida de 12 alfanuméricos se compara como si fuera generada | `lib/claves.js:73-77` |
| M5 | MEDIO | El PIN lo fija «el primero que llega»: cualquier caja puede ponerle PIN a un compañero sin PIN | `api/plantilla/quien/route.js:74-84` |
| M6 | MEDIO | `firmarTexto` comparte secreto con la sesión sin separar dominios; `quien` no cae al cambiar la contraseña de la caja | `lib/auth.js` (`firmarTexto`), `lib/quien.js` |
| M7 | MEDIO | En fiddle-dev se pueden crear invitaciones que nunca van a funcionar | `admin/Invitar.js`, `docs/ENTORNOS.md` |
| M8 | MEDIO | `/login` no ofrece salida a quien no puede entrar; el 429 no dice si la contraseña era buena; sin «Ver» | `app/login/page.js` |
| M9 | MEDIO | Límite de intentos: fía en `x-forwarded-for`; tienda inexistente no cuenta; alertas solo con `ALERTAS_URL` | `lib/limitador.js:124`, `api/login/route.js:45` |
| M10 | MEDIO | Admins solo por variable: rotar exige redeploy; sin segundo factor; `ADMINS` en código | `lib/auth.js:37,76` |
| B1 | BAJO | Comentarios y nombres desfasados («PIN» en el login) | `lib/limitador.js:7`, `schema.sql` (intentos), `auth.js:73` |
| B2 | BAJO | Login: placeholder con el slug de un cliente (el título ya es el logo de fiddle) | `app/login/page.js:87` |
| B3 | BAJO | scrypt N=2^15; sin lista de contraseñas comunes | `lib/claves.js:22,62` |
| B4 | BAJO | Sin tests de los handlers `/api/invitacion` y `POST /api/login`, ni de las pantallas; sin e2e | `tests/` |
| B5 | BAJO | Vercel añade `Access-Control-Allow-Origin: *` a `/login` y `/invitacion` (estáticas) | infraestructura |

### C1 — Sin recuperación ni cambio de la contraseña del manager (CRÍTICO)

**Qué pasa.** El manager no puede cambiar su contraseña desde ningún sitio
([PanelAjustes.js:76-81](../src/app/[negocio]/ajustes/PanelAjustes.js)) y nadie puede
recuperársela (solo hay hash). Las opciones del admin son: generar otra y hacérsela llegar
por fuera, o una invitación. La invitación **siempre fija las dos** contraseñas
([invitaciones.js:62-84](../src/lib/invitaciones.js)): usada para recuperar al manager,
cambia la de la caja sin que nadie lo pidiera y `sesionVigente` echa al móvil del
mostrador en cuanto se guarde (`accesos.actualizado` nuevo). La pantalla de la invitación
tampoco lo dice («Dos contraseñas y listo»).

**Por qué importa.** Es exactamente lo que está pasando con el cliente de pago: un dueño
fuera, dependiendo de fiddle, y la «solución» de hoy deja la caja fuera también.

**Qué hacer.**
1. **Ajustes → «Tu acceso» → «Cambiar mi contraseña»**: pide la actual y la nueva (dos
   veces, como ya hace la invitación), con `problemaClaveElegida`, y guarda con
   `guardarAcceso` (eso ya saca a las demás sesiones; la propia se vuelve a firmar en la
   respuesta). Nueva ruta `POST /api/accesos/manager?b=` (manager, con la contraseña actual
   en el cuerpo; `exigirNegocio` + `comprobarAcceso`; limitada como el login; `auditar(…,
   "clave", "manager")`). Clasificarla en `tests/aislamiento.test.js`.
2. **Enlace de restablecimiento solo del manager**, reutilizando `invitaciones` con una
   columna `alcance` (`'alta'` | `'manager'`): el admin lo crea desde Accesos («Enviar
   enlace para que elija su contraseña»), la página pide una sola contraseña y no toca la
   caja. `supabase/schema.sql` en producción ANTES del PR (`alter table invitaciones add
   column if not exists alcance text not null default 'alta'`).
3. Mientras no haya cuentas con email, la pantalla de login tiene que decir **qué hacer** si
   no se puede entrar (M8).
4. A medio plazo: lo decidido en Cuentas (Supabase Auth: recuperación por email). Que lo
   de arriba sea un paso hacia eso, no un sistema paralelo.

**Tests.** `comprobarAcceso` con la nueva; la antigua deja de valer; la sesión anterior del
manager cae y la de la caja sigue; con la contraseña actual mal, 401 y cuenta como fallo;
el enlace de alcance `manager` no cambia `delicanteria-caja`.

### A1 — `/invitacion` pierde el token al recargar o volver (ALTO)

**Qué pasa.** El efecto lee `window.location.hash` y acto seguido lo quita de la barra
([invitacion/page.js:33-36](../src/app/invitacion/page.js)). Cualquier recarga, «atrás»,
pestaña restaurada o cambio de app en el móvil que descargue la pestaña vuelve a cargar
`/invitacion` sin token → «Enlace incompleto». Además, el hash solo se lee al montar: si la
pestaña ya está en `/invitacion` (con el error) y se vuelve a pegar el enlace, el navegador
solo cambia el hash y la página sigue en el error (reproducido).

**Qué hacer.** Guardar el token en `sessionStorage` al leerlo (y leerlo de ahí si el hash
está vacío); no quitar el hash hasta que el servidor diga que vale (o no quitarlo: el
`Referrer-Policy: strict-origin-when-cross-origin` de `next.config.mjs` ya impide que el
fragmento salga en un Referer, y los logs de Vercel no ven el fragmento en ningún caso);
escuchar `hashchange`; borrar el `sessionStorage` al aceptar. En el error «incompleto»,
decir qué hacer: «vuelve a abrir el enlace desde el correo; si no, pide otro».

**Tests.** Difícil en vitest sin DOM; como mínimo un test de la función que extrae el
token (`token de hash o de sessionStorage`) si se saca a `lib/`. Playwright del camino
feliz y de «recargar en el paso 2».

### A2 — `/login` rellena el usuario equivocado para la caja (ALTO)

**Qué pasa.** El middleware manda a `/login?b=<slug>&next=<ruta>`
([middleware.js:31-33](../src/middleware.js)) y la página pone `b` tal cual en Usuario
([login/page.js:19](../src/app/login/page.js)), que es el usuario del **manager**. Quien
viene de `/delicanteria/caja` o de `/w/<serial>` (la caja con la sesión caducada o la
contraseña cambiada, lo más normal) ve `delicanteria`, teclea la contraseña de la caja y
recibe «Usuario o contraseña incorrectos». Si insiste, a los 10 fallos la IP del local queda
bloqueada 15 minutos (todo el personal del local comparte IP). `LogoutButton` hace lo mismo
([LogoutButton.js:12](../src/app/LogoutButton.js)).

**Qué hacer.** Derivar el usuario del destino: si `next` es `/<slug>/caja` o `/w/…`,
rellenar `<slug>-caja`; si es manager/crm/avisos/ajustes/plantilla, `<slug>`. Mejor aún,
en la pantalla, dos botones «Soy la caja» / «Soy el dueño» que fijen el usuario (el campo
sigue editable). Que `LogoutButton` reciba el rol o la ruta.

**Tests.** Función pura `usuarioSugerido(b, next)` en `lib/acceso.js` con sus casos.

### A3 — El admin no ve el estado del enlace y dos «Invitar» se anulan sin aviso (ALTO)

**Qué pasa.** `Invitar` aparece en dos sitios: el panel de «tienda creada» en `/admin`
([page.js:127](../src/app/admin/page.js)) y la ficha
([Accesos.js:61](../src/app/admin/Accesos.js)). Cada instancia solo pide confirmación si
**ella misma** ya creó uno ([Invitar.js:27](../src/app/admin/Invitar.js)); desde la otra, o
desde el otro admin, se crea sin aviso y `crearInvitacion` borra el pendiente
([store.js:1470](../src/lib/store.js)). Nada enseña si hay un enlace pendiente, cuándo
caduca, si se usó o si se anuló; y ni crear ni aceptar quedan en `auditoria`.

**Qué hacer.** `GET /api/admin/invitacion?slug=` → `{ pendiente: {creado, caduca} | null,
ultimaUsada }` (la tabla ya lo tiene todo); la ficha lo pinta («Enlace pendiente, caduca el
22 de octubre», «Usado el 3 de octubre») y el botón pasa a «Crear otro (el pendiente dejará
de valer)». `auditar(sesion, slug, "invitacion", "creada")` en el admin y
`auditar(null, slug, "invitacion", "aceptada")` en `/api/invitacion`.

**Tests.** El GET nuevo (admin solo, en `aislamiento.test.js` como `DEL_ADMIN`); la fila de
auditoría al crear y al aceptar.

### A4 — Sesión del manager de 12 h sin renovar, con contraseña que no puede cambiar (ALTO)

**Qué pasa.** `TTL_SEGUNDOS.manager = 12 h` ([auth.js:32](../src/lib/auth.js)) y la cookie
no se renueva nunca: cada mañana, el dueño vuelve a teclear `K7MP-X3QR-9HTB`. Una
contraseña así, sin poder cambiarla, acaba en un papel o se pierde. Es la causa de fondo
del incidente.

**Qué hacer.** Una de estas dos, o las dos: sesión del manager de 30 días **deslizante**
(cada página o API del manager que pase por `sesionVigente` vuelve a poner la cookie si le
queda menos de la mitad), o un «Mantener la sesión en este dispositivo» en el login. Ojo
con `emitidaEn`: hoy se deduce del TTL ([sesionVigente.js:27](../src/lib/sesionVigente.js));
al renovar, la sesión parecería más nueva que un cambio de contraseña posterior. Por eso va
con M3 (meter `iat` en el token). Y C1 para que la contraseña sea suya.

### A5 — El enlace depende del fragmento `#`, sin alternativa, y los fallos no dejan rastro (ALTO)

**Qué pasa.** Poner el token tras `#` es buena idea (no va a logs ni al servidor), pero hay
clientes que lo recortan o lo reescriben (Outlook con Safe Links, algunas vistas previas,
copiar «hasta donde se ve»). Si pasa, el dueño solo ve «Enlace incompleto» y fiddle no ve
nada: `leerInvitacion` devuelve 410 y el handler no escribe nada
([route.js:19](../src/app/api/invitacion/route.js)).

**Qué hacer.** (1) `console.warn("[invitación] rechazada:", motivo)` sin el token, para
verlo en Vercel. (2) Una segunda vía sin fragmento: la página `/invitacion` sin token
ofrece «Pega aquí el código del correo» (el token, 43 caracteres), y el correo lo lleva
también en texto, debajo del enlace. (3) Un QR del enlace en la ficha del admin para darlo
en persona (ya hay `QrImagen.js`). No pasar el token a `?t=`: iría a los logs y al
historial.

### M1 — `aceptarInvitacion` gasta el enlace antes de guardar (MEDIO)

[invitaciones.js:77-82](../src/lib/invitaciones.js): calcula los hashes, **gasta** el enlace
y luego hace dos `guardarAcceso`. Si el segundo (o el primero) falla (Supabase caído un
segundo), el enlace ya no vale y el dueño tiene una contraseña, ninguna, o las dos pero con
un error en pantalla. **Qué hacer:** guardar los dos primero y gastar después; si gastar
falla tras guardar, responder `ok` igual (las contraseñas ya están) y apuntarlo. Test: con
`guardarAcceso` fallando, el enlace sigue vivo y se puede repetir.

### M2 — Auditoría incompleta (MEDIO)

No se apunta: crear ni aceptar una invitación (que sobrescribe dos contraseñas), ni ningún
login (ni correcto ni fallido; los fallos van a `intentos` sin usuario, y se borran a las
24 h). «admin» no dice cuál ([auditoria.js:14](../src/lib/auditoria.js)): el token no lleva
quién. `docs/RGPD.md` 6.8 promete apuntar los cambios de contraseña. **Qué hacer:** las dos
filas de A3; `login` correcto como acción (`usuario`, sin IP); meter el nombre del admin en
el token de sesión (un segmento más, `plataforma.admin.victor.exp.firma`, o `sub` en un
payload) y usarlo en `quienEs`.

### M3 — Sesiones sin revocación individual (MEDIO)

Stateless: `logout` borra la cookie pero el token sigue valiendo hasta `exp`; el único corte
es `accesos.actualizado` (cambiar la contraseña) o rotar `AUTH_SECRET` (echa a todos). El
admin no tiene ni eso (12 h sin cortar). El token no lleva `iat` y `emitidaEn` depende de
las constantes de TTL (ya lo advierte el comentario en [auth.js:29-31](../src/lib/auth.js)).
La cookie `quien` de la Plantilla (2 h) sigue valiendo tras cambiar la contraseña de la
caja: no va atada a la sesión. **Qué hacer ahora, barato:** `iat` en el token; una «versión de
sesión» por tienda en `config` que `sesionVigente` compare (cerrar todas las sesiones de
una tienda desde Ajustes/admin sin cambiar contraseñas). **Después:** sesiones en el
servidor, como está decidido en Cuentas.

### M4 — `normalizarClave` aplana contraseñas elegidas (MEDIO)

[claves.js:73-77](../src/lib/claves.js): cualquier contraseña que, sin espacios ni guiones y
en mayúsculas, sea exactamente 12 alfanuméricos se guarda y compara como `XXXX-XXXX-XXXX`.
Una elegida como `micafeteria1` vale también como `MICAFETERIA1` o `mi ca fe teria1`:
menos entropía y una sorpresa para el dueño. **Qué hacer:** guardar en `accesos` si la
contraseña es `generada` o `elegida` (columna nueva, o un prefijo en el hash, p. ej.
`scrypt-gen$…`) y normalizar solo las generadas. El test de
`invitaciones.test.js` «una elegida con forma de generada» cambia de sentido: documentarlo.

### M5 — El PIN lo fija «el primero que llega» (MEDIO)

[quien/route.js:74-84](../src/app/api/plantilla/quien/route.js): con la cuenta de la caja,
cualquiera elige un nombre «sin PIN aún» de la lista y le pone el PIN que quiera.
Desde ese momento sella como esa persona. El manager solo puede «quitar el PIN», y vuelta
a empezar. **Qué hacer:** que el alta del PIN la autorice el manager: un código de alta de
un uso que ve en Plantilla → Equipo («Dile a Marta este código: 48213») y que la caja pide
antes de elegir el PIN; o que el manager fije el primer PIN y la persona lo cambie en su
primer uso (hoy no hay «cambiar PIN»: añadirlo, con el actual). Test: `nuevoPin` sin
código, 403.

### M6 — Firma compartida y cookie `quien` suelta (MEDIO)

`firmarTexto`/`verificarTexto` usan el mismo HMAC y secreto que la sesión sin un prefijo de
dominio; hoy no se cruzan (la sesión exige 4 partes, `quien` lleva 5), pero es por
casualidad de formato. **Qué hacer:** prefijo fijo en lo que se firma (`quien:` /
`sesion:`), y que `quien` lleve también la fecha de la sesión o caiga con
`accesos.actualizado` de la caja (M3). Lo de 4 cifras está aceptado y documentado en
`ARCHITECTURE.md`: no es hallazgo.

### M7 — Invitaciones creadas en fiddle-dev (MEDIO)

`docs/ENTORNOS.md`: dev no tiene base, cada función de Vercel tiene su `/tmp`, y las
previews llevan protección. Una invitación creada ahí puede «no valer» en la siguiente
petición y el dueño ni llega a la página. Nada lo impide ni lo avisa. **Qué hacer:** en
`Invitar`, si `!hasSupabase()` (o `VERCEL_ENV !== "production"`), aviso claro «Esto es la web
de pruebas: el enlace no le va a servir al dueño», y la URL visible entera en la ficha para
que se vea el dominio.

### M8 — `/login` sin salida para quien no puede entrar (MEDIO)

No hay «¿No puedes entrar?» con qué hacer (hoy: avisar a fiddle; mañana: enlace por email).
Tras un 429 el mensaje no dice si la contraseña era buena. No hay «Ver» para una contraseña
de 12 caracteres tecleada en un móvil (la invitación sí lo tiene). **Qué hacer:** enlace de
ayuda con el contacto de fiddle (una variable `CONTACTO_SOPORTE` o reutilizar
`CONTACTO_PRIVACIDAD`); botón «Ver»; y en 429, «Espera 15 minutos antes de volver a
probar; si no la recuerdas, …».

### M9 — Límite de intentos y alertas (MEDIO)

- La IP sale del primer valor de `x-forwarded-for` ([limitador.js:124](../src/lib/limitador.js)).
  En Vercel lo pone su borde, pero conviene **comprobarlo** (una petición con la cabecera
  puesta a mano) y, si se puede inyectar, usar `x-real-ip` o `request.ip`. El límite por
  tienda (100) es el respaldo.
- Un usuario de tienda inexistente devuelve 401 antes del límite y sin contar
  ([login/route.js:45](../src/app/api/login/route.js)): sirve para saber qué slugs existen
  (por tiempo de respuesta). Bajo riesgo; contar igual.
- Las alertas de fallos solo salen con `ALERTAS_URL`: **comprobar que está puesta en
  producción**; si no, nadie se entera de un ataque ni de que la caja lleva 40 fallos.

### M10 — Admins solo por variable (MEDIO)

`CLAVE_ADMIN_*` en Vercel: cambiarla exige redeploy, no hay segundo factor, la sesión de 12
h no se puede cortar sin rotar `AUTH_SECRET`, y `ADMINS` está en código
([auth.js:37](../src/lib/auth.js)). Está decidido que pasen a cuentas de persona; hasta
entonces, M2 (saber cuál) y M3 (poder cortar) son lo mínimo.

### Bajos

- **B1** Comentarios que hablan de «PIN» para el login ([limitador.js:7](../src/lib/limitador.js),
  `schema.sql` en `intentos`, `varPin` en `auth.js`): confunden ahora que hay PIN de verdad
  en la Plantilla. Renombrar en los comentarios; `varPin` se queda (compatibilidad).
- **B2** El placeholder del login es `delicanteria`, el slug de un cliente a la vista de
  cualquiera ([login/page.js:87](../src/app/login/page.js)). El título ya es el logo de fiddle
  (PR #27).
- **B3** scrypt con N=2^15 ([claves.js:22](../src/lib/claves.js)) está bien para hoy (OWASP
  sugiere 2^17); subirlo cuando haya sesiones en el servidor y menos comprobaciones. Sin
  comprobación contra contraseñas comunes ni contra el nombre de la tienda en las elegidas.
- **B4** No hay tests del handler `POST /api/invitacion` (solo de la lib), ni de `POST
  /api/login` (next, 429, cookie), ni de ninguna pantalla; no hay Playwright. `NEXT-STEPS`
  ya lo lista como pendiente.
- **B5** Vercel sirve `/login` y `/invitacion` como estáticas con
  `Access-Control-Allow-Origin: *`. No pasa nada (el HTML no lleva nada de nadie), pero que
  no sorprenda en una revisión.

---

## 5. Plan para los agentes

**Ramas, lo primero que hay que decidir.** `docs/ENTORNOS.md` y `CLAUDE.md` dicen que se
trabaja en `dev` y que `main` solo recibe el PR `dev → main`. En la práctica, desde el
13-10 los PRs van de ramas `feat/*` directas a `main` (#27 a #32) y `dev` se quedó 20
commits por detrás (solo lleva, además, este informe). Hasta que Victor y Diego lo zanjen:
rama propia desde `main` y PR contra `main`, en borrador, que es lo que deja un diff limpio;
si se vuelve a `dev`, primero traer `main` a `dev`. Antes de cada PR: `npm
test` y `npm run build`. Una ruta nueva de `/api` se clasifica en
`tests/aislamiento.test.js`. Una columna nueva va a `supabase/schema.sql` **y se aplica en
producción antes** de fusionar. Vercel Hobby solo despliega los commits de Víctor (si no,
CLI de Vercel). Nada se borra en la base sin preguntar. Textos en español, sin emojis.

**Lote 0 (hoy, sin código):** recuperar al manager como dice 3.3; correr las consultas de
3.2 y apuntar en `docs/INCIDENTES.md` (registro) qué pasó; comprobar `ALERTAS_URL` y
`appUrl` en `/admin` → Estado.

**Lote 1 (PR pequeño, lo primero que sube a producción):** A1, A2, A5 (1 y 2), A3, M1, M7,
M8. Son cambios acotados, sin columnas nuevas, y quitan de en medio todas las causas de
«el enlace no funcionó» que no sean la caducidad. Tests: los de cada hallazgo, más un test
del handler `/api/invitacion` (vale / incompleto / usado / caducado / anulado) y de `POST
/api/login` (destino, 401, 429, `b`+`next`).

**Lote 2 (PR con columna: `invitaciones.alcance`):** C1 completo (cambiar mi contraseña y
enlace solo manager), A4 (sesión deslizante o «mantener la sesión») con M3 (`iat`, versión
de sesión por tienda), M2, M4. Schema primero.

**Lote 3 (la Plantilla ya está en producción desde el PR #25):** M5, M6, B1. PR normal.

**Lote 4 (lo decidido en Cuentas):** Supabase Auth con email, recuperación por correo, caja
como dispositivo vinculado, sesiones en el servidor, cuentas de persona para Victor y
Diego. Lo de los lotes 1 a 3 tiene que seguir valiendo cuando llegue esto (p. ej. el
enlace de restablecimiento se convierte en el de Supabase; la versión de sesión, en la
sesión del servidor).

**Lo que NO hay que hacer:** poner el token de la invitación en la query; ningún interruptor
de accesos de prueba en producción; no «arreglar» las contraseñas de los admins desde el
código; no tocar `comprobarAcceso` sin su test espejo en `hashClave` (una normalización
distinta deja a alguien fuera); no mezclar un sistema de recuperación paralelo al de
Supabase Auth que luego haya que tirar.

---

## 6. Tests que faltan (resumen)

- `tests/invitacion-ruta.test.js`: `POST /api/invitacion` con `{token}` → 200 / 410 por
  cada motivo; con contraseñas → 200 + cookie, 400 por campo, 429 por límite; el enlace
  sigue vivo si falla `guardarAcceso` (M1); auditoría al aceptar.
- `tests/login-ruta.test.js`: `POST /api/login` → destino por rol, `next` de otra tienda
  ignorado, 401 cuenta como fallo, 429 al undécimo, tienda archivada 401, sin
  `AUTH_SECRET` en producción 503.
- `tests/acceso.test.js`: `usuarioSugerido(b, next)` (A2).
- `tests/accesos.test.js`: cambiar la propia contraseña del manager (C1); `generada` vs
  `elegida` (M4).
- `tests/sesion-vigente.test.js`: `iat` y versión de sesión (M3); sesión deslizante (A4).
- Playwright (ya pendiente en `NEXT-STEPS`): login → caja; invitación con recarga en el
  paso 2; caja bloqueada tras 10 fallos.

---

## Anexo A. Inventario

**Rutas de acceso:** `/login`, `/api/login` (GET demo, POST), `/api/logout`, `/invitacion`,
`/api/invitacion`, `/api/admin/invitacion`, `/api/admin/accesos` (GET estado, POST
generar), `/api/accesos/caja`, `/api/estado` (admin; `authSecret`, `appUrl`),
`/api/plantilla` y `/api/plantilla/quien` (PIN).

**Tablas:** `accesos (usuario pk, negocio, rol, hash, actualizado)`, `invitaciones (huella
pk, negocio, caduca, creado, usada)`, `intentos (clave, ts)`, `auditoria`,
`config.plantilla[].pin` (hash) y `eventos.empleado` (ya en la base de producción desde el
11-10).

**Variables:** `AUTH_SECRET` (obligatoria; firma sesiones, `quien`, huellas de IP y, si no
hay VAPID, las claves de push: rotarla echa a todos y obliga a reactivar avisos),
`CLAVE_ADMIN_VICTOR`, `CLAVE_ADMIN_DIEGO`, `CLAVE_<SLUG>_<ROL>` / `PIN_<SLUG>_<ROL>` (solo
sin fila en `accesos`), `APP_URL` (el enlace de invitación sale de aquí), `ALERTAS_URL`,
`CONTACTO_PRIVACIDAD`. En dev: `DATOS_DE_PRUEBA=1`, `DATA_DIR=/tmp/fiddle`, su propio
`AUTH_SECRET` y sus `CLAVE_*` (sin base, son la única contraseña).

**Pendiente de limpieza en Vercel** (ya en `NEXT-STEPS`): las `CLAVE_*`/`PIN_*` de Nube,
Fade y Forno.

## Anexo B. Lo que está bien (no tocar)

- Contraseñas solo como hash scrypt con sal; nunca en claro ni en logs; se enseñan una vez.
- Sesión HMAC con `igualSeguro`; cookie `httpOnly`, `SameSite=Lax`, `secure` en producción.
- Fallo cerrado: sin `AUTH_SECRET` en producción nadie entra; los accesos de prueba solo en
  local y sin `AUTH_SECRET` (`USUARIOS_DEMO` ya no se lee). Comprobado en producción:
  `{ demo: false }`.
- Cambiar una contraseña saca a quien estaba dentro (`sesionVigente`), también a una tienda
  archivada; si la base falla, vale la firma (decisión consciente: una caja sin poder
  entrar es peor).
- `filaDe`: una fila de `accesos` de otra tienda o rol no abre ni cierra nada;
  `slugDeTiendaLibre` impide tiendas que se llamen como un usuario.
- Aislamiento entre tiendas probado ruta a ruta (`aislamiento.test.js`), con lista cerrada
  de rutas: una nueva hace fallar el test hasta clasificarla.
- Límites persistidos en `intentos` (no en memoria), con huella de IP, no la IP.
- Invitación: token de 256 bits, huella en la base, un solo uso con actualización
  condicional (dos pestañas no la gastan dos veces), caducidad, anula las anteriores.
- `next` tras el login solo a rutas internas de la misma tienda (`destinoSeguro`).
- `/api/admin/*` exige admin también dentro del handler (`exigirAdmin`).
- RLS activado en todas las tablas; `service_role` solo en el servidor.
- CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy` estricta.
- El service worker no guarda las pantallas del personal.
