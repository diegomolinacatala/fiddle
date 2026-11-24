import { PALETAS, ICONOS, FONDOS } from "@/app/home/tarjeta/opciones";
import { piezasDeTema, resolverMarca } from "@/lib/apple/dibujo";
import { estadoDeTienda } from "@/lib/horario";

// ============================================================================
// EL PASO «TU TARJETA»: LO QUE SE TOCA Y LO QUE SE GUARDA (lógica pura)
// ----------------------------------------------------------------------------
// El dueño ya tiene tarjeta (la semilla de su plantilla, a veces con colores o un
// logo propios). Este paso solo guarda lo que ELLA TOCA: `cambios` lleva una clave
// por cada cosa tocada (paleta, fondo, icono, meta, premio, modo, abierto,
// pedirNombre) y nada más. Lo no tocado no se manda NUNCA: así quien tiene un
// color de kit o un logo suyo no los pierde por pasar por aquí.
//
// Tampoco se manda `estilo` en el tema: el servidor lo entiende como cambio de
// plantilla y volvería a sembrar la paleta entera, borrando lo demás.
//
// Sin React ni nada del servidor: lo usa el navegador en cada toque y los tests.
// ============================================================================

const EJEMPLO_ABIERTO = { abierta: true, texto: "Abierto hasta las 20:00" };
export const MAX_PREMIO = 64;
export const METAS = [6, 8, 10, 12];

const paletaPorId = (id) => PALETAS.find((p) => p.id === id) || null;
const minuscula = (c) => String(c || "").toLowerCase();

// ---------------------------------------------------------------------------
// Lo que la tienda es hoy
// ---------------------------------------------------------------------------

/** El id de la paleta cuyo fondo es el de la tarjeta, o null si el color es propio. */
export function paletaDe(tema) {
  const hallada = PALETAS.find((p) => minuscula(p.cardBg) === minuscula(tema?.cardBg));
  return hallada ? hallada.id : null;
}

/** El id del icono si es uno de la lista; null si es otro (un icono propio, un kit). */
export function iconoDe(tema) {
  const marca = resolverMarca(tema?.marca) || resolverMarca(tema?.estilo);
  return ICONOS.some((i) => i.id === marca) ? marca : null;
}

/** El fondo de la banda en los términos de FONDOS, o null si es otro (oscura, blanca, foto). */
export function fondoDe(tema) {
  const banda = piezasDeTema(tema || {}).banda;
  const id = banda === "clara" ? "liso" : banda;
  return FONDOS.some((f) => f.id === id) ? id : null;
}

/** Cómo cuenta los puntos hoy (con el valor de siempre si el tema no lo dice). */
export const modoDe = (tema) => piezasDeTema(tema || {}).modo;

/** Con dos cartillas o de cupón, el premio y los puntos no se tocan aquí. */
export const tienePremioUnico = (n) => !n?.cartillas && n?.tipo !== "descuento";

/** Cuántos puntos se ofrecen: los de siempre y, si la tienda tiene otra meta, esa también. */
export function metasPosibles(n) {
  const actual = Number(n?.meta);
  const todas = Number.isFinite(actual) && actual > 0 && !METAS.includes(actual) ? [...METAS, actual] : METAS;
  return [...todas].sort((a, b) => a - b);
}

/** Los premios que sugerimos, los de los iconos, sin repetir. */
export const sugerenciasDePremio = () => [...new Set(ICONOS.map((i) => i.premio))];

// ---------------------------------------------------------------------------
// Los cambios
// ---------------------------------------------------------------------------

/** Copia de `cambios` con `clave` puesta; con `undefined` la quita (vuelve a lo de la tienda). */
export function conCambio(cambios, clave, valor) {
  const { [clave]: _quitada, ...resto } = cambios || {};
  return valor === undefined ? resto : { ...resto, [clave]: valor };
}

const temaDePaleta = (paleta) => {
  const p = paletaPorId(paleta);
  if (!p) return {};
  // `detalle: null` quita el color de detalles de antes: una paleta sin él pinta con su tinta.
  return { cardBg: p.cardBg, ink: p.ink, accent: p.accent, detalle: p.detalle ?? null };
};

/** Las piezas del tema que salen de lo tocado, sin tocar nada más. */
function piezasTocadas(cambios) {
  return {
    ...(cambios.paleta ? temaDePaleta(cambios.paleta) : {}),
    ...(cambios.icono ? { marca: cambios.icono } : {}),
    ...(cambios.modo ? { modo: cambios.modo } : {}),
    ...(cambios.fondo ? { banda: cambios.fondo === "liso" ? "clara" : cambios.fondo } : {}),
    ...(typeof cambios.abierto === "boolean" ? { abierto: cambios.abierto } : {}),
  };
}

/**
 * La tienda con lo tocado encima: es lo que pinta la escena. No muta `n`.
 * Con dos cartillas o de cupón, meta y premio no se tocan.
 */
export function negocioConCambios(n, cambios = {}) {
  const unico = tienePremioUnico(n);
  const premio = typeof cambios.premio === "string" ? cambios.premio.trim() : "";
  return {
    ...n,
    tema: { ...n.tema, ...piezasTocadas(cambios) },
    ...(unico && Number.isFinite(cambios.meta) ? { meta: cambios.meta } : {}),
    ...(unico && premio ? { premio } : {}),
    ...(typeof cambios.pedirNombre === "boolean" ? { pedirNombre: cambios.pedirNombre } : {}),
  };
}

/** ¿Está «Abierto hasta…» encendido en la tarjeta? Salvo que se apague, lo está. */
export const abiertoEncendido = (n, cambios = {}) =>
  typeof cambios.abierto === "boolean" ? cambios.abierto : n?.tema?.abierto !== false;

/** ¿Pide el nombre al escanear? De partida, no. */
export const pideNombre = (n, cambios = {}) =>
  typeof cambios.pedirNombre === "boolean" ? cambios.pedirNombre : n?.pedirNombre === true;

/**
 * La línea «● Abierto hasta…» de la banda. Con horario sale la de verdad (calculada
 * con la hora de AHORA: el servidor no la sabe, se pide tras montar). Sin horario,
 * y si se quiere ver `ejemplo`, uno inventado para que se vea cómo queda.
 */
export function estadoParaEscena(n, { encendido, ejemplo, ahora }) {
  if (!encendido) return null;
  if (!n?.horario) return ejemplo ? EJEMPLO_ABIERTO : null;
  if (!Number.isFinite(ahora)) return null;
  return estadoDeTienda({ ...n, tema: { ...n.tema, abierto: true } }, ahora);
}

// ---------------------------------------------------------------------------
// Lo que se guarda
// ---------------------------------------------------------------------------

/** Las piezas del tema tocadas que de verdad cambian algo respecto a la tienda de hoy. */
function temaAGuardar(n, c) {
  const tema = {};
  if (c.paleta && c.paleta !== paletaDe(n.tema)) Object.assign(tema, temaDePaleta(c.paleta));
  if (c.icono && c.icono !== iconoDe(n.tema)) tema.marca = c.icono;
  if (c.modo && c.modo !== modoDe(n.tema) && tienePremioUnico(n)) tema.modo = c.modo;
  if (c.fondo && c.fondo !== fondoDe(n.tema)) tema.banda = c.fondo === "liso" ? "clara" : c.fondo;
  if (typeof c.abierto === "boolean" && c.abierto !== (n.tema?.abierto !== false)) tema.abierto = c.abierto;
  return tema;
}

/**
 * El cuerpo de PUT /api/negocio con lo tocado, o null si no hay nada que guardar
 * (lo tocado igual que lo de hoy no cuenta). Nunca lleva `estilo`.
 * No muta `n` ni `cambios`.
 */
export function cuerpoDeGuardar(n, cambios = {}) {
  const tema = temaAGuardar(n, cambios);
  const unico = tienePremioUnico(n);
  const premio = typeof cambios.premio === "string" ? cambios.premio.trim().slice(0, MAX_PREMIO) : "";
  const cuerpo = {
    ...(Object.keys(tema).length ? { tema } : {}),
    ...(unico && Number.isFinite(cambios.meta) && cambios.meta !== n.meta ? { meta: cambios.meta } : {}),
    ...(unico && premio && premio !== n.premio ? { premio } : {}),
    ...(typeof cambios.pedirNombre === "boolean" && cambios.pedirNombre !== (n.pedirNombre === true) ? { pedirNombre: cambios.pedirNombre } : {}),
  };
  return Object.keys(cuerpo).length ? cuerpo : null;
}
