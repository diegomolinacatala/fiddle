// ============================================================================
// AVISOS AUTOMÁTICOS — las reglas
// ----------------------------------------------------------------------------
// Un aviso automático es una frase: "A quien lleva 21 días sin venir, a las
// 12:00, mandarle «…»". Cada tienda tiene su lista de reglas en su config (sin
// tablas nuevas) y el manager cambia cualquier pieza desde la pantalla: a quién,
// a qué hora, qué días y qué dice. Nada de esto necesita tocar código.
//
// Modular como los grupos del CRM: un DISPARO es una entrada en `DISPAROS` con
// su `incluye(contexto, valor)`. Añadir uno aquí = sale solo en el selector del
// manager, con su frase y su valor editable. Y el disparo `grupo` convierte
// cualquier grupo del CRM (lib/crm.js) en un aviso automático, sin más.
//
// Tres reglas que no se negocian, porque son las que evitan el spam:
//   1. Solo con la tienda abierta (lib/horario.js): si a esa hora aún no ha
//      abierto, sale al abrir; si ya ha cerrado, ese día no sale. Y una tienda
//      sin horario no manda nada solo (lo decide el motor).
//   2. Cada regla, una vez por ausencia: hasta que el cliente vuelve a pasar
//      por caja no se le repite lo mismo.
//   3. Una pausa entre avisos a la misma persona (`pausaAvisos`, 3 días), sean
//      automáticos o mandados a mano.
//
// Funciones PURAS: las usan el motor (lib/motorAvisos.js), la pantalla y los
// tests. El envío de verdad va por el mismo camino que una campaña: el texto se
// escribe en el pase de cada uno (Apple no tiene mensajes propios) y cada envío
// queda en `campanas` con el grupo `auto:<id>`, que es lo que responde a "¿ya
// se lo dijimos?" y "¿volvió?".
// ============================================================================

import { GRUPOS, LISTA_GRUPOS, esGrupo } from "./crm";
import { cartillasDe } from "./cartillas";
import { singular } from "./acciones";
import {
  DIAS, aMinutos, aHora, horaCorta, esHora, relojLocal, fechaLocal, tramoDe, sumarDias, diaDeFecha, rachaDe, cuandoTexto,
  inicioDelDia, cierreTras,
} from "./horario";

const DIA = 24 * 60 * 60 * 1000;

export const MAX_TEXTO = 120;      // lo mismo que una campaña: una línea en la pantalla de bloqueo
export const MAX_REGLAS = 12;
export const MAX_POR_REGLA = 400;  // tope por envío, como las campañas (tiempo de una función serverless)
export const PAUSA_POR_DEFECTO = 3;
export const MAX_PAUSA = 30;
// Si el reloj llega tarde más de esto, ese día ya no sale: un "¿merienda?" a
// las 20:00 no es lo que se programó.
export const VENTANA_MIN = 120;

const GRUPO_AUTO = "auto:";
export const grupoDeRegla = (id) => `${GRUPO_AUTO}${id}`;
/** "auto:racha" -> "racha"; un grupo del CRM -> null. */
export const reglaDeGrupo = (g) => (typeof g === "string" && g.startsWith(GRUPO_AUTO) ? g.slice(GRUPO_AUTO.length) : null);

// ------------------------------------------------------------------ disparos
// `valor`: el número (o el grupo) que el manager cambia en la frase.
// `desde(x)`: desde cuándo cuenta "ya se lo dijimos". Por defecto, su última
// visita: lo que se le dijo antes de volver ya no cuenta.
export const DISPAROS = {
  racha: {
    label: "Viene varios días seguidos",
    icon: "llama",
    descripcion: "Ha venido los últimos días que la tienda abrió, sin saltarse ninguno. Le llega a la mañana siguiente, antes de volver.",
    valor: { tipo: "numero", min: 2, max: 10, def: 4, unidad: "días seguidos" },
    frase: (v) => `ha venido ${v} días seguidos`,
    // Una vez por racha: si sigue viniendo, no se le repite cada mañana.
    incluye: (x, v) => x.racha >= v && !x.vinoHoy,
    desde: (x) => x.inicioRacha,
    sugerencia: "{racha} días seguidos viniendo: hoy tienes un detalle esperándote en caja.",
    caduca: true,
  },
  premio_listo: {
    label: "Tiene un premio sin recoger",
    icon: "regalo",
    descripcion: "Completó una cartilla (o se guardó el premio) y no ha vuelto a por él.",
    valor: { tipo: "numero", min: 0, max: 60, def: 3, unidad: "días sin venir" },
    frase: (v) => (v ? `tiene un premio sin recoger y lleva ${v} días sin venir` : "tiene un premio sin recoger"),
    incluye: (x, v) => x.pendiente && (x.perfil.diasSinVenir ?? 0) >= v,
    sugerencia: "Tu {premio} te está esperando en la barra. Pásate cuando quieras.",
  },
  cerca_premio: {
    label: "Está a punto de conseguir el premio",
    icon: "diana",
    descripcion: "Le faltan muy pocos sellos. Con dos cartillas, cuenta la que tenga más cerca.",
    valor: { tipo: "numero", min: 1, max: 5, def: 1, unidad: "sellos o menos" },
    frase: (v) => (v === 1 ? "está a 1 sello del premio" : `está a ${v} sellos o menos del premio`),
    incluye: (x, v) => x.perfil.visitas > 0 && Boolean(x.cercana) && x.cercana.faltan <= v,
    sugerencia: "Estás a {faltan} de tu {premio}. ¿Te pasas hoy?",
  },
  sin_venir: {
    label: "Lleva tiempo sin venir",
    icon: "reloj",
    descripcion: "Ya había venido alguna vez y lleva esos días sin pasar por caja.",
    valor: { tipo: "numero", min: 3, max: 180, def: 21, unidad: "días" },
    frase: (v) => `lleva ${v} días sin venir`,
    incluye: (x, v) => x.perfil.visitas > 0 && (x.perfil.diasSinVenir ?? 0) >= v,
    sugerencia: "Hace tiempo que no te vemos. Tu tarjeta sigue aquí, con tus sellos.",
  },
  segunda_visita: {
    label: "Vino una vez y no ha vuelto",
    icon: "clientes",
    descripcion: "Primera visita hecha y ninguna más. La segunda es la que crea la costumbre.",
    valor: { tipo: "numero", min: 2, max: 60, def: 7, unidad: "días" },
    frase: (v) => `vino una sola vez y no ha vuelto en ${v} días`,
    incluye: (x, v) => x.perfil.visitas === 1 && (x.perfil.diasSinVenir ?? 0) >= v,
    sugerencia: "¿Repetimos? Cada visita suma en tu tarjeta.",
  },
  sin_estrenar: {
    label: "Tiene la tarjeta sin estrenar",
    icon: "cartera",
    descripcion: "Se llevó la tarjeta al teléfono pero nunca la ha enseñado en caja.",
    valor: { tipo: "numero", min: 1, max: 60, def: 3, unidad: "días" },
    frase: (v) => `tiene la tarjeta desde hace ${v} días y aún no la ha usado`,
    incluye: (x, v) => x.perfil.visitas === 0 && (x.perfil.diasDesdeAlta ?? 0) >= v,
    sugerencia: "Tu tarjeta ya está lista: enséñala en caja y empieza a sumar.",
  },
  grupo: {
    label: "Está en un grupo de clientes",
    icon: "clientes",
    descripcion: "Cualquiera de los grupos de la pestaña Clientes.",
    valor: { tipo: "grupo", def: "fieles_frios" },
    frase: (v) => `está en «${GRUPOS[v]?.label || v}»`,
    incluye: (x, v) => esGrupo(v) && GRUPOS[v].incluye(x.perfil),
    sugerencia: "Hace tiempo que no te vemos. En tu próxima visita tienes un detalle.",
  },
};

export const LISTA_DISPAROS = Object.entries(DISPAROS).map(([key, d]) => ({
  key, label: d.label, icon: d.icon, descripcion: d.descripcion, valor: d.valor, sugerencia: d.sugerencia, caduca: Boolean(d.caduca),
}));

export const esDisparo = (k) => typeof k === "string" && Object.hasOwn(DISPAROS, k);

// ----------------------------------------------------------------- variables
// Lo que se puede meter en el texto entre llaves. Cada cliente recibe el suyo.
export const VARIABLES = [
  { clave: "premio", ejemplo: "cookie gratis", ayuda: "el premio que tiene más cerca" },
  { clave: "faltan", ejemplo: "1 cookie", ayuda: "lo que le falta para ese premio" },
  { clave: "dias", ejemplo: "21", ayuda: "días que lleva sin venir" },
  { clave: "racha", ejemplo: "4", ayuda: "días seguidos que ha venido" },
  { clave: "nombre", ejemplo: "Marta", ayuda: "su nombre, si la caja lo apuntó (si no, se quita solo)" },
  { clave: "tienda", ejemplo: "La Delicantería", ayuda: "el nombre de la tienda" },
];
const CLAVES_VARIABLE = new Set(VARIABLES.map((v) => v.clave));

/** Variables escritas en el texto que no existen ("{premo}"): se avisan antes de guardar. */
export const variablesDesconocidas = (texto) =>
  [...String(texto || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => !CLAVES_VARIABLE.has(k));

/**
 * Rellena las variables y deja la frase bien escrita aunque falte alguna: sin
 * nombre, "{nombre}, te falta 1" queda "Te falta 1", no ", te falta 1".
 */
export function renderTexto(plantilla, vars = {}) {
  const lleno = String(plantilla || "").replace(/\{(\w+)\}/g, (todo, k) => (Object.hasOwn(vars, k) ? String(vars[k] ?? "") : todo));
  const limpio = lleno
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([¡¿])\s+/g, "$1")
    .replace(/^[\s,;:.]+/, "")
    .replace(/,([.!?])/g, "$1")
    .trim()
    .replace(/^([¡¿]?)(\p{Ll})/u, (_, signo, letra) => signo + letra.toUpperCase());
  return limpio.length > MAX_TEXTO ? `${limpio.slice(0, MAX_TEXTO - 1).trimEnd()}…` : limpio;
}

// ------------------------------------------------------------------ contexto
/** La cartilla sin completar a la que menos le falta (null si no hay ninguna a medias). */
function cartillaCercana(cliente, negocio) {
  if (negocio?.tipo === "descuento") return null;
  return cartillasDe(cliente, negocio)
    .filter((c) => !c.completa && c.faltan > 0)
    .reduce((mejor, c) => (!mejor || c.faltan < mejor.faltan ? c : mejor), null);
}

/** "1 cookie", "2 cafés", "3 sellos": lo que le falta, con la palabra de su cartilla. */
function faltanTexto(c, negocio) {
  if (!c) return "";
  const palabra = negocio?.cartillas ? c.nombre.toLowerCase() : "sellos";
  return `${c.faltan} ${c.faltan === 1 ? singular(palabra) : palabra}`;
}

/**
 * Todo lo que las reglas preguntan de un cliente, calculado una vez.
 * @param {object} cliente fila de `clientes`
 * @param {object} perfil  de perfilDe() (lib/crm.js), con `contactable` ya cruzado con los registros
 * @param {object} negocio ficha del negocio (con horario)
 * @param {{fechas?:Set<string>, hoy:string}} extra días (locales) con visita, para las rachas
 */
export function contextoDe(cliente, perfil, negocio, { fechas = new Set(), hoy }) {
  const esCupon = negocio?.tipo === "descuento";
  const cartillas = esCupon ? [] : cartillasDe(cliente, negocio);
  const conPremio = cartillas.find((c) => c.completa || c.guardados > 0) || null;
  const cercana = cartillaCercana(cliente, negocio);
  const { racha, inicio } = rachaDe(fechas, negocio?.horario ?? null, hoy);
  const nombre = String(cliente.nombre || "").trim().split(/\s+/)[0] || "";
  return {
    serial: cliente.serial,
    perfil,
    cercana,
    pendiente: Boolean(conPremio),
    racha,
    inicioRacha: inicio ? inicioDelDia(inicio, negocio?.horario?.zona) : 0,
    vinoHoy: fechas.has(hoy),
    desde: Date.parse(cliente.ultima_visita || cliente.creado || "") || 0,
    // Su cartilla tal cual, para que la vista previa del manager pinte el mismo pase que el texto.
    saldo: {
      sellos: cliente.sellos || 0, sellos2: cliente.sellos2 || 0, premios: cliente.premios || 0,
      guardados: cliente.guardados || 0, guardados2: cliente.guardados2 || 0,
    },
    vars: {
      premio: (conPremio || cercana)?.premio ?? negocio?.premio ?? "",
      faltan: faltanTexto(cercana, negocio),
      dias: perfil.diasSinVenir === null || perfil.diasSinVenir === undefined ? "" : String(Math.floor(perfil.diasSinVenir)),
      racha: String(racha),
      nombre,
      tienda: negocio?.nombre ?? "",
    },
  };
}

/** Días (fecha local de la tienda) en los que vino cada cliente, desde el historial. */
export function fechasDeVisita(eventos, tiposVisita, zona) {
  const porSerial = new Map();
  for (const e of eventos) {
    if (!tiposVisita.includes(e.tipo)) continue;
    const t = Date.parse(e.ts);
    if (!t) continue;
    if (!porSerial.has(e.serial)) porSerial.set(e.serial, new Set());
    porSerial.get(e.serial).add(fechaLocal(t, zona));
  }
  return porSerial;
}

// ----------------------------------------------------------------- historial
/**
 * Qué se le dijo a quién y cuándo, a partir de las campañas guardadas.
 * `porRegla`: "<regla>|<serial>" -> último envío de esa regla a ese cliente.
 * `ultimo`: serial -> último aviso de cualquier tipo (para la pausa).
 */
export function enviosDe(campanas) {
  const porRegla = new Map();
  const ultimo = new Map();
  for (const c of campanas || []) {
    const t = Date.parse(c.creado);
    if (!t) continue;
    const regla = reglaDeGrupo(c.grupo);
    for (const s of c.seriales || []) {
      if ((ultimo.get(s) ?? 0) < t) ultimo.set(s, t);
      if (regla && (porRegla.get(`${regla}|${s}`) ?? 0) < t) porRegla.set(`${regla}|${s}`, t);
    }
  }
  return { porRegla, ultimo };
}

/** Copia del historial con un envío más (el motor lo usa para no repetir en la misma pasada). */
export function conEnvio(envios, reglaId, seriales, t) {
  const porRegla = new Map(envios.porRegla);
  const ultimo = new Map(envios.ultimo);
  for (const s of seriales) {
    porRegla.set(`${reglaId}|${s}`, t);
    ultimo.set(s, t);
  }
  return { porRegla, ultimo };
}

const SIN_ENVIOS = { porRegla: new Map(), ultimo: new Map() };

/** Los que cumplen la condición de la regla, se les pueda avisar o no. */
export function candidatos(regla, contextos) {
  const d = DISPAROS[regla.disparo];
  return d ? contextos.filter((x) => d.incluye(x, regla.valor)) : [];
}

/**
 * A quién le llega la regla AHORA: cumple la condición, tiene la tarjeta en el
 * teléfono, no se le ha dicho ya desde su última visita (o desde que empezó la
 * racha) y no ha recibido otro aviso hace menos de `pausaDias`.
 */
export function elegibles(regla, contextos, envios = SIN_ENVIOS, { ahora = Date.now(), pausaDias = PAUSA_POR_DEFECTO } = {}) {
  const d = DISPAROS[regla.disparo];
  if (!d) return [];
  const pausaMs = pausaDias * DIA;
  return candidatos(regla, contextos).filter((x) => {
    if (!x.perfil.contactable) return false;
    const ya = envios.porRegla.get(`${regla.id}|${x.serial}`);
    if (ya && ya >= (d.desde ? d.desde(x) : x.desde)) return false;
    const ultimo = envios.ultimo.get(x.serial);
    return !(pausaMs > 0 && ultimo && ahora - ultimo < pausaMs);
  });
}

// ------------------------------------------------------------------- el reloj
/**
 * A qué minuto del día `fecha` sale la regla, o null si ese día no sale: no es
 * uno de sus días, la tienda cierra, o a esa hora ya ha cerrado. Si aún no ha
 * abierto, sale al abrir.
 */
export function momentoDelDia(regla, horario, fecha) {
  if (regla.dias?.length && !regla.dias.includes(diaDeFecha(fecha))) return null;
  const tramo = tramoDe(horario, fecha);
  if (!tramo) return null;
  const m = Math.max(aMinutos(regla.hora) ?? 0, tramo.abre);
  return m < tramo.cierra ? m : null;
}

/** ¿Le toca salir en este repaso? Desde su hora y durante la ventana, con la tienda abierta. */
export function tocaAhora(regla, horario, reloj) {
  const m = momentoDelDia(regla, horario, reloj.fecha);
  if (m === null) return false;
  const cierra = tramoDe(horario, reloj.fecha).cierra;
  return reloj.minutos >= m && reloj.minutos < Math.min(m + VENTANA_MIN, cierra);
}

/**
 * La próxima vez que saldrá, para la pantalla: {fecha, hora, texto} o null si
 * en las dos próximas semanas no sale nunca (días marcados que la tienda cierra).
 */
export function proximoEnvio(regla, horario, ahora = Date.now()) {
  if (!regla.activa) return null;
  const reloj = relojLocal(ahora, horario?.zona);
  for (let i = 0; i < 15; i += 1) {
    const fecha = sumarDias(reloj.fecha, i);
    const m = momentoDelDia(regla, horario, fecha);
    if (m === null || (i === 0 && m + VENTANA_MIN <= reloj.minutos)) continue;
    const hora = horaCorta(aHora(m));
    const enCurso = i === 0 && m <= reloj.minutos;
    return { fecha, hora, texto: enCurso ? `hoy desde las ${hora}` : `${cuandoTexto(fecha, reloj.fecha)} a las ${hora}` };
  }
  return null;
}

/**
 * Mensajes de un solo día (reglas con `caduca`) que ya hay que quitar: los que
 * ya han pasado por un cierre de la tienda (el primero después de mandarlos:
 * uno mandado a mano un domingo dura hasta que cierre el lunes). Solo a quien
 * sigue teniendo ESE texto en el pase: si luego le llegó otro, no se toca.
 *
 * Sin `mensajes` (null) responde solo por la fecha: el motor lo pregunta así
 * antes de cargar a los clientes, para no leer la base cada noche por nada.
 * @param {Map<string,string|null>|null} mensajes serial -> mensaje actual del pase
 * @returns {{texto:string, seriales:string[]}[]}
 */
export function porRetirar(campanas, reglas, mensajes, horario, ahora = Date.now()) {
  const caducan = new Set(reglas.filter((r) => r.caduca).map((r) => r.id));
  if (!caducan.size) return [];
  const reloj = relojLocal(ahora, horario?.zona);
  const out = [];
  for (const c of campanas || []) {
    const id = reglaDeGrupo(c.grupo);
    const t = Date.parse(c.creado);
    // Una semana basta: lo de antes ya se quitó, o el cliente vino y se borró solo.
    if (!id || !caducan.has(id) || !t || ahora - t > 7 * DIA) continue;
    const cierre = cierreTras(horario, t);
    if (reloj.fecha < cierre.fecha || (reloj.fecha === cierre.fecha && reloj.minutos < cierre.minutos)) continue;
    const seriales = (c.seriales || []).filter((s) => !mensajes || mensajes.get(s) === c.texto);
    if (seriales.length) out.push({ texto: c.texto, seriales });
  }
  return out;
}

// --------------------------------------------------------------- las frases
/** "los días que abre", "de lunes a jueves", "lunes, miércoles y viernes". */
export function diasTexto(dias) {
  if (!dias?.length) return "los días que abre";
  if (dias.length === 7) return "todos los días";
  const orden = [...dias].sort((a, b) => a - b);
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1);
  if (seguidos && orden.length > 2) return `de ${DIAS[orden[0]]} a ${DIAS[orden.at(-1)]}`;
  const nombres = orden.map((d) => DIAS[d]);
  return nombres.length === 1 ? `los ${nombres[0]}${nombres[0].endsWith("s") ? "" : "s"}` : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/** La regla dicha en castellano, en dos trozos: a quién y cuándo. */
export function fraseRegla(regla) {
  const d = DISPAROS[regla.disparo];
  return {
    quien: `A quien ${d ? d.frase(regla.valor) : "…"}`,
    cuando: `a las ${horaCorta(regla.hora)}, ${diasTexto(regla.dias)}`,
  };
}

// ----------------------------------------------------------- validar y leer
const textoCorto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

function valorDe(d, v) {
  if (d.valor.tipo === "grupo") return esGrupo(v) ? v : d.valor.def;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(d.valor.max, Math.max(d.valor.min, n)) : d.valor.def;
}

/** Una regla limpia, o null si le falta lo imprescindible. */
export function normalizarRegla(r) {
  if (!r || typeof r !== "object" || !esDisparo(r.disparo)) return null;
  if (typeof r.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(r.id)) return null;
  const d = DISPAROS[r.disparo];
  const texto = textoCorto(r.texto, MAX_TEXTO);
  if (!texto) return null;
  const dias = Array.isArray(r.dias)
    ? [...new Set(r.dias.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [];
  return {
    id: r.id,
    nombre: textoCorto(r.nombre, 40) || d.label,
    activa: r.activa !== false,
    disparo: r.disparo,
    valor: valorDe(d, r.valor),
    hora: esHora(r.hora) ? r.hora : "12:00",
    dias: dias.length === 7 ? [] : dias,
    texto,
    caduca: r.caduca === true,
  };
}

/** Lista guardada -> lista limpia (sin repetidas ni rotas). null si no es una lista. */
export function normalizarReglas(lista) {
  if (!Array.isArray(lista)) return null;
  const vistas = new Set();
  const out = [];
  for (const r of lista.slice(0, MAX_REGLAS)) {
    const n = normalizarRegla(r);
    if (n && !vistas.has(n.id)) {
      vistas.add(n.id);
      out.push(n);
    }
  }
  return out;
}

/**
 * Lo que llega del manager al guardar. Estricto: una regla rota no se tira en
 * silencio, se dice cuál es.
 * @returns {{reglas:object[]} | {error:string}}
 */
export function validarReglas(lista) {
  if (!Array.isArray(lista)) return { error: "Faltan los avisos" };
  if (lista.length > MAX_REGLAS) return { error: `Como mucho ${MAX_REGLAS} avisos automáticos` };
  const reglas = [];
  for (const r of lista) {
    const nombre = textoCorto(r?.nombre, 40) || "sin nombre";
    if (!esDisparo(r?.disparo)) return { error: `El aviso «${nombre}» no dice a quién va` };
    if (!textoCorto(r?.texto, 10_000)) return { error: `El aviso «${nombre}» no tiene texto` };
    if (String(r.texto).trim().length > MAX_TEXTO) return { error: `El texto de «${nombre}» pasa de ${MAX_TEXTO} letras` };
    const malas = variablesDesconocidas(r.texto);
    if (malas.length) return { error: `En «${nombre}» no existe {${malas[0]}}. Usa: ${VARIABLES.map((v) => `{${v.clave}}`).join(" ")}` };
    if (!esHora(r?.hora)) return { error: `La hora de «${nombre}» no es válida` };
    const n = normalizarRegla(r);
    if (!n) return { error: `El aviso «${nombre}» no es válido` };
    if (reglas.some((x) => x.id === n.id)) return { error: "Hay dos avisos con el mismo identificador" };
    reglas.push(n);
  }
  return { reglas };
}

export function normalizarPausa(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_PAUSA, Math.max(0, n)) : PAUSA_POR_DEFECTO;
}

/** Identificador libre para una regla nueva ("sin-venir-2"). */
export function idNuevo(disparo, reglas) {
  const base = String(disparo).replace(/_/g, "-");
  const usados = new Set(reglas.map((r) => r.id));
  if (!usados.has(base)) return base;
  let i = 2;
  while (usados.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

/** Regla nueva de un disparo, lista para editar: su valor y su texto de partida. */
export function reglaNueva(disparo, reglas) {
  const d = DISPAROS[disparo];
  return {
    id: idNuevo(disparo, reglas),
    nombre: d.label,
    activa: true,
    disparo,
    valor: d.valor.def,
    hora: "12:00",
    dias: [],
    texto: d.sugerencia,
    caduca: Boolean(d.caduca),
  };
}

/**
 * Las de partida de cualquier tienda que no haya tocado nada. La de la racha
 * sale apagada: promete un regalo, y eso lo decide la tienda.
 */
export const PLANTILLAS = [
  { id: "racha", nombre: "Premio a la racha", activa: false, disparo: "racha", valor: 4, hora: "09:00", dias: [], caduca: true, texto: DISPAROS.racha.sugerencia },
  { id: "premio-pendiente", nombre: "Premio sin recoger", activa: true, disparo: "premio_listo", valor: 3, hora: "10:00", dias: [], texto: DISPAROS.premio_listo.sugerencia },
  { id: "a-un-paso", nombre: "A un paso del premio", activa: true, disparo: "cerca_premio", valor: 1, hora: "17:00", dias: [], texto: DISPAROS.cerca_premio.sugerencia },
  { id: "te-echamos-de-menos", nombre: "Te echamos de menos", activa: true, disparo: "sin_venir", valor: 21, hora: "12:00", dias: [], texto: DISPAROS.sin_venir.sugerencia },
  { id: "segunda-visita", nombre: "Segunda visita", activa: true, disparo: "segunda_visita", valor: 7, hora: "10:00", dias: [], texto: DISPAROS.segunda_visita.sugerencia },
  { id: "sin-estrenar", nombre: "Tarjeta sin estrenar", activa: true, disparo: "sin_estrenar", valor: 3, hora: "11:00", dias: [], texto: DISPAROS.sin_estrenar.sugerencia },
];

/** Etiqueta de un envío guardado: el grupo del CRM o el nombre de la regla automática. */
export function etiquetaEnvio(grupo, reglas) {
  const id = reglaDeGrupo(grupo);
  if (id) return reglas.find((r) => r.id === id)?.nombre || "Aviso automático";
  if (grupo === "todos") return "Todos";
  return LISTA_GRUPOS.find((g) => g.key === grupo)?.label || grupo;
}
