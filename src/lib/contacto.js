// ============================================================================
// CONTACTO DE LA TIENDA (reverso de la tarjeta)
// ----------------------------------------------------------------------------
// Teléfono, web e Instagram: lo que el cliente busca al darle la vuelta a la
// tarjeta. Se escribe en el editor del manager y sale en los dos sitios:
//   Apple   backFields, con enlace (attributedValue) que iOS deja tocar
//   Google  linksModuleData de la clase: botones de "Llamar", "Web"…
// Funciones puras: las usan el pase, el objeto de Google y la vista previa.
// ============================================================================

const MAX = { telefono: 20, web: 120, instagram: 30 };

/**
 * Lo que escribe el manager, limpio. Vacío = no se pone.
 * @returns {{contacto: {telefono?:string, web?:string, instagram?:string} | null} | {error:string}}
 */
export function normalizarContacto(entrada) {
  if (entrada === null || entrada === undefined) return { contacto: null };
  if (typeof entrada !== "object") return { error: "Contacto no válido" };
  const out = {};

  const tel = typeof entrada.telefono === "string" ? entrada.telefono.trim() : "";
  if (tel) {
    // Solo lo que se marca: números, espacios y el + del prefijo.
    if (!/^\+?[0-9 ]{6,}$/.test(tel) || tel.length > MAX.telefono || tel.replace(/\D/g, "").length < 6) {
      return { error: "Teléfono no válido: solo números, espacios y + delante" };
    }
    out.telefono = tel.replace(/\s+/g, " ");
  }

  const web = typeof entrada.web === "string" ? entrada.web.trim() : "";
  if (web) {
    const url = urlDeWeb(web);
    if (!url) return { error: "Web no válida (por ejemplo: latienda.es)" };
    out.web = url;
  }

  const ig = typeof entrada.instagram === "string" ? entrada.instagram.trim() : "";
  if (ig) {
    // Vale "@tienda", "tienda" o el enlace entero: se queda el usuario.
    const usuario = ig.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
    if (!/^[A-Za-z0-9._]{1,30}$/.test(usuario)) return { error: "Instagram no válido: el usuario, como @latienda" };
    out.instagram = usuario;
  }

  return { contacto: Object.keys(out).length ? out : null };
}

/** "latienda.es" -> "https://latienda.es". Solo http(s) y con un dominio de verdad. */
function urlDeWeb(texto) {
  if (texto.length > MAX.web) return null;
  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;
  try {
    const u = new URL(conEsquema);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** La web sin "https://" ni "www.": como se lee en voz alta. */
export const webLegible = (url) => String(url).replace(/^https?:\/\/(www\.)?/i, "");

/**
 * Los enlaces del contacto, en el orden en que salen en la tarjeta.
 * @returns {{id:string, etiqueta:string, texto:string, uri:string}[]}
 */
export function enlacesDeContacto(contacto) {
  if (!contacto) return [];
  const out = [];
  if (contacto.telefono) out.push({ id: "telefono", etiqueta: "Teléfono", texto: contacto.telefono, uri: `tel:${contacto.telefono.replace(/\s/g, "")}` });
  if (contacto.web) out.push({ id: "web", etiqueta: "Web", texto: webLegible(contacto.web), uri: contacto.web });
  if (contacto.instagram) out.push({ id: "instagram", etiqueta: "Instagram", texto: `@${contacto.instagram}`, uri: `https://instagram.com/${contacto.instagram}` });
  return out;
}
