# Avisos automáticos

Mensajes que la tienda deja programados y salen solos: *"a quien lleva 21 días sin
venir, a las 12:00, mándale «…»"*. El manager los ve, enciende, apaga y cambia en
**Avisos → Automáticos** sin tocar código: a quién, cuántos días, a qué hora, qué
días y qué dice. Si nunca entra, los de partida ya trabajan por él.

Código: [`src/lib/automatizaciones.js`](../src/lib/automatizaciones.js) (las reglas,
funciones puras), [`src/lib/horario.js`](../src/lib/horario.js) (cuándo abre la
tienda) y [`src/lib/motorAvisos.js`](../src/lib/motorAvisos.js) (el motor que manda).

---

## Encender el reloj (una vez, lo hace fiddle)

Los avisos los manda `/api/cron/avisos`, y alguien tiene que llamarlo cada 15
minutos. Hasta que no esté, la pantalla de Avisos lo dice en rojo y no sale nada
automático (el botón **Enviar ahora** de cada aviso sí funciona).

1. **Vercel → Settings → Environment Variables**: `CRON_SECRET` = una cadena larga
   y aleatoria (`openssl rand -hex 32`). Redesplegar. Sin ella el endpoint no hace
   nada (responde 503): cualquiera podría forzar envíos.
2. **El reloj**, una de las dos:

### Opción A — Supabase (gratis, vale con el plan Hobby de Vercel)

Supabase → **Database → Extensions**: activar `pg_cron` y `pg_net`. Después, en el
**SQL Editor** (cambiando el secreto y, si hace falta, la URL):

```sql
select cron.schedule(
  'avisos-automaticos',
  '*/15 * * * *',
  $$ select net.http_get(
       url := 'https://fiddle-zeta.vercel.app/api/cron/avisos',
       headers := jsonb_build_object('Authorization', 'Bearer PON-AQUI-EL-CRON_SECRET'),
       timeout_milliseconds := 30000
     ); $$
);
```

(Los 30 segundos son para la primera llamada tras un rato parado: por defecto
`pg_net` solo espera 5 y la daría por fallida aunque la web termine bien.)

- ¿Está pasando? `select * from cron.job_run_details order by start_time desc limit 5;`
  y la respuesta de la web: `select status_code, content from net._http_response order by created desc limit 5;`
- Quitarlo: `select cron.unschedule('avisos-automaticos');`
- De regalo, la base deja de dormirse a los 7 días sin uso (el reloj la toca cada 15 minutos).

### Opción B — Vercel Pro

Añadir a `vercel.json`:

```json
"crons": [{ "path": "/api/cron/avisos", "schedule": "*/15 * * * *" }]
```

Vercel manda solo la cabecera `Authorization: Bearer <CRON_SECRET>`.
**En el plan Hobby NO**: un cron de más de una vez al día hace fallar el despliegue.

### Comprobarlo

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://fiddle-zeta.vercel.app/api/cron/avisos
```

Devuelve qué mandó cada tienda. En **Avisos → Automáticos** pasa a verde:
*"Funcionando… último repaso hace N min"*.

---

## Cómo decide

Cada 15 minutos, por tienda, el motor:

1. **Quita los mensajes de un solo día que ya pasaron** (reglas con *"Quitarlo de la
   tarjeta al cerrar"*, como la promo de la racha): al cerrar, fuera. Solo a quien
   sigue teniendo ese texto: si luego le llegó otro, no se toca.
2. **Manda las reglas a las que les toca**, en el orden de la lista. Una regla toca:
   - un día que la tienda abre (`horario`: días de la semana y días cerrados),
   - si es uno de sus días (ninguno marcado = los que abre),
   - desde su hora (o desde que abre, si a esa hora aún no había abierto) y durante
     2 horas, siempre antes del cierre. Si el reloj pasa tarde de más, ese día no sale.

A cada cliente que encaja, **solo si**:

- tiene la tarjeta en un teléfono ahora (Wallet, avisos de Android o Google Wallet);
- no se le ha dicho **esa** regla desde su última visita (o, en la racha, desde que
  empezó la racha): una vez por ausencia, no cada día;
- no le llegó **ningún** aviso (automático o a mano) en los últimos `pausaAvisos`
  días (3 por defecto, se cambia en la pantalla);
- no le ha llegado ya otra regla en esta misma pasada (en el pase cabe un mensaje).

El envío es el de una campaña: el texto (con sus variables rellenas) se escribe en
`clientes.mensaje`, se avisa por todos los canales y queda una fila en `campanas`
con `grupo = "auto:<id de la regla>"`. Esa fila es la memoria: de ahí sale "ya se
lo dijimos", la pausa y el *"¿volvieron?"* de la pestaña Enviados. Por eso el motor
es idempotente y no hacen falta tablas nuevas.

Cuando el cliente vuelve, la caja **ve el mensaje** que trae en la tarjeta (*"En su
tarjeta pone…"*), y al sumar la visita se quita del pase, como siempre.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Las reglas de una tienda | `negocios.config.automatizaciones` (lista) |
| La pausa entre avisos | `negocios.config.pausaAvisos` (días) |
| El horario | `negocios.config.horario` = `{ zona, semana[7], cerrados[] }` |
| Lo enviado | tabla `campanas`, `grupo = "auto:<id>"` |
| El latido del reloj | tabla `intentos`, `clave = "reloj:avisos"` |

Una tienda que nunca ha tocado sus avisos usa los de su semilla (La Delicantería,
en [`negocios.js`](../src/lib/negocios.js)) o, si no tiene, los `PLANTILLAS` de
`automatizaciones.js`. En cuanto el manager guarda algo, manda lo guardado.

## Añadir un tipo de aviso nuevo

Una entrada en `DISPAROS` (`automatizaciones.js`): `label`, `icon`, `descripcion`,
`valor` (el número que el manager cambia, con su `min`/`max`/`def`/`unidad`, o un
grupo), `frase(valor)`, `incluye(contexto, valor)` y un texto de partida
(`sugerencia`). Sale solo en el selector de la pantalla y en el motor. Si necesita un
dato del cliente que el contexto no tiene, se añade en `contextoDe()`.

Cualquier grupo del CRM ya sirve sin tocar nada: el disparo **"Está en un grupo de
clientes"** usa `GRUPOS` de `lib/crm.js`.

Variables del texto: `{premio}`, `{faltan}` ("1 cookie", "2 cafés"), `{dias}`,
`{racha}`, `{nombre}` (si falta, se quita con su coma) y `{tienda}`. Una variable
nueva = una entrada en `VARIABLES` y su valor en `contextoDe()`.

## Los de La Delicantería

Salen de lo que se sabe de ella por internet (septiembre de 2026): café bistró en
Av. dels Tarongers 1, junto al campus; estudiantes y gente que teletrabaja; abre
**L–J 7:30–18:30 · V 7:30–16:30 · S 8:30–13:00**, domingo cerrado. **Hay que
confirmarlo con ellos** (horario y festivos se cambian en **Tienda → Horario**).

| Aviso | A quién | Cuándo |
|---|---|---|
| Premio a la racha | 4 días seguidos (días que abre) | al día siguiente, 8:00 (sábado, al abrir); se quita al cerrar |
| Premio sin recoger | cartilla completa o premio guardado, 3 días sin venir | 10:00 |
| A un paso del premio | a 1 sello, en cualquiera de las dos cartillas | 16:00, de lunes a jueves (merienda) |
| Te echamos de menos | 21 días sin venir | 12:00 |
| Segunda visita | vino una vez, 7 días sin volver | 9:00, de lunes a viernes |
| Tarjeta sin estrenar | la tiene hace 3 días y nunca la usó | 11:00, de lunes a viernes |

**La racha promete una cookie gratis.** Es la única que da algo que no está ya en su
tarjeta: confirmad con la tienda el regalo (o cambiad el texto) antes de encender el reloj.
