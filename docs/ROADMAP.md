# Roadmap hasta el MVP

**Fecha:** 20-09-2026 · **Estado de partida:** 151 tests en verde, `npm run build`
limpio, en producción desde `main`.

El producto está hecho: pases firmados, actualizaciones por APNs, multi-tienda,
caja, manager, admin y temas modulares. Lo que falta para un MVP no son
funcionalidades, es la capa de operación que hace falta para meter en esto el
negocio de un desconocido.

Este documento dice qué bloquea, qué cuesta y en qué orden. Las tareas sueltas
del día a día siguen en [NEXT-STEPS.md](../NEXT-STEPS.md).

---

## Lo que de verdad bloquea

### 1. ✅ Las contraseñas de una tienda nueva son variables de entorno (hecho 23-09-2026: tabla `accesos`)

`claveDe()` en [`src/lib/auth.js`](../src/lib/auth.js) lee `CLAVE_<SLUG>_<ROL>` de
`process.env`. Creas la tienda en `/admin` en treinta segundos y no puede entrar
nadie hasta que alguien añada dos variables en Vercel y redespliegue. Así no se
pasa de las tiendas de amigos.

**Arreglo:** contraseñas en la base (hash con scrypt), generadas al crear la
tienda, enseñadas una sola vez y con botón de reset en `/admin`. Las variables de
entorno se quedan como respaldo solo para los admins de la plataforma. Toca
[`auth.js`](../src/lib/auth.js), [`store.js`](../src/lib/store.js),
[`schema.sql`](../supabase/schema.sql) y el alta del admin. **~5 h**

### 2. Cada tap crea un pase nuevo — resuelto a medias (21-09-2026)

El tap ya deja una cookie por tienda y el mismo teléfono recupera SU tarjeta al
volver a tocar el tag (en iPhone, iOS actualiza el pase en vez de duplicarlo).
Falta la otra mitad: quien **pierde el móvil** o borra las cookies no puede
recuperar sus sellos. Buscar cliente por nombre o código desde la caja y
reenviarle el enlace. **~4 h**

### 3. Android no tiene pase — resuelto (21-09-2026)

- **Tarjeta web** (`/p/<serial>`) armada con las mismas piezas que el pase de Apple
  (se acabó la maqueta paralela de tres estilos), instalable como app, que se pone
  al día sola y **avisa con notificaciones del navegador** (web push, probado
  contra FCM). Funciona sin credenciales nuevas.
- **Google Wallet** completo en el código: falta sacar las credenciales
  ([guía](GOOGLE-WALLET.md)). Mientras, el botón no sale.
- Caja con el lector nativo de Android, linterna y vibración; el manager graba tags
  NFC desde Chrome.

Detalle: [ANDROID.md](ANDROID.md).

### 4. Cero legal

No hay política de privacidad, ni aviso de cookies, ni condiciones, ni borrado de
un cliente concreto (se borran tiendas enteras, no personas). Se guarda nombre y
push token por cliente: es RGPD, y en cuanto la tienda no sea vuestra, ellos son
el responsable del tratamiento y nosotros el encargado.

**Mínimo:** página `/legal`, enlace desde `/p/<serial>` y desde la landing de cada
tienda, y borrar un cliente desde la caja. **~4 h + una decisión**

### 5. Nadie vigila

`/api/salud` existe y no lo mira nadie; no hay Sentry ni alertas. Supabase gratis
se pausa a los ~7 días sin actividad: una tienda tranquila se muere sola un lunes
y nos enteramos por el dueño.

**Arreglo:** cron de Vercel contra `/api/salud` con aviso cuando devuelva 503.
**~2 h**

### 6. Vercel Free es de uso no comercial

Y `USUARIOS_DEMO` sigue siendo un interruptor: mientras esté a `1` en producción,
`nube/nube` entra desde cualquier sitio. Eso se comprueba hoy, no en una fase.
Plan Pro antes de que lo use una tienda de verdad. **~30 min + dinero**

---

## Fases

### Fase 0 — esta semana, sin escribir código

Confirmar en un iPhone la notificación de promo y la de sello, grabar los tags
NFC, instalar la caja en el móvil de cada tienda y poner la ubicación. Sin esto
no sabemos qué estamos lanzando. Está en la lista
[**Ahora** de NEXT-STEPS.md](../NEXT-STEPS.md#ahora).

### Fase 1 — piloto cerrado: una tienda real que no sea nuestra

Los seis de arriba. **~3 días de trabajo.**

El listón son dos frases: que nadie tenga que tocar Vercel para que esa tienda
funcione, y que un cliente que pierde el móvil no pierda los sellos.

### Fase 2 — piloto abierto: 3-5 tiendas de pago

| Trabajo | Coste | Por qué |
|---|---|---|
| Métricas para el dueño | ~7 h | Visitas, canjes y clientes nuevos. Los datos ya están en `eventos`: faltan las consultas agregadas. Es lo que hace que un dueño quiera seguir pagando |
| Export CSV + copias de seguridad | ~3 h | Un `borrarNegocio` mal dado hoy no se deshace |
| Playwright del camino feliz | ~4 h | login → escanear → sellar → canjear |
| Badge oficial de Apple Wallet | ~1 h | Lo exigen sus identity guidelines para publicar |
| Quitar WalletWallet y `ww_serial` | ~1 h | Código muerto |

Si el piloto va bien, las métricas suben de prioridad por encima del resto.

### Fase 3 — después

Credenciales de Google Wallet y aprobación de Google (el código ya está), QR
rotativo anti-fraude, alta autoservicio y facturación.
Nada de esto bloquea cobrar a cinco tiendas a mano.

---

## Lo que dejamos fuera a propósito

- **QR rotativo.** Una captura se puede enseñar, pero sin sesión de caja no se
  puede actuar. Riesgo asumible con cinco tiendas.
- **Facturación automática.** Con menos de diez tiendas, se factura a mano.
- **Multi-empleado con usuario propio.** Hoy la caja es una contraseña compartida
  por tienda con sesión de 30 días. Vale para el piloto.
- **El límite de 200 clientes de `/api/clientes`:** la caja se carga la lista
  entera al abrir. Sobra para un piloto; hay que mirarlo antes de una tienda con
  miles de pases.

---

## Alarmas de calendario

- **17-10-2027:** caduca el certificado de Apple. Punto único de fallo para todas
  las tiendas (guía para renovarlo en
  [docs/APPLE-WALLET.md](APPLE-WALLET.md)).
