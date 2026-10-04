# RGPD: lo que falta

Una lista de RGPD hecha en otro chat (sin conocer el proyecto: hablaba de WalletWallet,
emails y cumpleaños), revisada punto por punto contra el código el 02-10-2026. Aquí queda
qué está hecho, qué falta, cómo hacerlo y dónde no seguiríamos la lista. Qué datos hay y
cómo se cifran: [PRIVACIDAD.md](PRIVACIDAD.md). Lo legal que no es código: la sección
*Legal* de [NEXT-STEPS.md](../NEXT-STEPS.md).

Es una lectura técnica, no de un abogado. Los puntos que dependen de cómo se interprete
la ley lo dicen.

**Estado:** 15 hechos · 9 a medias · 12 por hacer · 3 que no haríamos · 2 que no son código.
`[x]` hecho; `[ ]` pendiente (los que están *a medias* dicen qué falta).

## Por dónde empezar

1. **Borrar un cliente** (3.3, con la constancia de 7.3). Es el único derecho que hoy
   solo se atiende a mano, en SQL. ~4 h
2. **Promos solo a quien no ha dicho que no**, en los tres canales (2.2, 2.3, 2.6, 3.4,
   4.2). Lo que más expone en cuanto una tienda de verdad mande una promo. Antes,
   confirmar 2.3. ~5 h
3. **Identidad legal y email de cada tienda** en `/privacidad` (2.1, 8.3), y
   `CONTACTO_PRIVACIDAD` en Vercel. ~2 h
4. **Plazos y baja de tiendas** con el reloj que ya existe (5.2, 7.2). Antes hay que
   encender el reloj. ~4 h
5. **Registro de auditoría**, entradas del admin incluidas (6.8, 6.9). ~3 h
6. **Lo pequeño:** ejemplo de la nota (1.4), exportar un cliente (3.2), bloque de
   privacidad en Ajustes (9.2), alertas (8.1), tabla de subencargados (9.1). ~4 h

Unas 22 h de código, más los papeles del final. Columna nueva: a `supabase/schema.sql`
antes que al código. Cambio en el store: en los dos backends.

## Lo que la lista no sabía

- **WalletWallet ya no existe** (24-09): los pases los firmamos nosotros y Google va
  directo. Solo falta borrar la columna `ww_serial` (NEXT-STEPS).
- **No hay email, teléfono ni cumpleaños.** El único dato personal opcional es el nombre,
  más la nota de la tienda.
- **El nombre no va en el pase de Apple.** Sale en Google (`accountName`) y puede llegar a
  la pantalla de bloqueo con `{nombre}` en un aviso.
- **Los roles son `caja`, `manager` y `admin`**, y casi toda la sección de seguridad ya
  está hecha.

## 1. Datos y minimización

- [x] **1.1 Registro mínimo: id aleatorio + saldo + historial.** `serial` (uuid), `codigo`
  de 3 caracteres, saldo en `sellos`/`sellos2`/`premios`/`guardados`/`guardados2` e
  historial en `eventos`. `visitas`, `ultima_visita`, `instalado` y `origen` resumen el
  comportamiento para el CRM; no identifican a nadie.
- [x] **1.2 Campos opcionales apagados de partida.** Solo existe el nombre, y
  `pedirNombre` está apagado salvo que valga `true` (`lib/negocios.js`). La caja puede
  apuntar un nombre después (`PUT /api/cliente/<serial>`): «apagado» quiere decir «no se
  pide al escanear». No añadir email, teléfono ni cumpleaños: convertirían una cartilla
  seudónima en una base de contactos (consentimiento, verificación, LSSI), y `/privacidad`
  presume de no pedirlos.
- [ ] **1.3 Para qué sirve cada dato, en la pantalla de la tienda.** *A medias:* el para
  qué del nombre y una base legal están en `/privacidad`; el dueño no lo ve en ningún
  sitio. **Cómo:** una línea bajo «Pedir el nombre al escanear» en Tienda («Para
  reconocerle en caja. Sale en Google Wallet, no en Apple. Va cifrado.») y el bloque de
  9.2. ~15 min
- [ ] **1.4 Sin campos de texto libre.** *A medias:* `clientes.nota` es texto libre (300
  caracteres), cifrado; lo escribe el manager y lo ve la caja. Su ejemplo dice «Sin
  lactosa» (`crm/Ficha.js`) y PRIVACIDAD.md usa el mismo: a un paso de una intolerancia,
  que es dato de salud (art. 9). **Cómo:** la nota se queda, que en el mostrador sirve.
  Cambiar el ejemplo («el del perro · siempre a primera hora») y poner debajo «Nada de
  salud ni alergias. El cliente puede pedir leer esto.». La nota va en su exportación
  (3.2). ~15 min
- [x] **1.5 Nunca la ubicación del cliente.** La relevancia del Wallet usa las coordenadas
  de la tienda (`ubicacionesApple`) y decide el teléfono. El mapa del manager solo busca
  la dirección de la tienda. Lo único de red es la IP de los límites, como HMAC y borrada
  al día.
- [x] **1.6 En el pase, nada personal salvo el nombre.** Apple no lleva nombre; Google,
  `accountName` si lo hay. Ojo: un aviso con `{nombre}` y `{dias}` deja «Marta, 21 días
  sin venir» en la pantalla de bloqueo. Cabe en la regla, pero quitaríamos `{dias}` de las
  sugerencias de partida: a quien ve el teléfono le dice más que el nombre.

## 2. Alta del cliente

- [ ] **2.1 Aviso de privacidad generado con la config de la tienda.** *A medias:*
  `/privacidad?b=<slug>` ya dice responsable y encargado, datos, fines, subencargados,
  cookies, derechos y la AEPD, y se enlaza desde la landing, la tarjeta web y el reverso
  del pase. Falta:
  - La tienda sale solo con su nombre comercial. El art. 13.1.a pide identidad y contacto
    (razón social, NIF, dirección o email).
  - `CONTACTO_PRIVACIDAD` sin poner: los derechos caen a «pídelo en la tienda».
  - El plazo dice «mientras siga en uso». Será un plazo de verdad con 5.2.
  - No cuenta que el CRM agrupa por ritmo de visitas ni los avisos automáticos. Van como
    interés legítimo (art. 6.1.f). No es una decisión automatizada del art. 22: no tiene
    efectos jurídicos ni parecidos.

  **Cómo:** `config.legal = { razonSocial, nif, direccion, email }`, solo para el admin en
  `/admin/<slug>`, relleno con el contrato firmado. `/privacidad` lo lee y el mismo email
  sirve para 8.3. Subir `ACTUALIZADO` cada vez que cambie el texto: es también la versión
  del aviso de 2.6. ~2 h
- [ ] **2.2 Aviso por capas: resumen + enlace.** *A medias:* la landing solo tiene
  «Privacidad» en el pie. **Cómo:** una línea bajo el botón, con los colores de la tienda:
  «Guardamos tus sellos y, si nos lo das, tu nombre. Privacidad». En el mostrador, pocas
  palabras; pero una línea donde se recogen los datos es lo mínimo. ~20 min
- [ ] **2.3 Promos: consentimiento aparte, casilla sin marcar.** Hoy nada: la promo, las
  campañas y los automáticos llegan a todos los que tienen el pase, y `/privacidad` lo
  mete todo en «el propio programa de fidelización».
  **Cómo (distinto de la lista):** no una casilla sin marcar, sino el *soft opt-in* del
  art. 21.2 de la LSSI: relación previa, avisos sobre productos propios parecidos y una
  forma sencilla y gratuita de decir que no al darse de alta y en cada aviso. En la
  práctica: una línea en el alta («Te avisaremos de promos de La Delicantería · No,
  gracias»), el indicador «sin promos» por tarjeta (2.6) y la baja a mano desde cada
  promo (4.3). Una casilla resta altas en el mostrador y cada promo llegaría a unos pocos.
  Si un cambio de campo del Wallet es una «comunicación electrónica» es discutible;
  tratarlo como tal es lo seguro. **Confirmarlo con quien revise el RGPD antes de
  hacerlo.** Si dice consentimiento: casilla sin marcar bajo el botón, con «tengo 14 años
  o más» en el texto (ver 2.5), guardada como en 2.6.
- [ ] **2.6 Guardar el consentimiento: quién, qué, versión del aviso, cuándo.** Va con
  2.3. **Cómo:** en `clientes`, `promos_no` (cuándo dijo que no; null = recibe promos) y
  `aviso_version` (el `ACTUALIZADO` que vio al darse de alta). Cada cambio, una fila en
  `eventos` (`promos_no` / `promos_si`, actor `cliente` o `manager`): el historial ya dice
  quién hizo qué, sin tabla nueva. ~45 min, dentro de 4.2

2.4 y 2.5 (cumpleaños y puerta de edad): ver [No lo haríamos](#no-lo-haríamos-y-por-qué).

## 3. Derechos del cliente

- [x] **3.1 Buscar a un cliente.** Clientes busca por nombre o código (en JS: el nombre va
  cifrado); la caja, por código o escaneando. `/privacidad` dice que el código basta para
  identificar la tarjeta. No hay email por el que buscar.
- [ ] **3.2 Exportar los datos de un cliente.** *A medias:* la exportación de Clientes es
  un CSV de lo que se ve (`lib/exportar.js`); buscando un código sale una fila, sin
  historial, sin avisos recibidos y sin canales. **Cómo:** «Descargar sus datos» en la
  ficha → `GET /api/crm/cliente/<serial>/datos`, solo manager. Un JSON con la tarjeta
  (código, saldo, fechas, nombre, nota), todos sus `eventos`, los avisos que recibió
  (`campanas` cuyos `seriales` lo incluyen) y sus canales (Apple, Google, web: cuántos y
  desde cuándo, nunca tokens). Para los arts. 15 y 20 basta el JSON; un CSV de una persona
  con su historial dentro no aporta. ~1,5 h
- [ ] **3.3 Borrar a un cliente** (ficha, tokens, registros de dispositivo y
  consentimiento; queda un apunte sin datos personales). Hoy, a mano en SQL. NEXT-STEPS
  decía ~1 h, pero un cliente está en cinco tablas y dos Wallets. **Cómo, en dos tiempos**,
  porque Apple descarga el pase nuevo después del aviso: si la fila ya no está, la tarjeta
  se queda congelada en el teléfono con pinta de válida.
  1. **Al momento:** `borrado_en`, `nombre`, `nota` y `mensaje` a null, saldo a cero, y
     aviso. El pase vuelve `voided` por el mismo camino que las tarjetas fusionadas
     (`fusionado_en` en `lib/apple/pase.js`), con un campo detrás que dice que se borró.
     En Google, el objeto a `INACTIVE` y sin `accountName`: Google guarda su propia copia
     del nombre.
  2. **Al día siguiente**, en la pasada diaria (5.2): la fila de `clientes` y las tarjetas
     fusionadas en ella (`fusionado_en = serial`), sus `eventos`, sus `registros` (caen en
     cascada), los `dispositivos` que se queden sin registros y las filas de
     `tarjetas_de_dispositivo` que apunten a ella.

  Una fila en una tabla `borrados` sin datos personales (tienda, motivo, rol de quién lo
  hizo, cuántos, fecha). `listClientes`, `/api/accion`, el tap y `/p` tratan `borrado_en`
  igual que `fusionado_en`. Los seriales que quedan en `campanas.seriales` ya no apuntan a
  nadie: se dejan. Botón en la ficha, solo manager, confirmando con el código. ~4 h con
  tests
- [ ] **3.4 Quitar las promos a un cliente.** **Cómo:** un `Interruptor` «Recibe promos»
  en la ficha, que escribe `promos_no` y su evento. Es el mismo indicador que toca el
  cliente en 3.5. ~30 min tras 2.6
- [ ] **3.5 Enlace para el cliente, en el reverso, para borrar o dejar las promos.**
  *A medias:* el reverso y la tarjeta web enlazan a `/privacidad`, que dice que se pida en
  la tienda. **Cómo:** una página «Tu tarjeta y tus datos» por tarjeta, con «No quiero
  promos», «Descargar mis datos» y «Borrar mi tarjeta», enlazada desde los `backFields` y
  el pie de la tarjeta web. Cuidado: el serial va en el QR (`/w/<serial>`), así que una
  foto de la tarjeta bastaría para llegar. Pedir el `auth_token` del pase (no sale en el
  QR) detrás de `#`, como el token de la invitación, o la cookie de la tarjeta que ya pone
  el tap. Dejar las promos vale con la cookie; borrar pide el token. Empezar por las
  promos: borrar uno mismo puede esperar, porque pedirlo en la tienda ya cumple el
  art. 17. ~3 h

## 4. Avisos

- [x] **4.1 Los cambios de la tarjeta (sellos, premios) llegan a todos.** El pase siempre
  se actualiza; qué suena en Android lo decide `avisoDeCambio` (`lib/avisos.js`).
- [ ] **4.2 Promos solo a quien las acepta, filtrado en el servidor.** Una tienda escribe a
  sus clientes por cuatro sitios: la promo (`negocio.promo`), las campañas
  (`/api/crm/campana`), los automáticos y los programados (`lib/motorAvisos.js`). Todos
  llegan a todos. **Cómo:** lo que hace la caja es del servicio; lo que escribe la tienda
  es promo. Y se filtra por canal:
  - **Apple:** `camposDelPase` deja fuera `negocio.promo` y `cliente.mensaje` con
    `promos_no`. El teléfono recibe el refresco, ningún campo visible cambia y no suena.
  - **Google:** hoy la promo es un mensaje de la CLASE (`construirClase`) y llega a todos
    los objetos. Pasarla a mensajes del objeto, solo para quien acepta promos, como ya va
    el «Para ti» de las campañas.
  - **Web push:** filtrar en `notificarNegocio` y `avisarSeriales` (`lib/wallet.js`).
  - **Campañas y reglas:** filtrar antes de `guardarMensajes`, para que «a cuántos le
    llegaría» en Avisos diga el número de verdad.

  Un test: un cliente con `promos_no` no recibe ninguna promo por ninguno de los tres
  canales. ~3 h
- [ ] **4.3 Cada promo dice cómo darse de baja.** En 120 caracteres de pantalla de bloqueo
  no cabe. Lo que sí cabe: el enlace de 3.5 siempre en el reverso del pase de Apple, en la
  tarjeta web, en el módulo de enlaces de la clase de Google y como página de destino del
  aviso web. Para un pase es una lectura razonable de «en cada comunicación»;
  **confirmarlo junto con 2.3**. ~30 min tras 3.5

## 5. Plazos

- [ ] **5.2 Borrar solos los clientes sin uso.** Hoy solo se limpia `intentos` (lo de más
  de un día). El reloj (`/api/cron/avisos`, lo llama `pg_cron`) existe pero sigue apagado.
  **Cómo:** una pasada al día en el mismo reloj, idempotente como las reglas. Quien lleve
  24 meses sin actividad (lo último de `ultima_visita`, `creado` e `instalado`) pasa por
  el borrado de 3.3. La misma pasada recorta los `eventos` más viejos que el plazo de los
  demás (el CRM lee 120 días) y las `tarjetas_de_dispositivo` cuya tarjeta ya no existe.
  Las cuentas, a `borrados`. ~2 h con 3.3 hecho
- [x] **5.3 Bajas de Apple y Google: registro y token fuera.** El `DELETE` de Apple borra
  el registro y el dispositivo cuando se queda sin ninguno (`borrarRegistro`); los tokens
  que APNs da por muertos se borran (`borrarDispositivosPorToken`); el web push tiene su
  `DELETE /api/push/<serial>` y limpia las suscripciones caducadas. De Google no guardamos
  token, así que no hay nada que borrar; sin su callback, el CRM no ve quién la quita de
  Google y nada más. `tarjetas_de_dispositivo` se queda a propósito, para devolver los
  sellos; 5.2 le pone límite.
- [ ] **5.4 Las copias tienen un plazo fijo.** No es código. Las copias diarias de Supabase
  caducan según el plan: poner ese plazo en el contrato y en el registro de actividades.
  Si algún día hay copia propia, con el mismo plazo corto, o los clientes borrados vuelven
  con ella.

5.1 (plazo elegido por cada tienda): ver [No lo haríamos](#no-lo-haríamos-y-por-qué).

## 6. Seguridad y tiendas separadas

- [x] **6.1 Cada tienda solo ve lo suyo, con tests.** Todo pasa por `exigirNegocio` →
  `puedeAcceder`; las API desconocidas fallan cerradas (`lib/acceso.js`); los códigos solo
  se buscan en la tienda de la sesión; RLS activado sin políticas. Tests en
  `auth.test.js` y `rutas-avisos.test.js`. **Añadir:** un test que llame a cada ruta de
  manager y caja con la sesión de otra tienda. Pilla la próxima ruta que se quede sin
  guardar. ~1 h
- [x] **6.2 Roles: la caja sella, no exporta ni borra.** `manager` y `caja` por tienda, más
  `admin`. Clientes, exportar, Avisos y contraseñas, solo manager. Borrar (3.3), también.
- [x] **6.3 HTTPS y cifrado en reposo.** HSTS de dos años y CSP (`next.config.mjs`);
  Supabase cifra disco y copias; nombre y nota van con AES-256-GCM atado a su serial y
  columna (`lib/cifrado.js`). En producción, sin `CIFRADO_CLAVE` no se guardan en claro.
- [x] **6.4 Token por pase para el web service.** `clientes.auth_token`, comprobado en cada
  llamada (`clienteAutenticado`) y nunca enviado al navegador.
- [x] **6.5 Secretos fuera del repo.** `certs/`, `.env.local` y `.data/` ignorados;
  contraseñas con scrypt en `accesos`; invitaciones guardadas como SHA-256.
- [x] **6.6 Límites en el alta y en el Wallet.** `lib/limitador.js`: login, tap, log del
  Wallet, push, Google e invitación. El registro del Wallet pide el token del pase.
- [x] **6.7 Logs sin datos personales.** Seriales y slugs, nunca nombres. Dos matices:
  `errorInterno` escribe el error tal cual (uno de la base puede llevar valores de la
  fila), y los logs de Vercel guardan IPs y URLs durante su plazo. Apuntarlo en el
  registro de actividades.
- [ ] **6.8 Registro de exportaciones, borrados y cambios de config (quién, cuándo).**
  *A medias:* `eventos.actor` dice quién tocó una tarjeta y `campanas` guarda cada envío.
  De exportaciones, contraseñas, config y borrados no queda nada. **Cómo:** una tabla
  `auditoria` (ts, negocio, usuario, rol, accion, detalle sin datos personales), escrita
  al cambiar una contraseña, en `saveNegocio` desde manager o admin, al archivar o borrar
  una tienda, al borrar un cliente y al exportar. Ojo: el CSV se arma en el navegador
  (`crm/PanelCrm.js`), así que el botón tiene que avisar a una ruta pequeña, o el CSV pasa
  al servidor. ~2 h
- [ ] **6.9 El acceso del admin, mínimo y apuntado.** `puedeAcceder` deja a victor y diego
  entrar en Clientes, caja y Ajustes de cualquier tienda, sin apunte. `/admin/crm` solo da
  totales, que es lo correcto. **Cómo:** una fila en `auditoria` cuando una sesión de admin
  carga una página de tienda en el servidor (`crm/page.js`, `manager/page.js`,
  `/w/<serial>`). 2FA en Supabase, Vercel, GitHub y Google (ya en NEXT-STEPS). Más
  adelante, si hace falta: el admin ve los nombres solo tras pulsar «Ver como la tienda».
  ~1 h tras 6.8

## 7. Cuando una tienda se va

- [x] **7.1 La tienda puede llevarse todos sus clientes.** Sin búsqueda ni grupo, Exportar
  en Clientes los baja todos en CSV. Sin el historial: si alguien lo pide, 3.2 en grande.
- [ ] **7.2 Borrado completo a los N días de irse (30 de partida).** *A medias:* `/admin`
  archiva (se esconde y se guarda todo) o borra para siempre escribiendo el slug
  (`borrarNegocio`). Falta:
  - Es a mano y nada lo recuerda, y `/privacidad` promete «si la tienda deja el servicio,
    sus datos se borran».
  - Los `dispositivos` que solo tenían registros de esa tienda se quedan con su push token:
    `registros` cae en cascada, `dispositivos` no.
  - Google se queda con la clase y los objetos, nombres incluidos.

  **Cómo:** `archivado_en` al archivar; la pasada diaria borra las archivadas hace 30 días
  o más (una constante, escrita en el contrato), después de anular sus pases y caducar sus
  objetos de Google. Arreglar los `dispositivos` huérfanos en `borrarNegocio`, en los dos
  backends. ~2 h
- [ ] **7.3 Constancia del borrado.** La tabla `borrados` de 3.3 sirve también para
  tiendas: slug, cuántos clientes, fecha, quién. Es el certificado de borrado que pedirá
  el contrato. Dentro de 3.3

## 8. Brechas

- [ ] **8.1 Alertas ante accesos raros o picos de fallos de login.** Los límites frenan,
  pero nadie se entera, y nadie mira `/api/salud` (ROADMAP, punto 5). **Cómo:** un webhook
  `ALERTAS_URL` (ntfy, Slack o Discord; sin proveedor de correo). Cada 15 min el reloj
  cuenta los `login:*` de `intentos`, mira `/api/salud` y su propio latido, y avisa al
  pasar de un umbral. Resuelve también el punto 5 del ROADMAP. ~1,5 h
- [ ] **8.2 Plantilla de incidentes; saber a quién afecta.** No es código. Los datos ya
  ayudan: todo va por `negocio`, así que «a quién afecta» es una consulta por tabla. Falta
  el procedimiento: un `docs/INCIDENTES.md` con las 72 h para avisar a la AEPD (art. 33),
  quién decide, el SQL para sacar tiendas y clientes afectados y una tabla de incidentes
  (fecha, qué, alcance, qué se hizo, a quién se avisó). ~1 h de escribir
- [ ] **8.3 Un email por tienda para avisar de una brecha.** Hoy la tienda tiene contacto
  para el cliente (teléfono, web, Instagram); el email del dueño de la invitación no se
  guarda, a propósito (`admin/Invitar.js`). **Cómo:** el `config.legal.email` de 2.1. Un
  campo, dos usos. Dentro de 2.1

## 9. Transparencia

- [ ] **9.1 Lista pública de subencargados, con dónde están.** *A medias:* `/privacidad`
  nombra Supabase (Londres), Vercel (Londres), Apple y Google, y cita la adecuación de
  Reino Unido. Falta: Vercel y Supabase son empresas de EE. UU., así que hay que decir la
  garantía de sus DPA (Data Privacy Framework o cláusulas tipo) junto a «Londres». Y el
  web push pasa por el servicio del navegador (Google en Chrome, Mozilla, Apple en Safari),
  que «Apple y Google» cubre a medias. Basta una tabla pequeña en la misma página. ~30 min
- [ ] **9.2 En el panel de la tienda: qué datos guarda y su aviso.** **Cómo:** un `Bloque`
  más en Ajustes, «Privacidad»: qué guarda esta tienda (sellos, historial, y nombre o
  notas si los usa), un botón que abre su `/privacidad?b=…` y el estado del contrato
  cuando el admin lo apunte. En Ajustes y no en Tienda porque es de la cuenta, no de la
  tarjeta. ~45 min

## No lo haríamos (y por qué)

- **2.4 Cumpleaños con consentimiento aparte.** No se recoge y no lo recogeríamos: junto
  al nombre es un identificador fuerte, y la racha y las visitas ya cubren «un detalle con
  los de siempre».
- **2.5 Puerta de edad (14+).** La edad importa donde la base es el consentimiento
  (art. 7 LOPDGDD). Con el *soft opt-in* de 2.3 no hay consentimiento que proteger, y una
  puerta obliga a todos los adultos a dar un paso más por un caso raro. Si al final hay
  casilla de consentimiento, la edad va en su texto y una línea en `/privacidad`.
- **5.1 Plazo elegido por cada tienda (6–24 meses).** Mejor un plazo fijo de la
  plataforma, en el contrato y en `/privacidad`; NEXT-STEPS ya propone 24 meses sin uso. Un
  selector por tienda es un ajuste que nadie toca y un número más que explicar en cada
  aviso. Si alguna tienda lo pide, entonces.

## Encontrado de paso

- **Google guarda el nombre** (`accountName`): borrar un cliente (3.3) o una tienda (7.2)
  tiene que limpiarlo también allí.
- **Un aviso con `{nombre}` deja el nombre en claro** en `campanas.texto` y
  `eventos.mensaje`, no solo en `clientes.mensaje` ([PRIVACIDAD.md](PRIVACIDAD.md)):
  poner `mensaje` a null (3.3) no basta para borrarlo.
- **`borrarNegocio` deja push tokens huérfanos** en `dispositivos` (7.2).
- **`tarjetas_de_dispositivo` no caduca nunca**, a propósito, para devolver sellos. Ata un
  id de teléfono a una tarjeta sin fin: que caiga con el plazo del cliente (5.2).
- **El ejemplo «Sin lactosa» de la nota** invita a apuntar datos de salud (1.4).
- **`/privacidad` promete borrar los datos cuando una tienda se va**, y hoy solo pasa si
  alguien se acuerda de pulsar (7.2).
- **La base legal es una sola línea** («el propio programa»). Llevar la tarjeta es
  contrato (art. 6.1.b); agrupar en el CRM y los automáticos, interés legítimo
  (art. 6.1.f); las promos, LSSI 21.2 o consentimiento (2.3). Decir las tres.

## Papeles (no es código)

Casi todo está ya en la sección *Legal* de [NEXT-STEPS.md](../NEXT-STEPS.md); esto añade los
números que tiene que llevar el contrato.

- **Contrato de encargado del tratamiento (art. 28) con cada tienda**, con la plantilla de
  la AEPD. Que diga: 24 meses de plazo, borrado a los 30 días de irse, la lista de
  subencargados, cuándo se avisa de una brecha y lo que se decida en 2.3.
- **DPA de Supabase y Vercel** aceptados, y 2FA en Supabase, Vercel, GitHub y Google.
- **`CONTACTO_PRIVACIDAD`** en Vercel.
- **Registro de actividades** como encargado (art. 30.2): una página, con los logs de
  Vercel y el plazo de las copias de Supabase.
- **Plan Pro de Vercel** antes de cobrar: el gratuito es de uso no comercial.
- **Revisión por alguien que sepa de RGPD** antes de pasar de unas pocas tiendas.
  Llevarle 2.3 y 4.3: son los dos puntos donde la respuesta depende de cómo se interprete
  la ley.
