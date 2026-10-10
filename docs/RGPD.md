# RGPD: qué hay y qué falta

Una lista de RGPD hecha en otro chat (sin conocer el proyecto: hablaba de WalletWallet,
emails y cumpleaños), revisada punto por punto contra el código el 02-10-2026 y **hecha en
el código el 04-10-2026**. Aquí queda qué hace cada cosa, dónde vive, lo que sigue abierto
y dónde no seguimos la lista. Qué datos hay y cómo se cifran: [PRIVACIDAD.md](PRIVACIDAD.md).
Lo legal que no es código: la sección *Legal* de [NEXT-STEPS.md](../NEXT-STEPS.md). Si hay
una brecha: [INCIDENTES.md](INCIDENTES.md).

Es una lectura técnica, no de un abogado. Los puntos que dependen de cómo se interprete
la ley lo dicen.

**Estado:** el código está. Quedan los papeles (abajo), **encender el reloj** (sin él no se
borra nada solo) y que alguien que sepa de RGPD confirme 2.3 y 4.3.
`[x]` hecho; `[ ]` pendiente.

## Antes de desplegar

1. **`supabase/schema.sql` en Supabase** (columnas `promos_no`, `aviso_version`,
   `borrado_en`; tablas `borrados` y `auditoria`). Sin eso, producción da 500.
2. **El reloj encendido** ([AVISOS.md](AVISOS.md#encender-el-reloj-una-vez-lo-hace-fiddle)):
   hace la pasada diaria de borrados y las alertas.
3. `ALERTAS_URL` y `CONTACTO_PRIVACIDAD` en Vercel; los *Datos legales* de cada tienda en
   `/admin/<tienda>`.

## Dónde vive cada cosa

| Qué | Dónde |
|---|---|
| Plazos, versión del aviso, subencargados, datos legales | `src/lib/legal.js` |
| Promos sí/no, borrar, descargar (lo mismo para tienda y cliente) | `src/lib/derechos.js` |
| Quién toca una tarjeta sin login (llave o cookie) | `src/lib/gestion.js` |
| La pasada diaria (borrados, plazos, bajas de tiendas) | `src/lib/limpieza.js` |
| Registro de auditoría | `src/lib/auditoria.js`, tabla `auditoria` |
| La plantilla (nombre o apodo de cada empleado, en `config.plantilla`; quién dio cada sello, en `eventos.empleado`). Datos del personal de la tienda, no de clientes: solo el nombre de pila o un apodo, sin cifrar. La lista de nombres la ve la caja (para elegirse); quién dio cada sello, solo el manager y el admin. En la auditoría van ids, nunca nombres | `src/lib/plantilla.js` |
| Alertas | `src/lib/alertas.js` |
| La página del cliente | `/p/<serial>/datos` (`src/app/p/[serial]/datos/`) |

## Lo que la lista no sabía

- **WalletWallet ya no existe** (24-09): los pases los firmamos nosotros y Google va
  directo. Solo falta borrar la columna `ww_serial` (NEXT-STEPS).
- **No hay email, teléfono ni cumpleaños.** El único dato personal opcional es el nombre,
  más la nota de la tienda.
- **El nombre no va en ningún pase**: ni Apple ni, desde el 04-10, Google (antes salía como
  `accountName` y Google guardaba su copia; el objeto se manda entero, así que el siguiente
  cambio lo quita). Puede llegar a la pantalla de bloqueo con `{nombre}` en un aviso.
- **Los roles son `caja`, `manager` y `admin`**, y casi toda la sección de seguridad ya
  estaba hecha.

## 1. Datos y minimización

- [x] **1.1 Registro mínimo: id aleatorio + saldo + historial.** `serial` (uuid), `codigo`
  de 3 caracteres, saldo e historial en `eventos`. `visitas`, `ultima_visita`, `instalado`
  y `origen` resumen el comportamiento para el CRM.
- [x] **1.2 Campos opcionales apagados de partida.** Solo el nombre, y `pedirNombre` está
  apagado. No añadir email, teléfono ni cumpleaños: convertirían una cartilla seudónima en
  una base de contactos (consentimiento, verificación, LSSI).
- [x] **1.3 Para qué sirve cada dato, en la pantalla de la tienda.** Bajo «Pedir el nombre
  al escanear» (Tienda) y en el bloque *Privacidad de tus clientes* de Ajustes (9.2).
- [x] **1.4 Sin campos de texto libre.** La nota se queda (en el mostrador sirve), pero su
  ejemplo ya no es «Sin lactosa» y debajo dice «Nada de salud ni alergias. El cliente puede
  pedir leer esto.». Va en su descarga (3.2).
- [x] **1.5 Nunca la ubicación del cliente.** La relevancia del Wallet usa las coordenadas
  de la tienda. Lo único de red es la IP de los límites, como HMAC y borrada al día.
- [x] **1.6 En el pase, nada personal.** Ni nombre en Apple ni en Google. `{dias}` no está
  en ninguna sugerencia y su botón avisa de que sale en la pantalla de bloqueo.

## 2. Alta del cliente

- [x] **2.1 Aviso de privacidad con la config de la tienda.** `/privacidad?b=<slug>` dice
  la identidad legal de la tienda (`config.legal`: razón social, NIF, dirección, email; la
  pone el admin en `/admin/<slug>`), las tres bases legales, los plazos de verdad, el CRM
  por ritmo y los avisos automáticos (interés legítimo, no decisión automatizada del
  art. 22), los subencargados y los derechos. `VERSION_AVISO` es su versión.
- [x] **2.2 Aviso por capas.** Una línea bajo el botón de la landing («Guardamos tus sellos
  y te avisamos de sus promos. Privacidad»), y en la pantalla de la tarjeta lista.
- [x] **2.3 Promos: soft opt-in (LSSI 21.2), no casilla.** Decisión de Victor (04-10): promos
  de partida y, en la pantalla de la tarjeta lista, un botón **«Gestionar mi tarjeta»** que
  lleva a su página (dejar promos, descargar, borrar), con la frase «Te avisaremos de las
  promos de X. Puedes dejarlas cuando quieras». Ni casilla (un paso más para todos) ni un
  «no» escondido. **Pendiente: que lo confirme quien revise el RGPD.** Si dice
  consentimiento, es una casilla sin marcar con «tengo 14 años o más» que escriba
  `promos_no` al revés: la columna y todo el filtrado ya valen.
- [x] **2.6 Guardar el consentimiento.** `clientes.promos_no` (cuándo dijo que no; null =
  recibe) y `clientes.aviso_version` (el aviso que había al darse de alta). Cada cambio,
  un evento `promos_no` / `promos_si` con su `actor` (cliente, manager, admin).

2.4 y 2.5 (cumpleaños y puerta de edad): ver [No lo haríamos](#no-lo-haríamos-y-por-qué).

## 3. Derechos del cliente

- [x] **3.1 Buscar a un cliente.** Por nombre o código (en JS: el nombre va cifrado).
- [x] **3.2 Exportar sus datos.** «Descargar sus datos» en la ficha
  (`GET /api/crm/cliente/<serial>/datos`, solo manager, queda en `auditoria`) y «Descargar
  mis datos» en su página. Un JSON con la tarjeta, la nota, su historial entero, los
  avisos que recibió y sus canales (nunca tokens). `datosDeCliente` en `lib/derechos.js`.
- [x] **3.3 Borrar a un cliente, en dos tiempos.** Desde la ficha (confirmando su código) o
  desde su página. Al momento (`marcarBorrado`): sin nombre, nota ni mensaje, saldo a cero,
  `borrado_en`, y aviso: el pase de Apple baja `voided` con «TARJETA BORRADA», el objeto de
  Google pasa a `INACTIVE`. Al día siguiente, la pasada diaria (`purgarCliente`): la fila,
  las tarjetas fusionadas en ella, sus eventos, sus registros, los dispositivos que se
  quedan sin pases y sus `tarjetas_de_dispositivo`. Constancia en `borrados` sin datos
  personales. Una tarjeta con `borrado_en` no es un cliente para nadie: `listClientes`, la
  caja (410), el tap, `/p`, `/api/tarjeta`, la fusión y el registro del Wallet.
- [x] **3.4 Quitar las promos a un cliente.** Interruptor «Recibe promos» en su ficha.
- [x] **3.5 «Tu tarjeta y tus datos»** (`/p/<serial>/datos`): dejar las promos, descargar
  y borrar. Se llega desde el reverso del pase de Apple, los enlaces de Google, el pie de
  la tarjeta web y el botón de la landing. El serial no basta (va en el QR): hace falta la
  **llave** del pase (tras `#`, sale de su `auth_token` pero no es él) o la **cookie** del
  teléfono que la sacó (`lib/gestion.js`). Con cualquiera de las dos se puede todo,
  borrar incluido: la cookie es del teléfono que la sacó y la llave solo va en su pase.

## 4. Avisos

- [x] **4.1 Los cambios de la tarjeta llegan a todos.** Sellos y premios son servicio.
- [x] **4.2 Promos solo a quien no dijo que no, en el servidor.** Lo que escribe la tienda
  (promo, campañas, automáticos, programados) es promo:
  - **Apple:** `camposDelPase` deja fuera la promo y el mensaje con `promos_no`.
  - **Google:** la promo dejó de ser un mensaje de la CLASE (llegaba a todos): va en cada
    objeto, y `avisarObjeto` no le manda nada a quien no quiere. Una promo nueva son dos
    llamadas por tarjeta en vez de una por tienda; con cientos de tarjetas en Google, mirar
    el tiempo de la función.
  - **Web push:** `notificarNegocio` y `avisarSeriales` saltan a quien no quiere.
  - **Campañas y reglas:** se filtran antes de escribir (`perfil.avisable`), así «a cuántos
    le llegaría» dice el número de verdad; `guardarMensajes` hace de red.
  Tests en `tests/rgpd.test.js`.
- [x] **4.3 Cada promo dice cómo darse de baja.** El enlace de 3.5 va siempre en el reverso
  del pase, en los enlaces de Google y en el pie de la tarjeta web. **Confirmarlo junto con
  2.3**: en 120 caracteres de pantalla de bloqueo no cabe.

## 5. Plazos

- [x] **5.2 Borrar solos los clientes sin uso.** `lib/limpieza.js`, una vez al día en el
  reloj (`/api/cron/avisos`): 24 meses sin alta, visita ni instalación → borrado de 3.3
  (motivo `plazo`); los `eventos` y las `tarjetas_de_dispositivo` más viejos que eso, fuera.
  **Sin el reloj encendido no pasa nada de esto.**
- [x] **5.3 Bajas de Apple y Google: registro y token fuera.** Como antes.
- [ ] **5.4 Las copias tienen un plazo fijo.** No es código: el plazo de las copias de
  Supabase va en el contrato y en el registro de actividades. `/privacidad` lo dice.

5.1 (plazo elegido por cada tienda): ver [No lo haríamos](#no-lo-haríamos-y-por-qué).

## 6. Seguridad y tiendas separadas

- [x] **6.1 Cada tienda solo ve lo suyo, con tests.** `tests/aislamiento.test.js` llama a
  cada ruta del personal con la sesión de otra tienda y a cada ruta del admin con la de una
  tienda. Y lista todas las rutas de `/api`: una nueva hace fallar el test hasta que se dice
  de qué tipo es.
- [x] **6.2 Roles: la caja sella, no exporta ni borra.** Borrar y descargar, solo manager.
- [x] **6.3 HTTPS y cifrado en reposo.**
- [x] **6.4 Token por pase para el web service.**
- [x] **6.5 Secretos fuera del repo.**
- [x] **6.6 Límites en el alta y en el Wallet.** Y en la página del cliente (en memoria).
- [x] **6.7 Logs sin datos personales.** Con los dos matices de siempre (`errorInterno`
  escribe el error tal cual; los logs de Vercel guardan IPs): al registro de actividades.
- [x] **6.8 Registro de auditoría.** Tabla `auditoria` (ts, tienda, usuario, rol, acción,
  detalle sin datos personales): contraseñas, config (manager y admin, con las claves que
  cambiaron), archivar y borrar tiendas, borrar clientes, exportar la lista (el CSV se arma
  en el navegador y avisa a `/api/crm/exportar`) y descargar los datos de uno.
- [x] **6.9 El acceso del admin, apuntado.** Una fila cuando una sesión de admin abre
  Clientes, Tienda, Avisos, Ajustes o la ficha de caja de una tienda. **Pendiente:** la
  sesión del admin no dice si es victor o diego (firma la plataforma y el rol): sale
  «admin». Arreglarlo es cambiar el formato de la sesión. 2FA: NEXT-STEPS.

## 7. Cuando una tienda se va

- [x] **7.1 La tienda puede llevarse todos sus clientes.** Exportar en Clientes.
- [x] **7.2 Borrado completo a los 30 días de irse.** Archivar apunta `archivadoEn` (las
  archivadas de antes empiezan a contar en la próxima pasada). A los 30 días la pasada
  diaria anula todas sus tarjetas (Apple las baja anuladas aunque la tienda esté archivada;
  Google, `INACTIVE`) y, al día siguiente, borra la tienda entera. `borrarNegocio` ya no deja
  push tokens huérfanos ni el historial de las tarjetas fusionadas. `/admin` dice en cada
  archivada cuándo se borra.
- [x] **7.3 Constancia del borrado.** Tabla `borrados` (tienda, tipo, motivo, rol,
  cuántos, fecha), para clientes y tiendas.

## 8. Brechas

- [x] **8.1 Alertas.** `ALERTAS_URL` (ntfy, Slack o Discord). En cada pasada del reloj: 30
  o más contraseñas falladas en 15 minutos, o la base que no responde. Una del mismo tipo
  por hora. Lo que no puede vigilar: que el propio reloj se pare (eso lo dice la pantalla de
  Avisos, que mira su latido).
- [x] **8.2 Procedimiento de incidentes.** [INCIDENTES.md](INCIDENTES.md), con las consultas
  para saber el alcance. Falta decidir quién decide.
- [x] **8.3 Un email por tienda para avisar de una brecha.** `config.legal.email` (2.1).

## 9. Transparencia

- [x] **9.1 Subencargados con dónde están y su garantía.** Tabla en `/privacidad`, desde
  `SUBENCARGADOS` en `lib/legal.js`, con los servicios de avisos de cada navegador.
  Comprobar cada garantía en su DPA al firmarlo.
- [x] **9.2 En el panel de la tienda.** Bloque *Privacidad de tus clientes* en Ajustes: qué
  se guarda, el plazo, qué puede hacer cada cliente, si faltan sus datos legales y el
  botón a su aviso.

## No lo haríamos (y por qué)

- **2.4 Cumpleaños con consentimiento aparte.** No se recoge: junto al nombre es un
  identificador fuerte, y la racha y las visitas ya cubren «un detalle con los de siempre».
- **2.5 Puerta de edad (14+).** Con el *soft opt-in* no hay consentimiento que proteger. Si
  al final hay casilla, la edad va en su texto.
- **5.1 Plazo elegido por cada tienda.** Un plazo fijo de la plataforma (`MESES_SIN_USO`),
  en el contrato y en `/privacidad`.

## Encontrado de paso

- **Exportar invitaba a subir la lista a una IA** con nombres y notas: eso es pasar datos de
  clientes a otra empresa. Ahora dice que se quiten antes esas columnas.
- **`clienteDeTarjeta` mandaba el nombre al navegador** en `/p/<serial>` y
  `/api/tarjeta/<serial>`, que se abren con el serial (va en el QR), aunque la tarjeta web
  no lo enseñaba: con una foto del QR se leía. Quitado.
- **Un aviso con `{nombre}` deja el nombre en claro** en `campanas.texto` y
  `eventos.mensaje`, no solo en `clientes.mensaje` ([PRIVACIDAD.md](PRIVACIDAD.md)):
  poner `mensaje` a null (3.3) no basta para borrarlo.

## Papeles (no es código)

Casi todo está en la sección *Legal* de [NEXT-STEPS.md](../NEXT-STEPS.md); esto añade los
números que tiene que llevar el contrato.

- **Contrato de encargado del tratamiento (art. 28) con cada tienda**, con la plantilla de
  la AEPD. Que diga: 24 meses de plazo, borrado a los 30 días de irse, la lista de
  subencargados, cuándo se avisa de una brecha y lo decidido en 2.3.
- **DPA de Supabase y Vercel** aceptados, y 2FA en Supabase, Vercel, GitHub y Google.
- **`CONTACTO_PRIVACIDAD`** y **`ALERTAS_URL`** en Vercel; *Datos legales* de cada tienda.
- **Registro de actividades** como encargado (art. 30.2): una página, con los logs de
  Vercel y el plazo de las copias de Supabase.
- **Plan Pro de Vercel** antes de cobrar: el gratuito es de uso no comercial.
- **Revisión por alguien que sepa de RGPD** antes de pasar de unas pocas tiendas.
  Llevarle 2.3 y 4.3.
