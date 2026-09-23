import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ============================================================================
// CIFRADO DE CAMPOS (datos personales de los clientes)
// ----------------------------------------------------------------------------
// Supabase ya cifra el disco y las copias. Esto cubre otra cosa: que quien vea
// la base (el editor SQL, una exportación, una copia que se filtra) lea "Ana" o
// "sin lactosa". Con esto ve "v1:..." y sin CIFRADO_CLAVE, que solo vive en
// Vercel, no saca nada.
//
// AES-256-GCM: cada valor lleva su nonce (el mismo nombre cifra distinto cada
// vez) y su etiqueta (si alguien lo toca, no se descifra). Va atado a su cliente
// y su columna (AAD "serial:campo"): copiar la nota de uno a otro no funciona.
//
// Guardado: "v1:" + base64url(nonce 12 | etiqueta 16 | cifrado). El prefijo
// separa lo cifrado de lo de antes, que se sigue leyendo tal cual hasta que se
// cifra (store.cifrarPendientes), y deja sitio para una v2 si se cambia la clave.
//
// SIN CLAVE se guarda en claro: en local y en demo no hace falta. En producción
// lo dice el panel de estado. PERDER LA CLAVE ES PERDER LOS DATOS: guardarla
// también fuera de Vercel.
// ============================================================================

const PREFIJO = "v1:";
const NONCE = 12;
const ETIQUETA = 16;

/** @returns {{ok:true} | {ok:false, problema:"falta"|"mal"}} */
export function estadoClaveCifrado() {
  const valor = process.env.CIFRADO_CLAVE?.trim();
  if (!valor) return { ok: false, problema: "falta" };
  return Buffer.from(valor, "base64").length === 32 ? { ok: true } : { ok: false, problema: "mal" };
}

function clave() {
  const estado = estadoClaveCifrado();
  if (estado.ok) return Buffer.from(process.env.CIFRADO_CLAVE.trim(), "base64");
  if (estado.problema === "mal") throw new Error("CIFRADO_CLAVE tiene que ser 32 bytes en base64");
  return null;
}

const aad = ({ serial, campo }) => Buffer.from(`${serial}:${campo}`, "utf8");

// El prefijo solo no basta: una nota de antes podría decir "v1: reservado". Lo
// cifrado es base64url sin espacios y nunca más corto que nonce + etiqueta + 1.
const FORMA = /^v1:[A-Za-z0-9_-]{39,}$/;
export const estaCifrado = (valor) => typeof valor === "string" && FORMA.test(valor);

/**
 * @param {string|null|undefined} texto
 * @param {{serial:string, campo:string}} contexto a qué cliente y columna va
 * @returns {string|null} lo que se guarda en la base
 */
export function cifrar(texto, contexto) {
  if (texto == null || texto === "") return null;
  const k = clave();
  if (!k) return texto;
  const nonce = randomBytes(NONCE);
  const cifrador = createCipheriv("aes-256-gcm", k, nonce);
  cifrador.setAAD(aad(contexto));
  const cifrado = Buffer.concat([cifrador.update(String(texto), "utf8"), cifrador.final()]);
  return PREFIJO + Buffer.concat([nonce, cifrador.getAuthTag(), cifrado]).toString("base64url");
}

/**
 * Lo contrario de `cifrar`. Lo que no lleva el prefijo es de antes y va tal cual.
 * Si no se puede descifrar (sin clave, otra clave, valor tocado) devuelve null y
 * lo apunta: una ficha sin nombre es mejor que una pantalla rota.
 * @param {{serial:string, campo:string}} contexto
 */
export function descifrar(valor, contexto) {
  if (!estaCifrado(valor)) return valor ?? null;
  try {
    const k = clave();
    if (!k) throw new Error("falta CIFRADO_CLAVE");
    const datos = Buffer.from(valor.slice(PREFIJO.length), "base64url");
    const descifrador = createDecipheriv("aes-256-gcm", k, datos.subarray(0, NONCE));
    descifrador.setAAD(aad(contexto));
    descifrador.setAuthTag(datos.subarray(NONCE, NONCE + ETIQUETA));
    return Buffer.concat([descifrador.update(datos.subarray(NONCE + ETIQUETA)), descifrador.final()]).toString("utf8");
  } catch (e) {
    console.error(`[cifrado] no se pudo descifrar ${contexto.campo} de ${contexto.serial}: ${e.message}`);
    return null;
  }
}
