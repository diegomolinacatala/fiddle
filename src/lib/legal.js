// ============================================================================
// LO LEGAL QUE EL CÓDIGO TIENE QUE CUMPLIR (ver docs/RGPD.md)
// ----------------------------------------------------------------------------
// Los números que promete /privacidad y que firma el contrato con cada tienda
// viven AQUÍ, una vez: la página los lee, la pasada diaria (lib/limpieza.js)
// los cumple. Cambiar un plazo = cambiarlo aquí, subir VERSION_AVISO y avisar
// a las tiendas (va en su contrato).
// ============================================================================

/**
 * Fecha del aviso de privacidad, que es también su VERSIÓN: cada tarjeta guarda
 * la que vio al darse de alta (`clientes.aviso_version`). Subirla cada vez que
 * cambie lo que dice /privacidad.
 */
export const VERSION_AVISO = "2026-10-04";
export const VERSION_AVISO_TEXTO = "4 de octubre de 2026";

/** Una tarjeta sin ninguna actividad en este tiempo se borra sola. */
export const MESES_SIN_USO = 24;
/** Una tienda archivada se borra entera pasado este tiempo. */
export const DIAS_BAJA_TIENDA = 30;
/**
 * Lo que tarda en caer la fila de un cliente que pidió el borrado. Hasta
 * entonces está vacía y anulada: es el tiempo que necesita su iPhone para
 * bajarse el pase anulado (si la fila ya no estuviera, se quedaría la tarjeta
 * vieja, con pinta de válida).
 */
export const HORAS_HASTA_PURGA = 24;

const DIA = 24 * 60 * 60 * 1000;
/** Antes de esta fecha (ISO), nada se guarda: el plazo de los clientes y de su historial. */
export const limiteSinUso = (ahora = Date.now()) => {
  const d = new Date(ahora);
  d.setUTCMonth(d.getUTCMonth() - MESES_SIN_USO);
  return d.toISOString();
};
export const limiteBajaTienda = (ahora = Date.now()) => new Date(ahora - DIAS_BAJA_TIENDA * DIA).toISOString();
export const limitePurga = (ahora = Date.now()) => new Date(ahora - HORAS_HASTA_PURGA * 60 * 60 * 1000).toISOString();

/**
 * Quién trata los datos por la tienda, y dónde. Lo enseña /privacidad (art. 13
 * y 28). Si cambia un proveedor, cambia aquí y en el contrato. La garantía de
 * cada uno hay que comprobarla en su DPA al firmarlo (NEXT-STEPS, Legal): esto
 * dice lo que publican hoy, no lo que hemos firmado.
 */
export const SUBENCARGADOS = [
  { quien: "Supabase", para: "Base de datos", donde: "Londres (Reino Unido)", garantia: "Empresa de EE. UU.: contrato de tratamiento (DPA) con cláusulas contractuales tipo de la UE" },
  { quien: "Vercel", para: "Servidor web", donde: "Londres (Reino Unido)", garantia: "Empresa de EE. UU.: DPA con cláusulas contractuales tipo y Data Privacy Framework" },
  { quien: "Apple", para: "Apple Wallet y los avisos de Safari", donde: "EE. UU. y UE", garantia: "Data Privacy Framework" },
  { quien: "Google", para: "Google Wallet y los avisos de Chrome", donde: "EE. UU. y UE", garantia: "Data Privacy Framework" },
  { quien: "Mozilla", para: "Los avisos de Firefox, si los activas ahí", donde: "EE. UU.", garantia: "El aviso viaja cifrado: Mozilla no puede leerlo" },
];

const LARGO = { razonSocial: 120, nif: 20, direccion: 200, email: 120 };
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * La identidad legal de una tienda (`config.legal`): razón social, NIF, dirección
 * y un email. El email sirve para que el cliente ejerza sus derechos y para que
 * le avisemos de una brecha (un campo, dos usos). null si no hay nada.
 * @returns {{razonSocial:string|null, nif:string|null, direccion:string|null, email:string|null}|null}
 */
export function normalizarLegal(entrada) {
  if (!entrada || typeof entrada !== "object") return null;
  const limpio = (k) => {
    const v = typeof entrada[k] === "string" ? entrada[k].replace(/\s+/g, " ").trim().slice(0, LARGO[k]) : "";
    return v || null;
  };
  const legal = { razonSocial: limpio("razonSocial"), nif: limpio("nif")?.toUpperCase() ?? null, direccion: limpio("direccion"), email: limpio("email") };
  if (legal.email && !EMAIL.test(legal.email)) legal.email = null;
  return Object.values(legal).some(Boolean) ? legal : null;
}

/** ¿Le falta algo de lo que pide el art. 13.1.a? */
export const legalCompleto = (legal) => Boolean(legal?.razonSocial && legal?.nif && legal?.email);
