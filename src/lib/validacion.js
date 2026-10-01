// Validación de entradas del manager (funciones puras, testeadas).

import { normalizarTextoMarca } from "./apple/glifos";
import { FORMAS, BANDAS, MODOS, MODOS_DOBLES, resolverMarca } from "./apple/dibujo";
import { CONTADORES } from "./cartillas";
import { normalizarHorario } from "./horario";
import { normalizarContacto } from "./contacto";
import { validarLogoImagen } from "./logo";
import { normalizarCaja } from "./caja";

const MAX_UBICACIONES = 10; // límite de Apple Wallet
const MAX_NOMBRE = 48;

/**
 * El nombre de un cliente, lo escriba él al sacar la tarjeta o la caja. Sin
 * caracteres invisibles (un control de dirección le da la vuelta al texto en
 * la ficha) y con los espacios juntos. Se corta por caracteres, no por
 * unidades UTF-16, para no partir una letra en dos.
 * @returns {string|null} null si no queda nada
 */
export function nombreDeCliente(valor) {
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/\p{Cc}/gu, " ").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim();
  return Array.from(limpio).slice(0, MAX_NOMBRE).join("").trim() || null;
}

/**
 * Normaliza las ubicaciones de tienda. Devuelve null si alguna es inválida.
 * @param {unknown} lista
 * @returns {{lat:number, lng:number, texto?:string}[] | null}
 */
export function normalizarUbicaciones(lista) {
  if (!Array.isArray(lista) || lista.length > MAX_UBICACIONES) return null;
  const out = [];
  for (const u of lista) {
    const lat = typeof u?.lat === "string" && !u.lat.trim() ? NaN : Number(u?.lat);
    const lng = typeof u?.lng === "string" && !u.lng.trim() ? NaN : Number(u?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const texto = typeof u.texto === "string" && u.texto.trim() ? u.texto.trim().slice(0, 120) : undefined;
    out.push({ lat, lng, ...(texto ? { texto } : {}) });
  }
  return out;
}

/**
 * Patch de configuración de negocio a partir del body del manager.
 *
 * El manager edita su tarjeta entera (nombre, colores, dibujo, textos): es su
 * tienda. Lo que NO toca es la estructura —cupón o cartilla, una o dos
 * cartillas—, que cambia lo que ya tienen los clientes en el teléfono.
 *
 * `cartillasActuales`: con dos cartillas lo que llega de cada una se pone
 * encima de las que ya hay; nunca añade ni quita una.
 * `ESTILOS` y `temaPorDefecto`: sin ellos un `tema.estilo` no cambia de plantilla.
 * @returns {{patch:object} | {error:string}}
 */
export function patchNegocio(body, accionesValidas, { cartillasActuales = null, cartillasAparcadas = null, ESTILOS = [], temaPorDefecto = null } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const patch = {};
  if (b.nombre !== undefined) {
    const nombre = texto(b.nombre, 60);
    if (!nombre) return { error: "El nombre no puede quedar vacío" };
    patch.nombre = nombre;
  }
  if (b.tema && typeof b.tema === "object") {
    const tema = temaDePatch(b.tema, { ESTILOS, temaPorDefecto });
    if (Object.keys(tema).length) patch.tema = tema;
  }
  if (Number.isFinite(b.meta)) patch.meta = Math.max(1, Math.min(50, Math.round(b.meta)));
  if (typeof b.premio === "string" && b.premio.trim()) patch.premio = b.premio.trim().slice(0, 128);
  if (Array.isArray(b.acciones)) patch.acciones = [...new Set(b.acciones.filter((k) => accionesValidas.includes(k)))];
  if (typeof b.promo === "string" || b.promo === null) patch.promo = b.promo?.trim().slice(0, 200) || null;
  if (b.ubicaciones !== undefined) {
    const ubicaciones = normalizarUbicaciones(b.ubicaciones);
    if (!ubicaciones) return { error: "Ubicaciones no válidas (máx. 10, lat/lng numéricos)" };
    patch.ubicaciones = ubicaciones;
  }
  if (b.horario === null) patch.horario = null;
  else if (b.horario !== undefined) {
    const horario = normalizarHorario(b.horario);
    if (!horario) return { error: "Horario no válido: siete días, cada uno cerrado o con su hora de abrir y de cerrar" };
    patch.horario = horario;
  }
  if (typeof b.pedirNombre === "boolean") patch.pedirNombre = b.pedirNombre;
  if (b.caja && typeof b.caja === "object") patch.caja = normalizarCaja(b.caja);
  if (b.contacto !== undefined) {
    const c = normalizarContacto(b.contacto);
    if (c.error) return { error: c.error };
    patch.contacto = c.contacto;
  }
  // UNA O DOS CARTILLAS. Pasar a una no borra nada: la segunda se APARCA en la
  // config (con su nombre, su dibujo y su premio) y los sellos2 / guardados2 de
  // cada cliente se quedan donde estaban, sin verse. Volver a dos la recupera
  // tal cual, con los sellos de cada uno.
  if (b.cartillas === null) {
    patch.cartillas = null;
    // Lo aparcado es lo que manda el editor (con lo que se tocó antes de pasar a
    // una) o, si no manda nada, las que había guardadas.
    const aparcar = normalizarCartillas(b.cartillasAparcadas) || cartillasActuales;
    if (aparcar) patch.cartillasAparcadas = aparcar;
  } else if (Array.isArray(b.cartillas)) {
    // Lo que llega se pone encima de lo que había (o de lo aparcado): basta mandar lo que cambia.
    const base = cartillasActuales || cartillasAparcadas || [];
    const cartillas = normalizarCartillas(b.cartillas.map((c, i) => ({ ...(base[i] || {}), ...limpiarCartilla(c) })));
    if (!cartillas) return { error: `Cartillas no válidas: dos, cada una con nombre, dibujo, un premio y de 1 a ${MAX_META_CARTILLA} sellos` };
    // La primera cartilla ES la de siempre: su meta y su premio son los del negocio.
    Object.assign(patch, { cartillas, meta: cartillas[0].meta, premio: cartillas[0].premio });
  }
  return { patch };
}

/** De una cartilla que llega, solo lo que se puede cambiar (lo que no venga, se queda). */
function limpiarCartilla(c) {
  const out = {};
  if (!c || typeof c !== "object") return out;
  for (const k of ["nombre", "marca", "meta", "premio", "modo", "forma"]) if (c[k] !== undefined) out[k] = c[k];
  return out;
}

// ---------------------------------------------------------------- admin
const texto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const HEX = /^#[0-9a-f]{6}$/i;

const MAX_META_CARTILLA = 20; // dos filas de más de veinte ya no se distinguen en la banda

/**
 * Las dos cartillas de una tienda que lleva dos en el mismo pase (ver
 * lib/cartillas.js), o null si no valen. Solo acepta exactamente dos: una lista
 * a medias no se adivina.
 * @param {unknown} lista
 * @returns {{nombre:string, marca:string, meta:number, premio:string}[] | null}
 */
export function normalizarCartillas(lista) {
  if (!Array.isArray(lista) || lista.length !== CONTADORES.length) return null;
  const out = [];
  for (const c of lista) {
    const nombre = texto(c?.nombre, 24);
    const premio = texto(c?.premio, 64);
    const marca = resolverMarca(c?.marca);
    const meta = Math.round(Number(c?.meta));
    if (!nombre || !premio || !marca || !(meta >= 1 && meta <= MAX_META_CARTILLA)) return null;
    // Cómo cuenta y con qué casilla: cada una la suya. Sin ellos, los del tema.
    const extra = {};
    if (MODOS.includes(c.modo)) extra.modo = c.modo;
    if (FORMAS.includes(c.forma)) extra.forma = c.forma;
    out.push({ nombre, marca, meta, premio, ...extra });
  }
  return out;
}

/**
 * Las piezas con las que se dibuja el pase (ver lib/apple/dibujo.js).
 * Solo devuelve las que vengan y sean válidas; el resto lo pone el estilo.
 * El texto de la marca se limpia a lo que se sabe dibujar ("Café 68" -> "CAFE").
 * @returns {{marca?:string, forma?:string, banda?:string, texto?:string}}
 */
export function piezasDeDibujo(origen) {
  const o = origen && typeof origen === "object" ? origen : {};
  const piezas = {};
  const marca = resolverMarca(o.marca);
  if (marca) piezas.marca = marca;
  if (FORMAS.includes(o.forma)) piezas.forma = o.forma;
  if (BANDAS.includes(o.banda)) piezas.banda = o.banda;
  if (MODOS.includes(o.modo)) piezas.modo = o.modo;
  if (MODOS_DOBLES.includes(o.doble) || o.doble === "llenar") piezas.doble = o.doble;
  // La línea "● Abierto hasta las 14:00" en la banda: encendida salvo que se apague.
  if (typeof o.abierto === "boolean") piezas.abierto = o.abierto;
  // El fondo de la tarjeta en Google Wallet (Google solo deja UN color): el de la
  // tienda (de partida), el de la tarjeta de Apple, u otro.
  if (o.google === "acento" || o.google === "tarjeta" || HEX.test(String(o.google || ""))) piezas.google = o.google;
  if (typeof o.texto === "string") piezas.texto = normalizarTextoMarca(o.texto);
  return piezas;
}

/**
 * Datos de un negocio NUEVO (formulario del admin). Solo pide lo imprescindible:
 * el resto del tema sale del estilo elegido y se puede afinar después.
 * @returns {{datos:object} | {error:string}}
 */
export function datosNegocioNuevo(body, { esSlug, ESTILOS, temaPorDefecto }) {
  const b = body && typeof body === "object" ? body : {};
  const slug = texto(b.slug, 32)?.toLowerCase();
  const nombre = texto(b.nombre, 60);
  if (!slug || !esSlug(slug)) return { error: "Identificador no válido (minúsculas, números y guiones; mín. 2)" };
  if (!nombre) return { error: "Ponle un nombre al negocio" };

  const tipo = b.tipo === "descuento" ? "descuento" : "sellos";
  const estilo = ESTILOS.includes(b.estilo) ? b.estilo : "coffee";
  const accent = HEX.test(String(b.accent || "")) ? b.accent : undefined;
  const emoji = texto(b.emoji, 4) || undefined;
  // Piezas del dibujo: lo que no venga (o no valga) lo pone el estilo elegido.
  const dibujo = piezasDeDibujo(b);

  const meta = tipo === "descuento" ? 1 : Math.max(1, Math.min(50, Math.round(Number(b.meta) || 8)));
  const premio = texto(b.premio, 128) || (tipo === "descuento" ? "descuento" : "premio");
  const acciones = tipo === "descuento" ? ["canjear"] : ["sellar", "canjear"];

  return {
    datos: {
      slug, nombre, tipo, meta, premio, acciones,
      tema: temaPorDefecto({ estilo, emoji, accent, ...dibujo }),
      brief: texto(b.brief, 4000) || "",
    },
  };
}

/**
 * Patch del admin sobre un negocio existente: además de lo del manager puede
 * tocar el nombre, el tema y el brief.
 *
 * Si el tema trae un `estilo` válido se entiende como CAMBIO DE PLANTILLA: se
 * vuelve a sembrar la paleta entera desde ese estilo y encima se aplican los
 * retoques que vengan. Sin `estilo`, solo se tocan los campos enviados.
 *
 * @returns {{patch:object} | {error:string}}
 */
export function patchNegocioAdmin(body, accionesValidas, { ESTILOS = [], temaPorDefecto = null, cartillasActuales = null, cartillasAparcadas = null } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const r = patchNegocio(b, accionesValidas, { ESTILOS, temaPorDefecto, cartillasActuales, cartillasAparcadas });
  if (r.error) return r;
  const patch = r.patch;

  if (typeof b.brief === "string") patch.brief = b.brief.trim().slice(0, 4000);
  return { patch };
}

/**
 * El tema que llega del admin o del editor del manager, limpio.
 *
 * Si trae un `estilo` válido se entiende como CAMBIO DE PLANTILLA: se vuelve a
 * sembrar la paleta entera desde ese estilo y encima se aplican los retoques
 * que vengan. Por eso quien guarda manda TODOS sus colores: los que no mande
 * vuelven a ser los de la plantilla.
 */
function temaDePatch(t, { ESTILOS, temaPorDefecto }) {
  const cambiaPlantilla = temaPorDefecto && ESTILOS.includes(t.estilo);
  const tema = {
    ...(cambiaPlantilla ? temaPorDefecto({ estilo: t.estilo }) : {}),
    ...piezasDeDibujo(t),
  };
  for (const clave of ["emoji", "atras"]) {
    const v = texto(t[clave], clave === "emoji" ? 4 : 200);
    if (v) tema[clave] = v;
  }
  for (const clave of ["accent", "cardBg", "ink", "pageInk"]) {
    if (HEX.test(String(t[clave] || ""))) tema[clave] = t[clave];
  }
  // La imagen propia del logo (lib/logo.js): null la quita y vuelve el dibujo.
  const logo = validarLogoImagen(t.logoImagen);
  if (logo !== undefined) tema.logoImagen = logo;
  return tema;
}

/**
 * Nota sobre un campo del pase: "esto debería ser X". La clave identifica el
 * campo dentro de la vista previa (p. ej. "apple.premio" o "google.puntos").
 * @returns {{clave:string, texto:string|null} | {error:string}}
 */
export function notaDeCampo(body) {
  const b = body && typeof body === "object" ? body : {};
  const clave = texto(b.clave, 60);
  if (!clave || !/^[a-z0-9.\-_]+$/i.test(clave)) return { error: "Campo no válido" };
  return { clave, texto: texto(b.texto, 1000) }; // null borra la nota
}
