// ============================================================================
// PLANES: qué puede usar cada tienda según lo que paga
// ----------------------------------------------------------------------------
// Tres planes desde el 24-11-2026: **Gratis** (para siempre, hasta 50 tarjetas en
// uso y con todo), **Básico** (29 €, sin límite, con promociones y estadísticas) y
// **Pro** (49 €, sin límite y con todo). Antes hubo Esencial, Plus y Pro (y antes
// Tarjetas y Completo). Gratis lleva todo a propósito: que se enamoren de lo mejor;
// quien se queda corto elige si paga por el límite (Básico) o por todo (Pro).
// Lo que lleva cada uno NO está fijo en el código: lo cambia el admin en /admin → Planes y se guarda en la tabla `plataforma`
// (clave "planes"). Aquí solo está lo de partida y las reglas.
//
// - Cada tienda tiene su plan (`negocio.plan`, lo elige el admin en su ficha; el
//   alta sola desde la web, /alta, empieza en Gratis).
//   **Sin plan es Pro**, y también un plan que ya no existe (esencial, plus): una
//   tienda de antes no pierde nada por un despliegue. Básico es `basico` y no
//   reutiliza ninguno de esos: una tienda que estuviera en Plus no baja sola. La Delicantería va en Pro.
// - Un plan dice qué PUEDE encenderse, no qué está encendido: los avisos
//   automáticos y la plantilla siguen teniendo su interruptor en el admin
//   (`avisosAvanzados`, `plantillaActiva`), y el «Abierto hasta…» el suyo en
//   Ajustes. Lo que el plan no deja, no sale ni se manda, pero no se borra: con
//   otro plan, todo vuelve tal cual estaba.
// - Al leer la tienda, el store le pone `funciones` y `cupo` (`conPlan`). Lo que
//   depende del plan pregunta con `tiene(negocio, "promos")`, nunca mirando el
//   nombre del plan: los planes se pueden cambiar.
// - El límite cuenta las tarjetas EN USO (`contarTarjetas` del store): ni
//   borradas ni fusionadas, y tampoco las descartadas (nadie la guardó ni la usó
//   en su primer día, `UMBRALES.descartadaDias` de lib/crm.js): quien escanea y se
//   va no le quita sitio a nadie. Una tarjeta con puntos de alguien que lleva meses
//   sin venir SÍ cuenta: es de alguien. Se avisa al dueño al 90 % y al llegar; se
//   siguen dando hasta el límite más el `margen`, y entonces el cliente nuevo puede
//   apuntarse a la lista de espera (lib/listaDeEspera.js). Las tarjetas que ya
//   existen funcionan siempre, también las de una tienda gratis que nunca paga.
//
// Puro y sin imports del servidor: lo usan también las pantallas.
// ============================================================================

/** Lo que un plan puede llevar o no. El orden es el de la pantalla del admin. */
export const FUNCIONES = [
  { id: "estadisticas", nombre: "Estadísticas", texto: "Clientes → Resumen: el embudo, las gráficas y lo que dicen los números." },
  { id: "promos", nombre: "Promociones a todos", texto: "Avisos → Enviar a todos o «Todos, solo ese día». La promo de la tarjeta." },
  { id: "grupos", nombre: "Grupos y avisos a un grupo", texto: "Clientes → Grupos (en riesgo, a punto del premio…) y mandarle algo a uno." },
  { id: "avisosAvanzados", nombre: "Automáticos y programados", texto: "Se pueden encender en la ficha de la tienda." },
  { id: "plantilla", nombre: "Plantilla con PIN", texto: "Se puede encender en la ficha de la tienda." },
  { id: "abierto", nombre: "«Abierto hasta…»", texto: "En la tarjeta de Apple, Google y la web." },
  { id: "ubicacion", nombre: "Aviso al pasar cerca", texto: "El iPhone saca la tarjeta al pasar por la puerta." },
];
const IDS_FUNCION = FUNCIONES.map((f) => f.id);

export const IDS_PLAN = ["gratis", "basico", "pro"];
export const PLAN_POR_DEFECTO = "pro";
/** El de una tienda que se da de alta sola desde la web (/alta). */
export const PLAN_DEL_ALTA = "gratis";

const todas = (valor) => Object.fromEntries(IDS_FUNCION.map((id) => [id, valor]));

/**
 * Lo de partida (24-11-2026): Gratis y Pro con todo; Gratis, hasta 50 tarjetas en
 * uso y sin margen (pasado el límite está la lista de espera, no «unas cuantas
 * más»). Básico, sin límite y solo con promociones y estadísticas (lo del Plus de
 * antes).
 */
export const PLANES_DE_PARTIDA = {
  gratis: { nombre: "Gratis", maxTarjetas: 50, margen: 0, funciones: todas(true) },
  basico: { nombre: "Básico", maxTarjetas: null, margen: 0, funciones: { ...todas(false), estadisticas: true, promos: true } },
  pro: { nombre: "Pro", maxTarjetas: null, margen: 0, funciones: todas(true) },
};

export const MAX_LIMITE = 1_000_000;
const MAX_MARGEN = 10_000;

const entero = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** Lo guardado (puede faltar o venir mal) → los planes completos. Lo de un plan que ya no existe se ignora. */
export function normalizarPlanes(guardado) {
  const g = guardado && typeof guardado === "object" ? guardado : {};
  return Object.fromEntries(IDS_PLAN.map((id) => {
    const base = PLANES_DE_PARTIDA[id];
    const p = g[id] && typeof g[id] === "object" ? g[id] : {};
    const funciones = Object.fromEntries(IDS_FUNCION.map((f) => [f, typeof p.funciones?.[f] === "boolean" ? p.funciones[f] : base.funciones[f]]));
    // Sin límite = null guardado a propósito. Un 0 sería «ninguna tarjeta»: no se
    // admite, y lo que no se entiende se queda con el de partida.
    let maxTarjetas = base.maxTarjetas;
    if (Object.hasOwn(p, "maxTarjetas") && p.maxTarjetas === null) maxTarjetas = null;
    else if (entero(p.maxTarjetas, MAX_LIMITE) > 0) maxTarjetas = p.maxTarjetas;
    return [id, {
      id,
      nombre: base.nombre,
      maxTarjetas,
      margen: entero(p.margen, MAX_MARGEN) ?? base.margen,
      funciones,
    }];
  }));
}

/**
 * Lo que manda el admin → lo que se guarda, o `{error}`. Valida a mano en vez de
 * recortar: un límite mal escrito no puede dejar a una tienda sin tarjetas.
 */
export function validarPlanes(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object") return { error: "Faltan los planes" };
  const salida = {};
  for (const id of IDS_PLAN) {
    const p = cuerpo[id];
    if (!p || typeof p !== "object") return { error: `Falta el plan ${id}` };
    const max = p.maxTarjetas;
    if (max !== null && !(Number.isInteger(max) && max > 0 && max <= MAX_LIMITE)) {
      return { error: `${PLANES_DE_PARTIDA[id].nombre}: el límite de tarjetas tiene que ser un número entero mayor que 0, o sin límite` };
    }
    const margen = p.margen ?? 0;
    if (!(Number.isInteger(margen) && margen >= 0 && margen <= MAX_MARGEN)) {
      return { error: `${PLANES_DE_PARTIDA[id].nombre}: el margen tiene que ser un número entero de 0 a ${MAX_MARGEN}` };
    }
    const funciones = {};
    for (const f of IDS_FUNCION) {
      if (typeof p.funciones?.[f] !== "boolean") return { error: `${PLANES_DE_PARTIDA[id].nombre}: falta decir si lleva «${FUNCIONES.find((x) => x.id === f).nombre}»` };
      funciones[f] = p.funciones[f];
    }
    salida[id] = { maxTarjetas: max, margen: max === null ? 0 : margen, funciones };
  }
  return { planes: salida };
}

/** El plan guardado de la tienda, o el de por defecto si no tiene (o no vale). */
export const idDePlan = (plan) => (IDS_PLAN.includes(plan) ? plan : PLAN_POR_DEFECTO);

/**
 * La tienda con lo que le deja su plan: `planId`, `funciones` y `cupo` ({max, margen}
 * o null sin límite). No toca nada de lo guardado (`plan` sigue siendo lo que eligió
 * el admin, o null): así guardar la tienda no escribe lo que el plan esconde.
 */
export function conPlan(negocio, planes) {
  if (!negocio) return negocio;
  const p = normalizarPlanes(planes)[idDePlan(negocio.plan)];
  return {
    ...negocio,
    planId: p.id,
    funciones: p.funciones,
    cupo: p.maxTarjetas === null ? null : { max: p.maxTarjetas, margen: p.margen },
  };
}

/**
 * ¿La deja su plan? Sin `funciones` (una tienda que no pasó por el store, un test)
 * cuenta como Pro: ante la duda, no se quita nada a nadie.
 */
export const tiene = (negocio, funcion) => negocio?.funciones?.[funcion] !== false;

/** Los avisos automáticos y programados: encendidos por el admin Y que su plan los deje. */
export const conAvisosAvanzados = (negocio) => negocio?.avisosAvanzados === true && tiene(negocio, "avisosAvanzados");

/** «● Abierto hasta…» en la tarjeta: la tienda no lo apagó (Ajustes) Y su plan lo lleva. */
export const conAbierto = (negocio) => negocio?.tema?.abierto !== false && tiene(negocio, "abierto");

/** La promo de la tienda, si su plan deja promociones; si no, null (lo guardado se queda). */
export const promoDe = (negocio) => (tiene(negocio, "promos") ? negocio?.promo ?? null : null);

/**
 * Cómo va de tarjetas: `estado` "libre", "cerca" (90 %), "lleno" (llegó al límite,
 * se siguen dando con el margen) o "cerrado" (ya no se dan). Sin límite, null.
 */
export function cupoDe(negocio, emitidas) {
  const cupo = negocio?.cupo;
  if (!cupo) return null;
  const tope = cupo.max + cupo.margen;
  const estado = emitidas >= tope ? "cerrado" : emitidas >= cupo.max ? "lleno" : emitidas >= Math.ceil(cupo.max * 0.9) ? "cerca" : "libre";
  return { max: cupo.max, tope, emitidas, estado };
}

// Lo que lee el cliente si la tienda ya no puede dar tarjetas. Sin hablar de
// planes: eso es cosa del dueño, no de quien está en la cola. Debajo, la lista de
// espera (lib/listaDeEspera.js).
export const TEXTO_LLENA = "Ahora mismo no podemos darte la tarjeta. Déjanos tu correo y te la mandamos en cuanto podamos.";

/** ¿Se puede dar UNA tarjeta más? */
export const quedaCupo = (negocio, emitidas) => cupoDe(negocio, emitidas)?.estado !== "cerrado";

/**
 * El nombre del plan DE PAGO más barato que lleva esa función, para decir «va en el
 * plan X». Gratis no cuenta: lo lleva todo, y a quien no la tiene es porque paga uno
 * que no la lleva.
 */
export function planQueLoLleva(planes, funcion) {
  const p = normalizarPlanes(planes);
  return IDS_PLAN.filter((id) => id !== PLAN_DEL_ALTA).map((id) => p[id]).find((x) => x.funciones[funcion])?.nombre ?? null;
}
