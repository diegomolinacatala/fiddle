# La tarjeta del dueño

Un pase de Apple Wallet para el **dueño** de la tienda, no para sus clientes. Salió de la
reunión del 16-11-2026: una manera de hablarle al dueño sin que tenga que entrar en la web.
De momento es una prueba, con La Delicantería de dev.

Hace dos cosas:

- **El informe de la semana.** Cada lunes enseña la última semana entera (de lunes a
  domingo): visitas, clientes nuevos, premios dados y un dibujo con las visitas de cada día.
  El aviso en la pantalla de bloqueo es el propio informe («Semana del 9 al 15 nov: 142
  visitas (12 más que la anterior), 9 clientes nuevos y 6 premios dados.»).
- **Avisos para él.** Cuando «lo que dicen los números» tiene algo que se puede hacer hoy,
  la tarjeta se lo dice («Las tardes de martes viene menos gente. Te hemos preparado un
  aviso para hoy a las 16:00.») y el reverso lleva el enlace a Avisos → Enviar ya relleno.
  Nada sale solo hacia los clientes: el dueño entra, lo ve y decide.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Las cuentas de la semana | `src/lib/dueno/informe.js` |
| Qué aviso toca hoy | `src/lib/dueno/avisos.js` |
| Lo que enseña la tarjeta un día | `src/lib/dueno/estado.js` |
| Campos y `pass.json` | `src/lib/dueno/pase.js` |
| La banda, el icono y el logo | `src/lib/dueno/dibujo.js` |
| La firma | `src/lib/dueno/firmar.js` |
| Serial, token e iPhones registrados | `src/lib/dueno/tarjeta.js` |
| Leer el historial, empujar y el paso del reloj | `src/lib/dueno/servidor.js` |
| El web service de Apple | `src/lib/dueno/servicio.js` |
| La ruta (descarga, vista, prueba y web service) | `src/app/api/dueno/[...ruta]/route.js` |
| La fila de Ajustes | `src/app/[negocio]/ajustes/TarjetaDueno.js` |

Todo lo guarda la tienda en su configuración, en `tarjetaDueno`. No hay tabla nueva.

## Cuándo suena

Wallet solo avisa cuando un campo **cambia de valor** y la versión nueva lleva
`changeMessage`. Por eso:

- `semana` (cabecera) cambia cada lunes: su mensaje es el informe.
- `aviso` (a la derecha, bajo la banda) lleva el aviso con `changeMessage`. Cuando el
  aviso caduca (al acabar el día), el mismo campo vuelve a «PREMIOS DADOS» **sin**
  `changeMessage`: vuelve en silencio.
- Como mucho dos avisos a la semana, y el mismo no se repite en 14 días
  (`MAX_AVISOS_SEMANA`, `PAUSA_MISMO_AVISO_DIAS`).

El reloj (`/api/cron/avisos`) repasa la tarjeta una vez al día, a la hora de abrir (o a las
9:00 si ese día no abre). Sin reloj, la tarjeta se calcula al descargarla o al pedirla el
iPhone, pero nadie la empuja.

## Encenderla

Apagada de partida en todas las tiendas. Hoy solo la trae encendida la semilla de dev
(`lib/datosDePrueba.js`), con un serial y un token fijos (como el PIN 1234: en dev cada
función de Vercel tiene su `/tmp`). Para una tienda de verdad hace falta guardar
`tarjetaDueno = nuevaTarjeta(slug)` en su configuración: **todavía no hay botón en `/admin`**.

Con ella encendida, el dueño la añade desde **Ajustes → Tu tarjeta de dueño**.

## Probarla en dev

La web de dev está detrás del acceso de Vercel, así que **el iPhone no llega a su web
service**: la tarjeta se instala y se ve, pero no se actualiza sola ni recibe avisos. Para
probar los avisos de verdad hay dos caminos: quitar la protección de Vercel a la web de dev
(Vercel → Settings → Deployment Protection) o encenderla en producción para una tienda.

En local, con los certificados de `certs/apple.env` en `.env.local`, se puede firmar el pase
y llamar al web service a mano (ver `tests/dueno-servicio.test.js` para las llamadas).

Para mirar el dibujo sin firmar nada:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ver-tarjeta-dueno.mjs <carpeta>
```

## Lo que falta

- Un interruptor en `/admin/<slug>` para encenderla y para **cambiar el token** si el pase
  se pierde o se reenvía (hoy solo se puede a mano).
- Google Wallet y Android.
- Probarla en un iPhone: cómo coloca iOS la fila de dos campos y los enlaces del reverso.
- Decidir si es de un plan.
