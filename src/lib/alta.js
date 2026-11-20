import { leerEmail, leerTelefono } from "./interesados";

// ============================================================================
// EL ALTA SOLA DESDE LA WEB (/alta)
// ----------------------------------------------------------------------------
// Una cafetería se da de alta sin nosotros: pone sus datos y marca el local en el
// mapa, y empieza en el plan Gratis (lib/planes.js, `PLAN_DEL_ALTA`). No hay
// correo verificado (aún no hay cuentas de persona): lo que frena los abusos es
// que sabemos DÓNDE está el local y quién dice ser, y que cada alta nos llega
// (auditoría y /admin). Si algo huele mal, se la llama o se va.
//
// Lo que se guarda va en `negocio.alta` (lo ve el admin, nunca el cliente ni la
// caja). Puro y sin nada del servidor: lo usa la pantalla al enviar y el servidor
// al guardar (/api/alta).
// ============================================================================

export const MAX_NOMBRE_TIENDA = 60;
export const MAX_NOMBRE_PERSONA = 80;
export const MAX_DIRECCION = 200;

const texto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);
const numero = (v, min, max) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

/**
 * El lugar marcado en el mapa: coordenadas y la dirección que salió de buscarla
 * (o la que escribió). Sin coordenadas no hay lugar.
 * @returns {{lat:number, lng:number, direccion:string|null}|null}
 */
export function leerLugar(lugar) {
  if (!lugar || typeof lugar !== "object") return null;
  const lat = numero(lugar.lat, -90, 90);
  const lng = numero(lugar.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, direccion: texto(lugar.direccion, MAX_DIRECCION) };
}

/**
 * El formulario entero. Todo obligatorio salvo nada: sin email no hay a quién
 * escribir, sin teléfono no hay a quién llamar si algo no cuadra, sin el local en
 * el mapa no sabemos dónde ir.
 * @returns {{datos: {tienda:string, nombre:string, email:string, telefono:string, lugar:{lat:number,lng:number,direccion:string|null}}, errores: null}
 *   | {datos: null, errores: Record<string,string>}}
 */
export function leerAlta(cuerpo = {}) {
  const c = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const errores = {};
  const tienda = texto(c.tienda, MAX_NOMBRE_TIENDA);
  const nombre = texto(c.nombre, MAX_NOMBRE_PERSONA);
  const email = leerEmail(c.email);
  const telefono = leerTelefono(c.telefono);
  const lugar = leerLugar(c.lugar);
  if (!tienda) errores.tienda = "¿Cómo se llama tu cafetería?";
  if (!nombre) errores.nombre = "¿Cómo te llamas?";
  if (!email) errores.email = "Revisa el email";
  if (!telefono) errores.telefono = "Revisa el teléfono: de 9 a 15 cifras";
  if (!lugar) errores.lugar = "Marca tu local en el mapa";
  if (c.acepto !== true) errores.acepto = "Hace falta que aceptes las condiciones";
  if (Object.keys(errores).length) return { datos: null, errores };
  return { datos: { tienda, nombre, email: email.toLowerCase(), telefono, lugar }, errores: null };
}

/**
 * Lo guardado en `negocio.alta`, limpio, o null si la tienda no llegó así.
 * @returns {{fecha:string, nombre:string|null, email:string|null, telefono:string|null, lugar:object|null}|null}
 */
export function normalizarAlta(alta) {
  if (!alta || typeof alta !== "object" || typeof alta.fecha !== "string") return null;
  return {
    fecha: alta.fecha,
    nombre: texto(alta.nombre, MAX_NOMBRE_PERSONA),
    email: leerEmail(alta.email),
    telefono: leerTelefono(alta.telefono),
    lugar: leerLugar(alta.lugar),
  };
}

/** Del nombre de la tienda, un slug: minúsculas, sin acentos, con guiones. */
export function slugDeNombre(nombre) {
  const base = String(nombre || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " y ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 26).replace(/-+$/, "");
  return base.length >= 2 ? base : "tienda";
}

/** Distancia en metros entre dos puntos (para avisar de dos altas en el mismo local). */
export function metrosEntre(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Más cerca que esto de otra tienda activa: el admin lo ve marcado. */
export const METROS_MISMO_LOCAL = 60;
