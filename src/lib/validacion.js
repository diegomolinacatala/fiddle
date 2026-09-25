// Validación de entradas del manager (funciones puras, testeadas).

import { normalizarTextoMarca } from "./apple/glifos";
import { FORMAS, BANDAS, MODOS, resolverMarca } from "./apple/dibujo";
import { CONTADORES } from "./cartillas";
import { normalizarHorario } from "./horario";

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
 * `cartillasActuales`: con dos cartillas el manager cambia la meta y el premio
 * de cada una, pero no su nombre ni su dibujo (eso es del admin): lo que llega
 * se pone encima de las que ya hay.
 * @returns {{patch:object} | {error:string}}
 */
export function patchNegocio(body, accionesValidas, { cartillasActuales = null } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const patch = {};
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
  if (Array.isArray(b.cartillas) && cartillasActuales) {
    const cartillas = normalizarCartillas(cartillasActuales.map((c, i) => ({
      ...c,
      meta: b.cartillas[i]?.meta ?? c.meta,
      premio: b.cartillas[i]?.premio ?? c.premio,
    })));
    if (!cartillas) return { error: `Cada cartilla necesita un premio y de 1 a ${MAX_META_CARTILLA} sellos` };
    // La primera cartilla ES la de siempre: su meta y su premio son los del negocio.
    Object.assign(patch, { cartillas, meta: cartillas[0].meta, premio: cartillas[0].premio });
  }
  return { patch };
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
    out.push({ nombre, marca, meta, premio });
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
export function patchNegocioAdmin(body, accionesValidas, { ESTILOS = [], temaPorDefecto = null } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const r = patchNegocio(b, accionesValidas);
  if (r.error) return r;
  const patch = r.patch;

  const nombre = texto(b.nombre, 60);
  if (b.nombre !== undefined) {
    if (!nombre) return { error: "El nombre no puede quedar vacío" };
    patch.nombre = nombre;
  }
  if (typeof b.brief === "string") patch.brief = b.brief.trim().slice(0, 4000);
  // null quita la segunda cartilla; una lista tiene que valer entera.
  if (b.cartillas === null) patch.cartillas = null;
  else if (b.cartillas !== undefined) {
    const cartillas = normalizarCartillas(b.cartillas);
    if (!cartillas) return { error: `Cartillas no válidas: dos, cada una con nombre, marca, premio y meta de 1 a ${MAX_META_CARTILLA}` };
    patch.cartillas = cartillas;
    // La primera cartilla ES la de siempre: su meta y su premio son los del negocio.
    patch.meta = cartillas[0].meta;
    patch.premio = cartillas[0].premio;
  }
  if (b.tema && typeof b.tema === "object") {
    const cambiaPlantilla = temaPorDefecto && ESTILOS.includes(b.tema.estilo);
    const tema = {
      ...(cambiaPlantilla ? temaPorDefecto({ estilo: b.tema.estilo }) : {}),
      ...piezasDeDibujo(b.tema),
    };
    for (const clave of ["emoji", "atras"]) {
      const v = texto(b.tema[clave], clave === "emoji" ? 4 : 200);
      if (v) tema[clave] = v;
    }
    for (const clave of ["accent", "cardBg", "ink", "pageInk"]) {
      if (HEX.test(String(b.tema[clave] || ""))) tema[clave] = b.tema[clave];
    }
    if (Object.keys(tema).length) patch.tema = tema;
  }
  return { patch };
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
