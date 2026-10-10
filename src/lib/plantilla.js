// ============================================================================
// LA PLANTILLA: QUIÉN ATIENDE LA CAJA Y QUÉ HACE CADA UNO
// ----------------------------------------------------------------------------
// La cuenta de la caja es una por tienda y la comparten todos. Para saber quién
// dio cada sello, cada empleado elige su nombre en SU móvil la primera vez que
// abre la caja cada día (una cookie que caduca a la medianoche de la tienda), y
// cada movimiento de la caja se guarda con su id (`eventos.empleado`).
//
// La lista vive en la config de la tienda (`negocio.plantilla`): id, nombre o
// apodo, alta y baja. Nada más: ni PIN ni turnos. Dar de baja no borra nada
// (sus movimientos siguen con su nombre); solo se le deja de ofrecer en la caja.
// El dueño, con su cuenta de manager, no elige: sale como «Dueño».
//
// Las cuentas salen de `eventos`, como la Actividad de Clientes, y se hacen con
// la hora de la TIENDA. Funciones PURAS: las usan la pestaña Plantilla, la caja
// y los tests. Las conclusiones son reglas fijas, sin IA: cada frase dice de qué
// cifra sale.
// ============================================================================

import { relojLocal, fechaLocal, sumarDias, inicioDelDia, tramosDe, aHora, ZONA_POR_DEFECTO } from "./horario";
import { clasificar } from "./actividad";
import { BLOQUES, listaDias } from "./observaciones";

export const MAX_EMPLEADOS = 30;  // dados de alta a la vez
export const MAX_TOTAL = 200;     // contando bajas: nunca se borra a nadie, pero tampoco crece sin fin
export const MAX_NOMBRE = 30;
// El PIN: lo elige cada uno la primera vez que se elige en la caja y vale
// HORAS_PIN sin usar la caja en ese móvil (cada sello lo renueva). Con cola no
// se teclea a cada cliente; tras el descanso, sí. Si se olvida, el manager lo
// quita y la persona elige otro: nadie puede leerlo, solo se guarda su hash.
export const HORAS_PIN = 2;
export const PIN_MIN = 4;
export const PIN_MAX = 6;
const PIN_RE = /^\d{4,6}$/;
const ID_RE = /^[a-z0-9]{4,16}$/;
const LETRAS_ID = "abcdefghijklmnopqrstuvwxyz0123456789";
const HASH_RE = /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/;

/** El PIN tal cual se teclea, o null si no vale: de 4 a 6 cifras y no todas iguales. */
export function pinValido(valor) {
  const s = String(valor ?? "").trim();
  if (!PIN_RE.test(s) || /^(.)\1+$/.test(s)) return null;
  return s;
}

// ------------------------------------------------------------------ la lista

/** Nombre o apodo limpio (espacios de más fuera), o null si no vale. */
export function nombreDeEmpleado(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/\s+/g, " ").trim();
  return limpio && limpio.length <= MAX_NOMBRE ? limpio : null;
}

const fechaValida = (v) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);

/**
 * La plantilla guardada, completa y sin basura: ids válidos y únicos, nombres
 * limpios, fechas que lo son. Lo que no vale se cae.
 * @returns {{id:string, nombre:string, alta:string|null, baja:string|null}[]}
 */
export function normalizarPlantilla(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const out = [];
  let activos = 0;
  for (const e of lista) {
    if (!e || typeof e !== "object") continue;
    const id = typeof e.id === "string" && ID_RE.test(e.id) ? e.id : null;
    const nombre = nombreDeEmpleado(e.nombre);
    if (!id || !nombre || vistos.has(id)) continue;
    const baja = fechaValida(e.baja);
    // Los topes van por separado: las bajas no pueden comerse el sitio de un alta.
    if (!baja && activos >= MAX_EMPLEADOS) continue;
    if (out.length >= MAX_TOTAL) break;
    vistos.add(id);
    if (!baja) activos += 1;
    // Solo el hash del PIN (lib/claves.js); cualquier otra cosa es que no tiene.
    out.push({ id, nombre, alta: fechaValida(e.alta), baja, pin: typeof e.pin === "string" && HASH_RE.test(e.pin) ? e.pin : null });
  }
  return out;
}

export const empleadosActivos = (plantilla) => (plantilla || []).filter((e) => !e.baja);
export const empleadoDe = (plantilla, id) => (plantilla || []).find((e) => e.id === id) || null;

/** Un id corto que no está en la lista. */
export function idLibre(plantilla, azar = Math.random) {
  const usados = new Set((plantilla || []).map((e) => e.id));
  for (;;) {
    const id = Array.from({ length: 8 }, () => LETRAS_ID[Math.floor(azar() * LETRAS_ID.length)]).join("");
    if (!usados.has(id)) return id;
  }
}

const mismoNombre = (a, b) => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;
const repetido = (plantilla, nombre, salvo = null) =>
  empleadosActivos(plantilla).some((e) => e.id !== salvo && mismoNombre(e.nombre, nombre));

/**
 * Da de alta a alguien. Devuelve la lista NUEVA (la de entrada no se toca) o `{error}`.
 * @returns {{empleado:object, plantilla:object[]}|{error:string}}
 */
export function nuevoEmpleado(plantilla, nombre, { ahora = Date.now(), id = null } = {}) {
  const limpio = nombreDeEmpleado(nombre);
  if (!limpio) return { error: `Escribe un nombre o un apodo (hasta ${MAX_NOMBRE} letras)` };
  if (empleadosActivos(plantilla).length >= MAX_EMPLEADOS) return { error: `Como mucho ${MAX_EMPLEADOS} personas en la plantilla` };
  if ((plantilla || []).length >= MAX_TOTAL) return { error: `La lista ya tiene ${MAX_TOTAL} personas contando las bajas: no caben más` };
  if (repetido(plantilla, limpio)) return { error: `Ya hay alguien que se llama ${limpio}. Añade una inicial o un apodo.` };
  const empleado = { id: id || idLibre(plantilla), nombre: limpio, alta: new Date(ahora).toISOString(), baja: null, pin: null };
  return { empleado, plantilla: [...(plantilla || []), empleado] };
}

/**
 * Renombra, da de baja (`activo: false`) o vuelve a dar de alta. El id no cambia
 * nunca: es lo que llevan sus movimientos.
 * @returns {{empleado:object, plantilla:object[]}|{error:string}}
 */
export function cambiarEmpleado(plantilla, id, cambios = {}, { ahora = Date.now() } = {}) {
  const actual = empleadoDe(plantilla, id);
  if (!actual) return { error: "Esa persona no está en la plantilla" };
  let e = actual;
  if (cambios.nombre !== undefined) {
    const nombre = nombreDeEmpleado(cambios.nombre);
    if (!nombre) return { error: `Escribe un nombre o un apodo (hasta ${MAX_NOMBRE} letras)` };
    if (repetido(plantilla, nombre, id)) return { error: `Ya hay alguien que se llama ${nombre}. Añade una inicial o un apodo.` };
    e = { ...e, nombre };
  }
  if (cambios.activo === true && e.baja) {
    if (empleadosActivos(plantilla).length >= MAX_EMPLEADOS) return { error: `Como mucho ${MAX_EMPLEADOS} personas en la plantilla` };
    // Mientras estaba de baja pudo entrar otro con su nombre: dos botones iguales en la caja, no.
    if (repetido(plantilla, e.nombre, id)) return { error: `Ya hay alguien que se llama ${e.nombre}. Renómbralo antes de volver a darlo de alta.` };
    e = { ...e, baja: null };
  }
  if (cambios.activo === false && !e.baja) e = { ...e, baja: new Date(ahora).toISOString() };
  // Se le olvidó: el manager se lo quita y la persona elige otro en la caja.
  // Todos sus móviles vuelven a preguntar (la cookie lleva la huella del PIN).
  if (cambios.quitarPin === true) e = { ...e, pin: null };
  return { empleado: e, plantilla: plantilla.map((x) => (x.id === id ? e : x)) };
}

/** Guarda el hash del PIN que acaba de elegir (solo si aún no tenía: cambiarlo pasa por quitarlo). */
export function ponerPin(plantilla, id, hash) {
  const actual = empleadoDe(plantilla, id);
  if (!actual || actual.baja) return { error: "Esa persona no está en la plantilla" };
  if (actual.pin) return { error: "Ya tiene PIN. Si lo ha olvidado, el manager se lo quita desde Plantilla." };
  if (!HASH_RE.test(String(hash))) return { error: "PIN no válido" };
  const e = { ...actual, pin: hash };
  return { empleado: e, plantilla: plantilla.map((x) => (x.id === id ? e : x)) };
}

/** Lo que de cada persona puede salir del servidor: nunca el hash del PIN, solo si lo tiene. */
export const empleadoPublico = (e) => e && { id: e.id, nombre: e.nombre, alta: e.alta ?? null, baja: e.baja ?? null, tienePin: Boolean(e.pin) };
export const plantillaPublica = (plantilla) => (plantilla || []).map(empleadoPublico);

// ----------------------------------------------------- la cookie de la caja
// `quien`: quién atiende desde este móvil, FIRMADA (lib/quien.js) y con la huella
// de su PIN: sin firma se forjaría y el PIN no serviría de nada; con la huella,
// quitarle el PIN deja sin valor la cookie de todos sus móviles. Dura HORAS_PIN
// desde el último uso de la caja. `quien_ultimo`: quién fue la última vez, sin
// firmar (solo propone un nombre). Llevan el slug: un móvil que entra en dos
// tiendas no se mezcla.

export const COOKIE_QUIEN = "quien";
export const COOKIE_ULTIMO = "quien_ultimo";
export const DIAS_ULTIMO = 90;

/** Lo que de un hash va en la cookie: cambia si el PIN cambia, y no sirve para adivinarlo. */
export const huellaDePin = (hash) => (typeof hash === "string" && hash ? hash.slice(-12) : "sin");

/** El texto que se firma: `<slug>.<id>.<huella del PIN>`. */
export const valorQuien = (slug, id, huella) => `${slug}.${id}.${huella}`;

/**
 * El empleado al que apunta un texto YA VERIFICADO de la cookie `quien`, o null:
 * de esta tienda, dado de alta, con PIN, y con la huella del PIN que tiene ahora.
 */
export function quienDePayload(payload, slug, plantilla) {
  if (typeof payload !== "string") return null;
  const partes = payload.split(".");
  if (partes.length < 3) return null;
  const huella = partes.pop();
  const id = partes.pop();
  if (partes.join(".") !== slug) return null;
  const e = empleadoDe(plantilla, id);
  return e && !e.baja && e.pin && huellaDePin(e.pin) === huella ? e : null;
}

/** El empleado (dado de alta) de un `<slug>.<id>` sin firmar: la cookie «la última vez». */
export function empleadoDeValor(valor, slug, plantilla) {
  if (typeof valor !== "string") return null;
  const i = valor.lastIndexOf(".");
  if (i <= 0 || valor.slice(0, i) !== slug) return null;
  const e = empleadoDe(plantilla, valor.slice(i + 1));
  return e && !e.baja ? e : null;
}

/** ¿Hay que elegir quién atiende? Solo la cuenta de caja, y solo con gente dada de alta. */
export const hayQueElegir = (sesion, plantilla) => sesion?.rol === "caja" && empleadosActivos(plantilla).length > 0;

// -------------------------------------------------- quién hizo cada movimiento

export const DUENO = "dueno";
export const SIN_NOMBRE = "caja";
const FIJOS = { [DUENO]: "Dueño", [SIN_NOMBRE]: "Sin nombre", admin: "Fiddle" };
const CLIENTE = new Set(["cliente", "tap", "apple"]);

/** La clave de quien lo hizo: `e:<id>`, `dueno`, `caja` (sin nombre), `admin`, o null si no fue el personal. */
export function autorDe(e) {
  if (e.empleado) return `e:${e.empleado}`;
  if (e.actor === "manager") return DUENO;
  if (e.actor === "admin") return "admin";
  if (e.actor === "caja") return SIN_NOMBRE;
  return null;
}

/** Cómo se llama quien lo hizo, para la columna «Quién» de las pantallas y las hojas. */
export function quienTexto(e, plantilla) {
  const a = autorDe(e);
  if (a?.startsWith("e:")) return empleadoDe(plantilla, a.slice(2))?.nombre || "Empleado";
  if (a === SIN_NOMBRE) return "Caja";
  if (a) return FIJOS[a];
  return CLIENTE.has(e.actor) ? "El cliente" : "";
}

const nombreDeClave = (clave, plantilla) =>
  clave.startsWith("e:") ? empleadoDe(plantilla, clave.slice(2))?.nombre || "Empleado" : FIJOS[clave];

// ------------------------------------------------------------------ cuentas

/** El periodo: de la medianoche de la tienda de hace `dias - 1` días a ahora. */
export function ventanaDe(dias, ahora = Date.now(), zona = ZONA_POR_DEFECTO) {
  return { desde: inicioDelDia(sumarDias(fechaLocal(ahora, zona), -(dias - 1)), zona), hasta: ahora };
}

const bloqueDe = (minutos) => BLOQUES.find((b) => minutos >= b.desde * 60 && minutos < b.hasta * 60)?.id || BLOQUES.at(-1).id;
const nuevaCelda = () => ({ sellos: 0, movimientos: 0, horas: new Set(), fechas: new Set(), porAutor: new Map() });
const rejillaVacia = () => Array.from({ length: 7 }, () => Array(24).fill(0));

function nuevaFila(clave, { id, nombre, activo, persona }) {
  return {
    clave, id, nombre, activo, persona,
    sellos: 0, quitados: 0, premios: 0, guardados: 0, visitas: 0, movimientos: 0, fuera: 0, estrenos: 0,
    seriales: new Set(), horas: new Set(), celdas: new Map(), jornadas: new Map(), rejilla: rejillaVacia(),
    primeraVez: null, ultimaVez: null,
  };
}

const CUENTA = { sello: "sellos", correccion: "quitados", premio: "premios", guardado: "guardados", visita: "visitas" };

/**
 * Lo que hizo cada persona en un periodo, y el equipo entero.
 *
 * Una fila por empleado dado de alta (aunque esté a cero), por quien está de
 * baja pero hizo algo, por el dueño si selló y por «Sin nombre» (la caja sin
 * elegir a nadie: los movimientos de antes de la plantilla salen ahí).
 *
 * «Hora de caja» = una hora del reloj con algún movimiento suyo. Es lo más
 * parecido a tiempo trabajado que dan los datos, sin apuntar turnos. El RITMO
 * ESPERADO de cada uno es lo que da el equipo en los mismos (día de la semana,
 * tramo) que trabajó: así quien cubre las tardes flojas no sale peor por eso.
 *
 * @param {object[]} eventos  con `tipo`, `serial`, `actor`, `empleado`, `ts`
 * @param {{plantilla?:object[], zona?:string, horario?:object|null, desde?:number|null, hasta?:number|null, clientes?:{serial:string, creado:string}[]}} opciones
 */
export function cuentasDePlantilla(eventos, { plantilla = [], zona = ZONA_POR_DEFECTO, horario = null, desde = null, hasta = null, clientes = [] } = {}) {
  const creadoDe = new Map(clientes.map((c) => [c.serial, Date.parse(c.creado || "")]));
  const filas = new Map();
  const fila = (clave) => {
    if (!filas.has(clave)) {
      const e = clave.startsWith("e:") ? empleadoDe(plantilla, clave.slice(2)) : null;
      filas.set(clave, nuevaFila(clave, {
        id: e?.id ?? null,
        nombre: nombreDeClave(clave, plantilla),
        // Un id que ya no está en la lista no se puede elegir: cuenta como baja.
        activo: clave.startsWith("e:") ? Boolean(e && !e.baja) : true,
        // El admin (los sellos de prueba de Fiddle) no es del equipo: fuera de la media.
        persona: clave !== SIN_NOMBRE && clave !== "admin",
      }));
    }
    return filas.get(clave);
  };
  for (const e of empleadosActivos(plantilla)) fila(`e:${e.id}`);

  const dentro = (t) => (desde === null || t >= desde) && (hasta === null || t <= hasta);
  const delPersonal = (eventos || [])
    .map((e) => ({ e, t: Date.parse(e.ts), autor: autorDe(e), clase: clasificar(e.tipo)?.clase }))
    .filter((x) => x.t && x.autor && x.clase && x.clase !== "alta")
    .sort((a, b) => a.t - b.t);

  const celdas = new Map(); // (día, tramo) -> lo del equipo, para el ritmo esperado y «cubre en solitario»
  const primeros = new Set();
  const equipo = { sellos: 0, quitados: 0, premios: 0, guardados: 0, visitas: 0, movimientos: 0, fuera: 0, estrenos: 0, sinNombre: 0, seriales: new Set(), horas: new Set() };

  for (const { e, t, autor, clase } of delPersonal) {
    // El estreno de una tarjeta: su primer movimiento en caja, si se dio de alta en el periodo.
    const primero = !primeros.has(e.serial);
    primeros.add(e.serial);
    if (!dentro(t)) continue;
    const f = fila(autor);
    const { fecha, dia, minutos } = relojLocal(t, zona);
    const hora = Math.floor(minutos / 60);
    const claveHora = `${fecha}:${hora}`;
    const tramos = horario ? tramosDe(horario, fecha) : null;
    const fuera = Boolean(tramos && !tramos.some((r) => minutos >= r.abre && minutos < r.cierra));

    f[CUENTA[clase]] += 1;
    f.movimientos += 1;
    f.seriales.add(e.serial);
    f.horas.add(claveHora);
    f.rejilla[dia][hora] += 1;
    if (fuera) f.fuera += 1;
    const creado = creadoDe.get(e.serial);
    if (primero && creado && dentro(creado)) { f.estrenos += 1; equipo.estrenos += 1; }
    f.primeraVez ||= e.ts;
    f.ultimaVez = e.ts;

    const j = f.jornadas.get(fecha) || { fecha, primero: minutos, ultimo: minutos, sellos: 0, quitados: 0, premios: 0, guardados: 0, visitas: 0, movimientos: 0 };
    f.jornadas.set(fecha, { ...j, primero: Math.min(j.primero, minutos), ultimo: Math.max(j.ultimo, minutos), [CUENTA[clase]]: j[CUENTA[clase]] + 1, movimientos: j.movimientos + 1 });

    const claveCelda = `${dia}:${bloqueDe(minutos)}`;
    const mia = f.celdas.get(claveCelda) || { sellos: 0, horas: new Set() };
    if (clase === "sello") mia.sellos += 1;
    mia.horas.add(claveHora);
    f.celdas.set(claveCelda, mia);
    const c = celdas.get(claveCelda) || nuevaCelda();
    if (clase === "sello") c.sellos += 1;
    c.movimientos += 1;
    c.horas.add(`${autor}:${claveHora}`);
    c.fechas.add(fecha);
    c.porAutor.set(autor, (c.porAutor.get(autor) || 0) + 1);
    celdas.set(claveCelda, c);

    equipo[CUENTA[clase]] += 1;
    equipo.movimientos += 1;
    equipo.seriales.add(e.serial);
    equipo.horas.add(claveHora);
    if (fuera) equipo.fuera += 1;
    if (autor === SIN_NOMBRE) equipo.sinNombre += 1;
  }

  const ritmoCelda = (clave) => {
    const c = celdas.get(clave);
    return c && c.horas.size ? c.sellos / c.horas.size : null;
  };
  const listas = [...filas.values()].map((f) => {
    let horasConRitmo = 0;
    let esperado = 0;
    for (const [clave, mia] of f.celdas) {
      const r = ritmoCelda(clave);
      if (r === null) continue;
      horasConRitmo += mia.horas.size;
      esperado += mia.horas.size * r;
    }
    const { seriales, horas, celdas: _c, jornadas, ...resto } = f;
    return {
      ...resto,
      clientes: seriales.size,
      dias: jornadas.size,
      horas: horas.size,
      sellosPorHora: horas.size ? f.sellos / horas.size : null,
      esperado: horasConRitmo ? esperado / horasConRitmo : null,
      jornadas: [...jornadas.values()]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map((j) => ({ ...j, primero: aHora(j.primero), ultimo: aHora(j.ultimo) })),
    };
  });
  listas.sort((a, b) => b.sellos - a.sellos || b.movimientos - a.movimientos || a.nombre.localeCompare(b.nombre, "es"));

  const personas = listas.filter((f) => f.persona && f.movimientos > 0);
  const suma = (k) => personas.reduce((a, f) => a + f[k], 0);
  const media = personas.length ? {
    sellos: suma("sellos") / personas.length,
    quitados: suma("quitados") / personas.length,
    premios: suma("premios") / personas.length,
    clientes: suma("clientes") / personas.length,
    horas: suma("horas") / personas.length,
    sellosPorHora: suma("horas") ? suma("sellos") / suma("horas") : null,
    tasaCorreccion: suma("sellos") ? suma("quitados") / suma("sellos") : 0,
  } : null;

  const { seriales, horas, ...totales } = equipo;
  return {
    filas: listas,
    equipo: { ...totales, clientes: seriales.size, horas: horas.size, personas: personas.length },
    media,
    celdas: [...celdas.entries()].map(([clave, c]) => ({
      clave, dia: Number(clave.split(":")[0]), bloque: clave.split(":")[1],
      movimientos: c.movimientos, dias: c.fechas.size, porAutor: Object.fromEntries(c.porAutor),
    })),
  };
}

/**
 * El registro: cada movimiento de la caja del periodo con quién lo hizo, del
 * más reciente al más antiguo. Para la tabla de Plantilla → Registro y su hoja.
 * @returns {{ts:string, fecha:string, hora:string, dia:number, serial:string, tipo:string, clase:string, mensaje:string, autor:string, quien:string, fueraDeHorario:boolean}[]}
 */
export function movimientosDePlantilla(eventos, { plantilla = [], zona = ZONA_POR_DEFECTO, horario = null, desde = null, hasta = null } = {}) {
  const out = [];
  for (const e of eventos || []) {
    const t = Date.parse(e.ts);
    const autor = autorDe(e);
    const clase = clasificar(e.tipo)?.clase;
    if (!t || !autor || !clase || clase === "alta") continue;
    if ((desde !== null && t < desde) || (hasta !== null && t > hasta)) continue;
    const { fecha, dia, minutos } = relojLocal(t, zona);
    const tramos = horario ? tramosDe(horario, fecha) : null;
    out.push({
      ts: e.ts, fecha, dia, hora: aHora(minutos), serial: e.serial, tipo: e.tipo, clase, mensaje: e.mensaje,
      // Aquí la caja sin elegir a nadie es «Sin nombre», como en las cuentas (en Actividad sigue siendo «Caja»).
      autor, quien: autor === SIN_NOMBRE ? FIJOS[SIN_NOMBRE] : quienTexto(e, plantilla),
      fueraDeHorario: Boolean(tramos && !tramos.some((r) => minutos >= r.abre && minutos < r.cierra)),
    });
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts));
}

/**
 * Sellos de cada día del periodo, repartidos por persona: para la gráfica de
 * «quién selló cada día».
 * @returns {{dia:string, total:number, por:Object<string, number>}[]}
 */
export function serieDiaria(eventos, { zona = ZONA_POR_DEFECTO, dias = 30, ahora = Date.now() } = {}) {
  const hoy = fechaLocal(ahora, zona);
  const porDia = new Map(Array.from({ length: dias }, (_, i) => [sumarDias(hoy, -(dias - 1 - i)), {}]));
  for (const e of eventos || []) {
    const t = Date.parse(e.ts);
    const autor = autorDe(e);
    if (!t || !autor || clasificar(e.tipo)?.clase !== "sello") continue;
    const por = porDia.get(fechaLocal(t, zona));
    if (por) por[autor] = (por[autor] || 0) + 1;
  }
  return [...porDia.entries()].map(([dia, por]) => ({ dia, total: Object.values(por).reduce((a, b) => a + b, 0), por }));
}

/** Lo de hoy de una persona, para su móvil: «Hoy: 23 sellos, 18 clientes». */
export function resumenDeHoy(eventos, { id, zona = ZONA_POR_DEFECTO, ahora = Date.now() }) {
  const hoy = fechaLocal(ahora, zona);
  const r = { sellos: 0, quitados: 0, premios: 0, clientes: 0 };
  const seriales = new Set();
  for (const e of eventos || []) {
    if (e.empleado !== id) continue;
    const t = Date.parse(e.ts);
    const clase = clasificar(e.tipo)?.clase;
    if (!t || !clase || clase === "alta" || fechaLocal(t, zona) !== hoy) continue;
    if (CUENTA[clase] in r) r[CUENTA[clase]] += 1;
    seriales.add(e.serial);
  }
  return { ...r, clientes: seriales.size };
}

// Un color por persona para las gráficas, por su orden en la plantilla.
const PALETA = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#4b5563"];
export const colorDe = (i) => PALETA[((i % PALETA.length) + PALETA.length) % PALETA.length];

// ------------------------------------------------------------- conclusiones

const MIN_MOVIMIENTOS = 20; // por debajo, cualquier diferencia es casualidad
const MIN_HORAS = 5;        // horas de caja para hablar del ritmo de alguien

/** "3", "1,3": sin decimales si no hacen falta, y con coma. */
export const cifra = (x) => {
  const r = Math.round(x * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
};
export const unoDeCada = (quitados, sellos) => (quitados ? `1 de cada ${Math.max(1, Math.round(sellos / quitados))}` : "ninguno");
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Las conclusiones, de la más útil a la menos. Reglas fijas: cada frase lleva la
 * cifra de la que sale, y `detalle` explica cómo se mide.
 * @param {ReturnType<typeof cuentasDePlantilla>} cuentas
 * @returns {{id:string, tono:"bien"|"ojo"|"dato", texto:string, detalle?:string, clave?:string}[]}
 */
export function observacionesPlantilla(cuentas, { dias = 30 } = {}) {
  const { filas, equipo, media, celdas = [] } = cuentas;
  const out = [];
  const personas = filas.filter((f) => f.persona && f.movimientos > 0);
  // Sin nadie con nombre (la tienda aún no estrenó la plantilla) no hay de quién hablar,
  // y acusar de «sin nombre» a quien nunca pudo elegirse no tendría sentido.
  if (!personas.length) {
    return [{ id: "sin-personas", tono: "dato", texto: "Cuando el equipo elija su nombre en la caja, aquí saldrán las conclusiones por persona." }];
  }
  if (equipo.movimientos < MIN_MOVIMIENTOS) {
    return [{ id: "pocos", tono: "dato", texto: "Con unas semanas más de caja, aquí saldrán las conclusiones por persona." }];
  }
  const detalleRitmo = "Hora de caja: una con algún movimiento suyo. Lo normal sale de lo que da el equipo en los mismos días y tramos.";

  // RITMO: contra lo normal en sus franjas, no contra la media a secas.
  for (const f of personas) {
    if (f.horas < MIN_HORAS || !f.esperado || f.sellosPorHora === null) continue;
    const alto = f.sellosPorHora >= f.esperado * 1.3;
    const bajo = f.sellosPorHora <= f.esperado * 0.7;
    if (!alto && !bajo) continue;
    out.push({
      id: `ritmo-${alto ? "alto" : "bajo"}-${f.clave}`, clave: f.clave, tono: alto ? "bien" : "ojo",
      texto: `${f.nombre} da ${cifra(f.sellosPorHora)} sellos por hora de caja; en sus franjas lo normal son ${cifra(f.esperado)}.`,
      detalle: detalleRitmo,
    });
  }

  // CORRECCIONES: quita muchos más sellos que el resto.
  for (const f of personas) {
    if (f.quitados < 3 || !f.sellos) continue;
    const tasa = f.quitados / f.sellos;
    const resto = personas.filter((x) => x.clave !== f.clave);
    const sellosResto = resto.reduce((a, x) => a + x.sellos, 0);
    const quitadosResto = resto.reduce((a, x) => a + x.quitados, 0);
    const tasaResto = sellosResto ? quitadosResto / sellosResto : 0;
    if (tasa < 0.05 || tasa < tasaResto * 2) continue;
    out.push({
      id: `correcciones-${f.clave}`, clave: f.clave, tono: "ojo",
      texto: `${f.nombre} quita ${unoDeCada(f.quitados, f.sellos)} sellos que da; el resto del equipo, ${unoDeCada(quitadosResto, sellosResto)}.`,
      detalle: "Suele ser un toque doble. Con prisa ayudan los «Botones grandes» de la vista de caja.",
    });
  }

  // FUERA DE HORARIO: sellos con la tienda cerrada.
  for (const f of personas) {
    if (f.fuera < 2) continue;
    out.push({
      id: `fuera-${f.clave}`, clave: f.clave, tono: "ojo",
      texto: `${plural(f.fuera, "movimiento", "movimientos")} de ${f.nombre} con la tienda cerrada, según el horario.`,
      detalle: "Un sello después de cerrar es un ticket que no cuadra. Cada uno está en el registro, con su hora.",
    });
  }

  // EN SOLITARIO: franjas (día, tramo) que casi siempre lleva la misma persona.
  // Con una sola persona en el equipo lo cubre todo en solitario: no dice nada.
  const solos = new Map();
  for (const c of personas.length >= 2 ? celdas : []) {
    if (c.movimientos < 6 || c.dias < 2) continue;
    const [clave, n] = Object.entries(c.porAutor).sort((a, b) => b[1] - a[1])[0];
    if (clave === SIN_NOMBRE || n / c.movimientos < 0.9) continue;
    const mio = solos.get(clave) || new Map();
    mio.set(c.bloque, [...(mio.get(c.bloque) || []), c.dia]);
    solos.set(clave, mio);
  }
  for (const [clave, porBloque] of solos) {
    const f = filas.find((x) => x.clave === clave);
    if (!f) continue;
    const franjas = BLOQUES.filter((b) => porBloque.has(b.id)).map((b) => {
      const lista = listaDias(porBloque.get(b.id));
      return `las ${b.plural} ${lista.startsWith("de ") ? lista : `de ${lista}`}`;
    });
    out.push({
      id: `solo-${clave}`, clave, tono: "dato",
      texto: `${f.nombre} cubre en solitario ${franjas.join(" y ")}.`,
      detalle: "Nueve de cada diez movimientos de esa franja son suyos. Si falta, nadie más la conoce.",
    });
  }

  // ESTRENOS: quién convence a más clientes para sacar la tarjeta. Solo entre
  // personas: los de «Sin nombre» no cuentan ni en el total, o la cuota mentiría.
  const estrenosEquipo = personas.reduce((a, f) => a + f.estrenos, 0);
  if (estrenosEquipo >= 5) {
    const mejor = [...personas].sort((a, b) => b.estrenos - a.estrenos)[0];
    const cuota = mejor.estrenos / estrenosEquipo;
    if (mejor.estrenos >= 3 && cuota >= 0.4 && cuota > 1.5 / Math.max(1, personas.length)) {
      out.push({
        id: `estrenos-${mejor.clave}`, clave: mejor.clave, tono: "bien",
        texto: `${mejor.nombre} estrenó ${mejor.estrenos} de las ${estrenosEquipo} tarjetas nuevas del periodo.`,
        detalle: "El primer sello de una tarjeta recién sacada: quien más clientes convence.",
      });
    }
  }

  // CARGA: más de la mitad de los sellos en una persona.
  if (personas.length >= 3 && equipo.sellos) {
    const mayor = [...personas].sort((a, b) => b.sellos - a.sellos)[0];
    const cuota = mayor.sellos / equipo.sellos;
    if (cuota >= 0.5) {
      out.push({
        id: `carga-${mayor.clave}`, clave: mayor.clave, tono: "dato",
        texto: `${mayor.nombre} da el ${Math.round(cuota * 100)} % de los sellos del equipo.`,
        detalle: "Más de la mitad en una persona: o la caja es casi suya, o el resto no se está apuntando.",
      });
    }
  }

  // SIN NOMBRE: se selló sin elegir a nadie (o antes de poner la plantilla en marcha).
  if (equipo.sinNombre > 0) {
    out.push({
      id: "sin-nombre", tono: equipo.sinNombre > equipo.movimientos * 0.2 ? "ojo" : "dato",
      texto: `${plural(equipo.sinNombre, "movimiento", "movimientos")} sin nombre: se selló sin elegir quién atendía.`,
      detalle: `Los de antes de dar de alta a la plantilla también cuentan aquí; en ${dias} días desaparecen del periodo.`,
    });
  }

  if (!out.length && media) {
    out.push({ id: "parejo", tono: "dato", texto: `Nadie destaca por arriba ni por abajo: ${cifra(media.sellosPorHora || 0)} sellos por hora de caja de media y pocas correcciones.` });
  }
  return out;
}
