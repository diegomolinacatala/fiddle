import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { SEMILLAS, componerNegocio, configInicial, esSlug } from "./negocios";
import { codigoDesdeSerial, codigoLibre, normalizarCodigo } from "./codigo";
import { cifrar, descifrar, estaCifrado, estadoClaveCifrado } from "./cifrado";
import { UMBRALES } from "./crm";

// ============================================================================
// ALMACENAMIENTO
// ----------------------------------------------------------------------------
// Supabase (real) si están SUPABASE_URL + SUPABASE_SERVICE_KEY; si no, ficheros
// JSON en .data/ (demo local; en Vercel NO persisten). Misma API para los dos.
// ============================================================================

export const hasSupabase = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function supa() {
  // trim(): al pegar en Vercel es fácil colar un espacio o salto de línea.
  return createClient(process.env.SUPABASE_URL.trim().replace(/\/+$/, ""), process.env.SUPABASE_SERVICE_KEY.trim(), {
    auth: { persistSession: false },
  });
}

// Tablas que crea supabase/schema.sql (las comprueba el diagnóstico del manager).
export const TABLAS = ["negocios", "clientes", "eventos", "dispositivos", "registros", "intentos", "campanas", "tarjetas_de_dispositivo", "accesos", "invitaciones", "tutoriales", "borrados", "auditoria"];

/**
 * ¿Supabase responde y existen todas las tablas? Consulta barata (solo cuenta).
 * @returns {Promise<{ok:true} | {ok:false, tabla:string, error:string}>}
 */
export async function comprobarTablas() {
  const db = supa();
  for (const tabla of TABLAS) {
    const { error } = await db.from(tabla).select("*", { count: "exact", head: true });
    if (error) return { ok: false, tabla, error: error.message || String(error.code || "error desconocido") };
  }
  return { ok: true };
}

// Lanza con contexto si Supabase devolvió error. Nunca se traga fallos.
function sinError({ data, error, count }, contexto) {
  if (error) throw new Error(`Supabase ${contexto}: ${error.message}`);
  return count ?? data;
}

// ---------- Backend demo: ficheros JSON ----------
const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), ".data");
const fichero = (nombre) => path.join(dataDir(), `${nombre}.json`);

async function leer(nombre, fallback) {
  try {
    return JSON.parse(await fs.readFile(fichero(nombre), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw new Error(`No se pudo leer ${nombre}.json: ${e.message}`);
  }
}
async function escribir(nombre, data) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(fichero(nombre), JSON.stringify(data, null, 2));
}

// Todas las operaciones sobre ficheros pasan en fila: dos peticiones a la vez
// (p.ej. dos sellos seguidos) no pueden pisarse el read-modify-write ni leer un
// fichero a medio escribir. Solo afecta al modo demo (un proceso local).
let cola = Promise.resolve();
function enFila(fn) {
  const resultado = cola.then(fn, fn);
  cola = resultado.then(() => {}, () => {});
  return resultado;
}

const ahoraISO = () => new Date().toISOString();

// Trocea una lista larga. Una campaña a cientos de clientes no cabe en un solo
// `in (...)`: la URL que arma supabase-js se pasa de largo y la petición falla.
const LOTE = 200;
function* enLotes(lista, tam = LOTE) {
  for (let i = 0; i < lista.length; i += tam) yield lista.slice(i, i + tam);
}

// ============================ NEGOCIOS ============================
// Los negocios viven en la tabla `negocios` (slug, nombre, tipo, config). Las
// SEMILLAS de negocios.js solo se usan para que una base vacía traiga los tres
// de siempre: en cuanto hay fila, manda la fila.
//
// Un negocio archivado sigue en la base pero desaparece de todas partes: por
// eso `getNegocio` lo esconde salvo que se pida explícitamente.

// Fila guardada -> ficha completa. `null` si no hay fila ni semilla.
function componer(slug, fila) {
  if (!fila && !SEMILLAS[slug]) return null;
  return componerNegocio(slug, fila);
}

const visible = (n, incluirArchivados) => (n && (incluirArchivados || !n.archivado) ? n : null);

/**
 * @param {string} slug
 * @param {{incluirArchivados?: boolean}} [opciones] el admin sí quiere verlos
 */
export async function getNegocio(slug, { incluirArchivados = false } = {}) {
  if (!esSlug(slug)) return null;
  if (hasSupabase()) {
    const fila = sinError(
      await supa().from("negocios").select("nombre, tipo, config, creado").eq("slug", slug).maybeSingle(),
      "leer negocio",
    );
    return visible(componer(slug, fila), incluirArchivados);
  }
  return enFila(async () => visible(componer(slug, normalizarFila((await leer("negocios", {}))[slug])), incluirArchivados));
}

// El fichero de demo guardaba antes solo la config. Si no trae `config`, es del
// formato viejo y el objeto entero ES la config.
const normalizarFila = (v) => (v && typeof v === "object" ? ("config" in v ? v : { config: v }) : null);

export async function listNegocios({ incluirArchivados = false } = {}) {
  const filas = hasSupabase()
    ? Object.fromEntries(
        (sinError(await supa().from("negocios").select("slug, nombre, tipo, config, creado"), "listar negocios") || [])
          .map((f) => [f.slug, f]),
      )
    : Object.fromEntries(
        Object.entries(await enFila(() => leer("negocios", {}))).map(([k, v]) => [k, normalizarFila(v)]),
      );

  // Semillas que aún no están en la base, para que un arranque limpio no salga vacío.
  const slugs = [...new Set([...Object.keys(SEMILLAS), ...Object.keys(filas)])];
  return slugs
    .map((slug) => visible(componer(slug, filas[slug]), incluirArchivados))
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Crea un negocio. Devuelve `{error}` si el slug ya está cogido o no vale. */
export async function crearNegocio({ slug, nombre, tipo, meta, premio, acciones, tema, brief }) {
  if (!esSlug(slug)) return { error: "El identificador solo admite minúsculas, números y guiones" };
  if (await getNegocio(slug, { incluirArchivados: true })) return { error: `Ya existe un negocio con el identificador "${slug}"` };

  const config = configInicial({ meta, premio, acciones, tema, brief });
  const fila = { slug, nombre, tipo, config, creado: ahoraISO() };
  if (hasSupabase()) {
    sinError(await supa().from("negocios").insert(fila), "crear negocio");
  } else {
    await enFila(async () => {
      const all = await leer("negocios", {});
      await escribir("negocios", { ...all, [slug]: fila });
    });
  }
  return { negocio: componer(slug, fila) };
}

// Mezcla la config guardada con lo que llega del manager o del admin. Solo
// toca las claves presentes en el patch: lo demás se queda como estaba.
function fusionarConfig(actual, patch) {
  const config = {
    meta: patch.meta ?? actual.meta,
    premio: patch.premio ?? actual.premio,
    acciones: patch.acciones ?? actual.acciones,
    promo: patch.promo !== undefined ? patch.promo : actual.promo,
    ubicaciones: patch.ubicaciones ?? actual.ubicaciones,
    tema: patch.tema ? { ...actual.tema, ...patch.tema } : actual.tema,
    brief: patch.brief ?? actual.brief,
    cartillas: patch.cartillas !== undefined ? patch.cartillas : actual.cartillas,
    // La segunda cartilla de una tienda que volvió a una: se recupera tal cual.
    cartillasAparcadas: patch.cartillasAparcadas !== undefined ? patch.cartillasAparcadas : actual.cartillasAparcadas,
    notas: patch.notas ?? actual.notas,
    archivado: patch.archivado ?? actual.archivado,
    // Avisos automáticos (lib/automatizaciones.js) y el horario del que dependen.
    horario: patch.horario !== undefined ? patch.horario : actual.horario,
    automatizaciones: patch.automatizaciones ?? actual.automatizaciones,
    pausaAvisos: patch.pausaAvisos ?? actual.pausaAvisos,
    limiteAvisosDia: patch.limiteAvisosDia ?? actual.limiteAvisosDia,
    avisosActivos: patch.avisosActivos ?? actual.avisosActivos,
    pedirNombre: patch.pedirNombre ?? actual.pedirNombre,
    caja: patch.caja ?? actual.caja,
    // Teléfono, web e Instagram del reverso (lib/contacto.js). null lo quita.
    contacto: patch.contacto !== undefined ? patch.contacto : actual.contacto,
    // El último "ABIERTO hasta 14:00" que el reloj empujó a los pases (lib/motorAvisos.js).
    estadoPase: patch.estadoPase !== undefined ? patch.estadoPase : actual.estadoPase,
    // Quién es la tienda ante la ley (lib/legal.js): lo pone el admin, lo lee /privacidad.
    legal: patch.legal !== undefined ? patch.legal : actual.legal,
    // Cuándo se archivó: a los DIAS_BAJA_TIENDA se borra sola (lib/limpieza.js).
    archivadoEn: patch.archivadoEn !== undefined ? patch.archivadoEn : actual.archivadoEn,
    // Automáticos y programados encendidos para esta tienda: solo lo cambia el admin.
    avisosAvanzados: patch.avisosAvanzados ?? actual.avisosAvanzados,
    // «Enviar a las…» (lib/envios.js) y lo que la tienda ha subido (lib/propios.js).
    enviosProgramados: patch.enviosProgramados ?? actual.enviosProgramados,
    propios: patch.propios ?? actual.propios,
  };
  return config;
}

/**
 * Guarda cambios de un negocio. `patch` puede traer también `nombre` y `tipo`
 * (los edita el admin) además de la config que toca el manager.
 */
export async function saveNegocio(slug, patch) {
  const actual = await getNegocio(slug, { incluirArchivados: true });
  if (!actual) return null;

  const config = fusionarConfig(actual, patch);
  const nombre = patch.nombre ?? actual.nombre;
  const tipo = patch.tipo ?? actual.tipo;
  const fila = { slug, nombre, tipo, config };

  if (hasSupabase()) {
    sinError(await supa().from("negocios").upsert(fila), "guardar negocio");
    return componer(slug, fila);
  }
  return enFila(async () => {
    const all = await leer("negocios", {});
    const creado = normalizarFila(all[slug])?.creado ?? ahoraISO();
    await escribir("negocios", { ...all, [slug]: { ...fila, creado } });
    return componer(slug, { ...fila, creado });
  });
}

// ---------------------------------------------------------- imágenes propias
// Lo que sube una tienda para su tarjeta: el logo (lib/logoImagen.js), sus
// iconos y las fotos de la banda (lib/propios.js), ya preparados. En Supabase
// van a Storage, a un cubo PRIVADO que se crea solo la primera vez: los sirven
// /api/logo y /api/fondo, así que no hace falta que sea público ni tocar la
// consola. En la demo, un fichero en .data/logos/.
const CUBO_LOGOS = "logos";
const EXTENSIONES = { png: "image/png", jpg: "image/jpeg" };
const rutaImagen = (slug, id, ext) => `${slug}/${id}.${ext}`;
const imagenValida = (slug, id, ext) => esSlug(slug) && /^[0-9a-f]{16,64}$/.test(id) && Object.hasOwn(EXTENSIONES, ext);

/** Guarda una imagen ya preparada. Si ya existía la misma, no pasa nada. */
export async function guardarImagen(slug, id, datos, ext = "png") {
  if (!imagenValida(slug, id, ext)) throw new Error("Imagen no válida");
  if (hasSupabase()) {
    const almacen = supa().storage;
    const subir = () => almacen.from(CUBO_LOGOS).upload(rutaImagen(slug, id, ext), datos, { contentType: EXTENSIONES[ext], upsert: true });
    let { error } = await subir();
    if (error && /bucket not found|not found/i.test(error.message || "")) {
      const creado = await almacen.createBucket(CUBO_LOGOS, { public: false });
      if (creado.error && !/already exists/i.test(creado.error.message || "")) throw new Error(`Supabase crear cubo de logos: ${creado.error.message}`);
      ({ error } = await subir());
    }
    if (error) throw new Error(`Supabase subir imagen: ${error.message}`);
    return;
  }
  const dir = path.join(dataDir(), "logos");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${slug}-${id}.${ext}`), datos);
}

/** La imagen guardada, o null si no está. */
export async function leerImagen(slug, id, ext = "png") {
  if (!imagenValida(slug, id, ext)) return null;
  if (hasSupabase()) {
    const { data, error } = await supa().storage.from(CUBO_LOGOS).download(rutaImagen(slug, id, ext));
    if (error) {
      if (/not found|object not found/i.test(error.message || "") || error.statusCode === "404") return null;
      throw new Error(`Supabase leer imagen: ${error.message}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(dataDir(), "logos", `${slug}-${id}.${ext}`));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

/** El logo propio (PNG): como siempre. */
export const guardarLogo = (slug, id, png) => guardarImagen(slug, id, png, "png");
export const leerLogo = (slug, id) => leerImagen(slug, id, "png");

/**
 * Archiva (o desarchiva) un negocio: desaparece de todo, pero no se pierde nada
 * todavía. La fecha es la cuenta atrás del borrado (lib/limpieza.js).
 */
export const archivarNegocio = (slug, archivado = true) =>
  saveNegocio(slug, { archivado, archivadoEn: archivado ? ahoraISO() : null });

/**
 * Borra un negocio PARA SIEMPRE, con sus clientes y su historial. No se puede
 * deshacer: los pases que ya estén en un teléfono dejan de actualizarse.
 * @returns {Promise<{borrados:number}>} clientes eliminados
 */
export async function borrarNegocio(slug) {
  // TODAS sus tarjetas, también las fusionadas y las que esperan a borrarse:
  // listClientes las esconde, pero sus filas y su historial siguen ahí.
  const seriales = await serialesDeNegocio(slug);

  // Los teléfonos que tenían tarjetas de esta tienda: los que se queden sin
  // ningún pase se borran al final, con su push token.
  const dispositivos = await dispositivosDeNegocio(slug, seriales);

  if (hasSupabase()) {
    const db = supa();
    // `registros` cae solo por la FK; los eventos van por serial, sin FK.
    for (const lote of enLotes(seriales)) sinError(await db.from("eventos").delete().in("serial", lote), "borrar eventos");
    sinError(await db.from("eventos").delete().eq("negocio", slug), "borrar eventos del negocio");
    sinError(await db.from("registros").delete().eq("negocio", slug), "borrar registros");
    sinError(await db.from("campanas").delete().eq("negocio", slug), "borrar campañas");
    sinError(await db.from("tarjetas_de_dispositivo").delete().eq("negocio", slug), "borrar tarjetas de dispositivo");
    sinError(await db.from("accesos").delete().eq("negocio", slug), "borrar accesos");
    sinError(await db.from("invitaciones").delete().eq("negocio", slug), "borrar invitaciones");
    sinError(await db.from("tutoriales").delete().eq("negocio", slug), "borrar tutoriales");
    sinError(await db.from("clientes").delete().eq("negocio", slug), "borrar clientes");
    sinError(await db.from("negocios").delete().eq("slug", slug), "borrar negocio");
    await borrarDispositivosSinRegistros(dispositivos);
    return { borrados: seriales.length };
  }
  return enFila(async () => {
    const negocios = await leer("negocios", {});
    delete negocios[slug];
    await escribir("negocios", negocios);

    const todos = await leer("clientes", {});
    await escribir("clientes", Object.fromEntries(Object.entries(todos).filter(([, c]) => c.negocio !== slug)));
    await escribir("eventos", (await leer("eventos", [])).filter((e) => !seriales.includes(e.serial) && e.negocio !== slug));

    const registros = await leer("registros", []);
    await escribir("registros", registros.filter((r) => !seriales.includes(r.serial) && r.negocio !== slug));
    await escribir("campanas", (await leer("campanas", [])).filter((c) => c.negocio !== slug));
    const tarjetas = await leer("tarjetas_de_dispositivo", {});
    await escribir("tarjetas_de_dispositivo", Object.fromEntries(Object.entries(tarjetas).filter(([, t]) => t.negocio !== slug)));
    const accesos = await leer("accesos", {});
    await escribir("accesos", Object.fromEntries(Object.entries(accesos).filter(([, a]) => a.negocio !== slug)));
    for (const tabla of ["invitaciones", "tutoriales"]) {
      const filas = await leer(tabla, {});
      await escribir(tabla, Object.fromEntries(Object.entries(filas).filter(([, f]) => f.negocio !== slug)));
    }
    await quitarDispositivosSinRegistros(dispositivos);
    return { borrados: seriales.length };
  });
}

async function serialesDeNegocio(slug) {
  if (hasSupabase()) {
    return (sinError(await supa().from("clientes").select("serial").eq("negocio", slug), "leer tarjetas del negocio") || []).map((c) => c.serial);
  }
  return Object.values(await enFila(() => leer("clientes", {}))).filter((c) => c.negocio === slug).map((c) => c.serial);
}

// Dispositivos con algún registro de esta tienda (por negocio o por sus seriales).
async function dispositivosDeNegocio(slug, seriales) {
  const mios = new Set(seriales);
  if (hasSupabase()) {
    const filas = sinError(await supa().from("registros").select("dispositivo").eq("negocio", slug), "leer dispositivos del negocio") || [];
    for (const lote of enLotes(seriales)) {
      filas.push(...(sinError(await supa().from("registros").select("dispositivo").in("serial", lote), "leer dispositivos de las tarjetas") || []));
    }
    return [...new Set(filas.map((r) => r.dispositivo))];
  }
  const registros = await enFila(() => leer("registros", []));
  return [...new Set(registros.filter((r) => r.negocio === slug || mios.has(r.serial)).map((r) => r.dispositivo))];
}

/**
 * Borra, de estos dispositivos, los que ya no tienen ningún registro. Un iPhone
 * sin pases no tiene por qué dejar aquí su push token: `registros` cae en
 * cascada al borrar un cliente, `dispositivos` no.
 */
export async function borrarDispositivosSinRegistros(ids) {
  if (!ids.length) return 0;
  if (hasSupabase()) {
    const db = supa();
    const conRegistro = new Set();
    for (const lote of enLotes(ids)) {
      for (const r of sinError(await db.from("registros").select("dispositivo").in("dispositivo", lote), "leer registros vivos") || []) {
        conRegistro.add(r.dispositivo);
      }
    }
    const fuera = ids.filter((id) => !conRegistro.has(id));
    for (const lote of enLotes(fuera)) sinError(await db.from("dispositivos").delete().in("id", lote), "borrar dispositivos huérfanos");
    return fuera.length;
  }
  return enFila(() => quitarDispositivosSinRegistros(ids));
}

// Lo mismo en ficheros, ya dentro de la fila (enFila no se puede anidar).
async function quitarDispositivosSinRegistros(ids) {
  const vivos = new Set((await leer("registros", [])).map((r) => r.dispositivo));
  const dispositivos = await leer("dispositivos", {});
  const fuera = ids.filter((id) => !vivos.has(id) && dispositivos[id]);
  if (fuera.length) await escribir("dispositivos", Object.fromEntries(Object.entries(dispositivos).filter(([id]) => !fuera.includes(id))));
  return fuera.length;
}

// ============================ CLIENTES ============================
const CAMPOS_CLIENTE =
  "serial, negocio, codigo, sellos, sellos2, premios, nombre, auth_token, actualizado, creado, " +
  "visitas, ultima_visita, instalado, desinstalado, origen, mensaje, nota, guardados, guardados2, fusionado_en, " +
  "promos_no, aviso_version, borrado_en";

// Datos personales de un cliente: van cifrados en la base (lib/cifrado.js). Se
// cifran al guardarlos y se descifran aquí, al leer: lo demás del código los ve
// en claro y no tiene que saber nada de esto.
const PERSONALES = ["nombre", "nota"];

// El saldo de la tarjeta: lo que mueve la caja y se guarda con guardado optimista.
const SALDO = ["sellos", "sellos2", "premios", "guardados", "guardados2"];
const cifrarCampo = (serial, campo, valor) => cifrar(valor, { serial, campo });
const descifrarCampo = (c, campo) => descifrar(c[campo] ?? null, { serial: c.serial, campo });

function normalizarCliente(c) {
  return c
    ? {
        serial: c.serial,
        negocio: c.negocio,
        // Clientes creados antes del código corto: se deduce del serial (estable).
        codigo: c.codigo || codigoDesdeSerial(c.serial),
        sellos: c.sellos ?? 0,
        // La segunda cartilla, en las tiendas que llevan dos (ver lib/cartillas.js).
        sellos2: c.sellos2 ?? 0,
        premios: c.premios ?? 0,
        // Premios que el cliente se guardó sin gastar, uno por cartilla.
        guardados: c.guardados ?? 0,
        guardados2: c.guardados2 ?? 0,
        // Serial de la tarjeta que sustituyó a esta (mismo iPhone, ver unaTarjeta.js).
        fusionado_en: c.fusionado_en ?? null,
        nombre: descifrarCampo(c, "nombre"),
        auth_token: c.auth_token ?? null,
        actualizado: c.actualizado ?? c.creado ?? null,
        creado: c.creado ?? null,
        // CRM: resumen del historial que se mantiene al vuelo (ver registrarVisita).
        visitas: c.visitas ?? 0,
        ultima_visita: c.ultima_visita ?? null,
        instalado: c.instalado ?? null,
        desinstalado: c.desinstalado ?? null,
        origen: c.origen ?? null,
        mensaje: c.mensaje ?? null,
        nota: descifrarCampo(c, "nota"),
        // RGPD: cuándo dijo que no a las promos (null = las recibe), qué aviso de
        // privacidad vio al darse de alta y si se pidió borrarla (docs/RGPD.md).
        promos_no: c.promos_no ?? null,
        aviso_version: c.aviso_version ?? null,
        borrado_en: c.borrado_en ?? null,
      }
    : null;
}

/** Lo que puede salir hacia el navegador: sin auth_token. */
export const clientePublico = (c) =>
  c && {
    serial: c.serial, negocio: c.negocio, codigo: c.codigo, sellos: c.sellos, sellos2: c.sellos2 ?? 0, premios: c.premios,
    guardados: c.guardados ?? 0, guardados2: c.guardados2 ?? 0,
    nombre: c.nombre ?? null, creado: c.creado ?? null,
    // El CRM no es secreto para quien ya puede ver al cliente: la caja también
    // agradece saber que este viene cada tres días y lleva dos semanas sin pasar.
    visitas: c.visitas ?? 0, ultima_visita: c.ultima_visita ?? null,
    instalado: c.instalado ?? null, desinstalado: c.desinstalado ?? null,
    origen: c.origen ?? null, mensaje: c.mensaje ?? null, nota: c.nota ?? null,
    promos_no: c.promos_no ?? null, borrado_en: c.borrado_en ?? null,
  };

/**
 * @param {{serial:string, negocio:string, authToken:string, origen?:string, nombre?:string|null}} datos
 *   `origen`: de dónde salió el pase ("tap" en el tag NFC, "manager" desde el
 *   mostrador). Responde a "¿de dónde vienen mis clientes?" sin preguntárselo.
 *   `nombre`: el que escribe el cliente al sacarla. Se guarda cifrado, como siempre.
 */
export async function crearCliente({ serial, negocio, authToken, origen = null, nombre = null, avisoVersion = null }) {
  const ts = ahoraISO();
  const base = {
    serial, negocio, auth_token: authToken,
    sellos: 0, sellos2: 0, premios: 0, guardados: 0, guardados2: 0,
    nombre: cifrarCampo(serial, "nombre", nombre), actualizado: ts, creado: ts,
    visitas: 0, ultima_visita: null, instalado: null, desinstalado: null,
    origen, mensaje: null, nota: null,
    promos_no: null, aviso_version: avisoVersion, borrado_en: null,
  };
  // El código corto solo tiene que ser único DENTRO del negocio: se mira qué
  // códigos tiene ya esta tienda, no la plataforma entera.
  if (hasSupabase()) {
    const usados = sinError(
      await supa().from("clientes").select("serial, codigo").eq("negocio", negocio),
      "leer códigos del negocio",
    ) || [];
    const fila = { ...base, codigo: codigoLibre(new Set(usados.map((c) => c.codigo || codigoDesdeSerial(c.serial))), serial) };
    sinError(await supa().from("clientes").insert(fila), "crear cliente");
    return normalizarCliente(fila);
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const usados = new Set(
      Object.values(all).filter((c) => c.negocio === negocio).map((c) => c.codigo || codigoDesdeSerial(c.serial)),
    );
    const fila = { ...base, codigo: codigoLibre(usados, serial) };
    await escribir("clientes", { ...all, [serial]: fila });
    return normalizarCliente(fila);
  });
}

/**
 * Cliente por su código corto DENTRO de un negocio ("K7M" en nube). Devuelve
 * null si no existe: el mismo código en otra tienda es otro cliente distinto.
 */
export async function getClientePorCodigo(negocio, codigo) {
  const cod = normalizarCodigo(codigo);
  if (!cod || !esSlug(negocio)) return null;
  const lista = await listClientes(negocio);
  return lista.find((c) => c.codigo === cod) || null;
}

export async function getCliente(serial) {
  if (typeof serial !== "string" || !serial) return null;
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("clientes").select(CAMPOS_CLIENTE).eq("serial", serial).maybeSingle(),
      "leer cliente",
    );
    return normalizarCliente(data);
  }
  return enFila(async () => normalizarCliente((await leer("clientes", {}))[serial]));
}

/**
 * Guarda sellos y premios del cliente y marca `actualizado` (lo que Apple Wallet
 * consulta para saber si hay pase nuevo).
 *
 * Con `esperado` es un guardado OPTIMISTA: solo escribe si en la base sigue el
 * estado que se leyó. Así dos cajas que canjean a la vez no entregan el premio
 * dos veces: la segunda recibe `false` y debe reintentar con el estado nuevo.
 *
 * @param {{serial:string, sellos:number, sellos2?:number, premios:number, guardados?:number, guardados2?:number}} cliente
 * @param {{esperado?: {sellos:number, sellos2?:number, premios:number, guardados?:number, guardados2?:number}}} [opciones]
 * @returns {Promise<boolean>} true si se guardó
 */
export async function saveCliente(cliente, { esperado } = {}) {
  const patch = { actualizado: ahoraISO() };
  for (const k of SALDO) patch[k] = cliente[k] || 0;

  if (hasSupabase()) {
    let q = supa().from("clientes").update(patch).eq("serial", cliente.serial);
    if (esperado) for (const k of SALDO) q = q.eq(k, esperado[k] || 0);
    const filas = sinError(await q.select("serial"), "guardar cliente");
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const actual = all[cliente.serial];
    if (!actual) return false;
    if (esperado && SALDO.some((k) => (actual[k] || 0) !== (esperado[k] || 0))) {
      return false;
    }
    await escribir("clientes", { ...all, [cliente.serial]: { ...actual, ...patch } });
    return true;
  });
}

/** Cambia SOLO el nombre (no pisa sellos que otra caja esté poniendo a la vez). */
export async function guardarNombre(serial, nombre) {
  const patch = { nombre: cifrarCampo(serial, "nombre", nombre), actualizado: ahoraISO() };
  if (hasSupabase()) {
    const filas = sinError(
      await supa().from("clientes").update(patch).eq("serial", serial).select("serial"),
      "guardar nombre",
    );
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    if (!all[serial]) return false;
    await escribir("clientes", { ...all, [serial]: { ...all[serial], ...patch } });
    return true;
  });
}

/** Marca como actualizados TODOS los pases de un negocio (promo, cambio de config). */
export async function tocarClientesDeNegocio(slug) {
  const ts = ahoraISO();
  if (hasSupabase()) {
    sinError(await supa().from("clientes").update({ actualizado: ts }).eq("negocio", slug), "tocar clientes");
    return;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const nuevos = Object.fromEntries(
      Object.entries(all).map(([k, c]) => [k, c.negocio === slug ? { ...c, actualizado: ts } : c]),
    );
    await escribir("clientes", nuevos);
  });
}

/**
 * Clientes (recientes primero). `limite` para pantallas; sin él, todos (envíos masivos).
 * @param {string} [negocio] @param {{limite?: number}} [opciones]
 */
export async function listClientes(negocio, { limite } = {}) {
  if (hasSupabase()) {
    // Las tarjetas fusionadas en otra (ver unaTarjeta.js) ya no son clientes:
    // su historial y sus sellos viven en la que las sustituyó.
    // Tampoco las que se pidió borrar: esperan a la pasada diaria, ya vacías.
    let q = supa().from("clientes").select(CAMPOS_CLIENTE).is("fusionado_en", null).is("borrado_en", null)
      .order("creado", { ascending: false });
    if (negocio) q = q.eq("negocio", negocio);
    if (limite) q = q.limit(limite);
    return (sinError(await q, "listar clientes") || []).map(normalizarCliente);
  }
  const all = await enFila(() => leer("clientes", {}));
  const lista = Object.values(all)
    .filter((c) => (!negocio || c.negocio === negocio) && !c.fusionado_en && !c.borrado_en)
    .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""))
    .map(normalizarCliente);
  return limite ? lista.slice(0, limite) : lista;
}

// ============================ EVENTOS ============================
// El historial. `negocio` va desnormalizado porque el CRM pregunta siempre por
// tienda ("toda la actividad de nube"), y sin esa columna habría que leer antes
// sus miles de seriales solo para poder filtrar por ellos.

/**
 * @param {string} serial
 * @param {string} tipo    clave de acción, o `alta` / `instalado` / `desinstalado` / `campana`
 * @param {string} mensaje texto ya montado, tal cual se lee en la ficha
 * @param {{negocio?:string, actor?:string}} [contexto] `actor`: caja, manager, admin, cliente, apple
 */
export async function addEvento(serial, tipo, mensaje, { negocio = null, actor = null } = {}) {
  const fila = { serial, tipo, mensaje, negocio, actor };
  if (hasSupabase()) {
    sinError(await supa().from("eventos").insert(fila), "guardar evento");
    return;
  }
  return enFila(async () => {
    const all = await leer("eventos", []);
    await escribir("eventos", [...all, { ...fila, ts: ahoraISO() }]);
  });
}

/**
 * Varios eventos de golpe (una campaña deja rastro en la ficha de cada cliente).
 * Un insert por lote: cien clientes no pueden ser cien viajes a la base.
 * @param {{serial:string, tipo:string, mensaje:string, negocio?:string, actor?:string}[]} filas
 */
export async function addEventos(filas) {
  if (!filas.length) return;
  const completas = filas.map((f) => ({ negocio: null, actor: null, ...f }));
  if (hasSupabase()) {
    for (const lote of enLotes(completas)) {
      sinError(await supa().from("eventos").insert(lote), "guardar eventos");
    }
    return;
  }
  return enFila(async () => {
    const all = await leer("eventos", []);
    const ts = ahoraISO();
    await escribir("eventos", [...all, ...completas.map((f) => ({ ...f, ts }))]);
  });
}

const CAMPOS_EVENTO = "serial, tipo, mensaje, actor, ts";

export async function listEventos(serial, limit = 8) {
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("eventos").select(CAMPOS_EVENTO).eq("serial", serial)
        .order("ts", { ascending: false }).limit(limit),
      "listar eventos",
    );
    return data || [];
  }
  const all = await enFila(() => leer("eventos", []));
  return all
    .filter((e) => e.serial === serial)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit);
}

/**
 * Historial de TODA una tienda, para las cuentas del CRM (visitas por día, a qué
 * horas viene la gente, si una campaña sirvió de algo).
 *
 * Va con tope a propósito: el panel mira una ventana de tiempo, no la historia
 * entera. Un negocio que roce el tope necesita cuentas en SQL, no más filas aquí.
 *
 * @param {string} negocio
 * @param {{dias?:number, limite?:number}} [opciones]
 */
export async function listEventosDeNegocio(negocio, { dias = 120, limite = 5000 } = {}) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("eventos").select(CAMPOS_EVENTO).eq("negocio", negocio).gt("ts", desde)
        .order("ts", { ascending: false }).limit(limite),
      "listar eventos del negocio",
    );
    return data || [];
  }
  // En ficheros no hay columna indexada: se filtra por los seriales de la tienda.
  const [eventos, clientes] = await enFila(() => Promise.all([leer("eventos", []), leer("clientes", {})]));
  const mios = new Set(Object.values(clientes).filter((c) => c.negocio === negocio).map((c) => c.serial));
  return eventos
    .filter((e) => (e.negocio === negocio || mios.has(e.serial)) && e.ts > desde)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limite);
}

// ============================ CRM ============================
// Lo que convierte el historial en algo consultable: el resumen de visitas que
// llevan los propios clientes, el mensaje personal de las campañas y la nota
// que la tienda apunta a mano.

/**
 * Suma una visita y pone la fecha. Se llama cuando la caja hace algo con el
 * cliente DELANTE (sellar, canjear, confirmar); una corrección no es una visita.
 *
 * De paso BORRA el mensaje de campaña: si le dijimos "hace tiempo que no te
 * vemos" y ha venido, el mensaje ya cumplió, y dejarlo puesto sería decírselo a
 * la cara cada vez que abre el pase. Va en el mismo UPDATE, sin viaje extra.
 *
 * Lo que pasa en el mostrador en un rato es UNA visita: un sello y el canje, o
 * tres sellos de una compra grande, no suman tres (UMBRALES.horasVisita). La
 * fecha sí se mueve: es la última vez que se le vio.
 *
 * Lee y escribe (Supabase no incrementa sin RPC). Si dos cajas sellan al mismo
 * cliente en el mismo instante se puede perder un +1: es un contador para
 * agrupar gente, no el saldo de la cartilla —eso sí va con guardado optimista.
 */
export async function registrarVisita(serial, ts = ahoraISO()) {
  const visitasTras = (c) => (mismaVisita(c.ultima_visita, ts) ? c.visitas || 0 : (c.visitas || 0) + 1);
  if (hasSupabase()) {
    const actual = sinError(
      await supa().from("clientes").select("visitas, ultima_visita").eq("serial", serial).maybeSingle(),
      "leer visitas",
    );
    if (!actual) return false;
    sinError(
      await supa().from("clientes")
        .update({ visitas: visitasTras(actual), ultima_visita: ts, mensaje: null })
        .eq("serial", serial),
      "registrar visita",
    );
    return true;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const c = all[serial];
    if (!c) return false;
    await escribir("clientes", {
      ...all,
      [serial]: { ...c, visitas: visitasTras(c), ultima_visita: ts, mensaje: null },
    });
    return true;
  });
}

const mismaVisita = (antes, ahora) => {
  const t = Date.parse(antes || "");
  return Boolean(t) && Date.parse(ahora) - t < UMBRALES.horasVisita * 60 * 60 * 1000;
};

/**
 * Marca cuándo el pase entró en un Wallet o salió del último iPhone que lo
 * tenía. Lo llama el web service de Apple, que es el único que se entera.
 *
 * `instalado` es la fecha en que se añadió por primera vez y no se reescribe;
 * `desinstalado` sí, y se limpia si el pase vuelve a entrar.
 *
 * @param {string} serial
 * @param {boolean} dentro true al registrarse, false al borrar el último registro
 */
export async function marcarInstalacion(serial, dentro) {
  const ts = ahoraISO();
  if (hasSupabase()) {
    const db = supa();
    if (dentro) {
      // `is null` en el where: la primera instalación pone fecha, las siguientes no.
      sinError(await db.from("clientes").update({ instalado: ts }).eq("serial", serial).is("instalado", null), "marcar instalado");
      sinError(await db.from("clientes").update({ desinstalado: null }).eq("serial", serial), "limpiar desinstalado");
    } else {
      sinError(await db.from("clientes").update({ desinstalado: ts }).eq("serial", serial), "marcar desinstalado");
    }
    return;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const c = all[serial];
    if (!c) return;
    const nuevo = dentro ? { ...c, instalado: c.instalado || ts, desinstalado: null } : { ...c, desinstalado: ts };
    await escribir("clientes", { ...all, [serial]: nuevo });
  });
}

/**
 * Escribe el mensaje personal que sale EN el pase de varios clientes a la vez
 * (una campaña a un grupo). Marca `actualizado` para que Apple lo recoja.
 *
 * Es lo que hace posible avisar a un grupo y no a toda la tienda: Apple no tiene
 * mensajes propios, el aviso lo dispara un campo del pase que cambia.
 *
 * @param {string[]} seriales @param {string|null} texto null lo quita
 * @returns {Promise<number>} cuántos se escribieron
 */
export async function guardarMensajes(seriales, texto) {
  if (!seriales.length) return 0;
  const patch = { mensaje: texto || null, actualizado: ahoraISO() };
  // Un mensaje de la tienda es una promo: a quien dijo que no, nunca. Quien
  // llama ya los ha quitado (para contar bien a quién llega); esto es la red.
  if (hasSupabase()) {
    let n = 0;
    for (const lote of enLotes(seriales)) {
      let q = supa().from("clientes").update(patch).in("serial", lote);
      if (texto) q = q.is("promos_no", null).is("borrado_en", null);
      const filas = sinError(await q.select("serial"), "guardar mensajes");
      n += filas?.length ?? 0;
    }
    return n;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const nuevos = { ...all };
    let n = 0;
    for (const serial of seriales) {
      if (!nuevos[serial]) continue;
      if (texto && (nuevos[serial].promos_no || nuevos[serial].borrado_en)) continue;
      nuevos[serial] = { ...nuevos[serial], ...patch };
      n += 1;
    }
    await escribir("clientes", nuevos);
    return n;
  });
}

/** Nota interna sobre un cliente ("sin lactosa", "el del perro"). NO sale en el pase. */
export async function guardarNota(serial, nota) {
  const patch = { nota: cifrarCampo(serial, "nota", nota) };
  if (hasSupabase()) {
    const filas = sinError(
      await supa().from("clientes").update(patch).eq("serial", serial).select("serial"),
      "guardar nota",
    );
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    if (!all[serial]) return false;
    await escribir("clientes", { ...all, [serial]: { ...all[serial], ...patch } });
    return true;
  });
}

/**
 * ¿Recibe promos? Es la casilla del soft opt-in (LSSI 21.2): de partida sí, y
 * decir que no lo puede el cliente (su página) o la tienda (la ficha). Dejarlas
 * quita también el mensaje que tenga puesto: era una promo. Marca `actualizado`
 * para que el pase se ponga al día (en silencio: un campo que desaparece no suena).
 * @returns {Promise<boolean>} true si existía
 */
export async function guardarPromos(serial, quiere) {
  const ts = ahoraISO();
  const patch = quiere ? { promos_no: null, actualizado: ts } : { promos_no: ts, mensaje: null, actualizado: ts };
  if (hasSupabase()) {
    const filas = sinError(
      await supa().from("clientes").update(patch).eq("serial", serial).is("borrado_en", null).select("serial"),
      "guardar promos",
    );
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    if (!all[serial] || all[serial].borrado_en) return false;
    await escribir("clientes", { ...all, [serial]: { ...all[serial], ...patch } });
    return true;
  });
}

// ------------------------------------------------- borrar a un cliente
// En DOS tiempos (docs/RGPD.md, 3.3). Apple baja el pase nuevo DESPUÉS del aviso:
// si la fila ya no estuviera, la tarjeta se quedaría congelada en el teléfono
// con pinta de válida. Así que primero se vacía y se anula (el pase sale
// `voided`), y la fila cae al día siguiente, en la pasada diaria.

/**
 * Primer tiempo: sin nombre, nota ni mensaje, saldo a cero y `borrado_en`. Ya
 * no es un cliente para nadie (listClientes, la caja, el tap, /p).
 * @returns {Promise<boolean>} true si se borró ahora (false: no existe o ya lo estaba)
 */
export async function marcarBorrado(serial) {
  const ts = ahoraISO();
  const patch = { borrado_en: ts, actualizado: ts, nombre: null, nota: null, mensaje: null };
  for (const k of SALDO) patch[k] = 0;
  if (hasSupabase()) {
    const filas = sinError(
      await supa().from("clientes").update(patch).eq("serial", serial).is("borrado_en", null).select("serial"),
      "borrar cliente",
    );
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    if (!all[serial] || all[serial].borrado_en) return false;
    await escribir("clientes", { ...all, [serial]: { ...all[serial], ...patch } });
    return true;
  });
}

/** Clientes marcados como borrados antes de `antesDe` (ISO): los que ya pueden caer. */
export async function borradosPendientes(antesDe) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("clientes").select("serial, negocio").not("borrado_en", "is", null).lt("borrado_en", antesDe),
      "leer borrados pendientes",
    ) || [];
  }
  const all = await enFila(() => leer("clientes", {}));
  return Object.values(all).filter((c) => c.borrado_en && c.borrado_en < antesDe).map(({ serial, negocio }) => ({ serial, negocio }));
}

/**
 * Segundo tiempo: la fila de verdad. Con ella caen las tarjetas que se fusionaron
 * en esta (su historial ya vive aquí), sus eventos, sus registros (en cascada),
 * los teléfonos que se queden sin ningún pase y lo que recordaba qué iPhone
 * tuvo esta tarjeta. Los seriales que queden en `campanas` ya no apuntan a nadie.
 * @returns {Promise<number>} tarjetas borradas (la suya y sus fusionadas)
 */
export async function purgarCliente(serial) {
  if (hasSupabase()) {
    const db = supa();
    const fusionadas = sinError(await db.from("clientes").select("serial").eq("fusionado_en", serial), "leer fusionadas") || [];
    const seriales = [serial, ...fusionadas.map((f) => f.serial)];
    const dispositivos = [...new Set((sinError(await db.from("registros").select("dispositivo").in("serial", seriales), "leer registros del cliente") || []).map((r) => r.dispositivo))];
    sinError(await db.from("eventos").delete().in("serial", seriales), "borrar eventos del cliente");
    sinError(await db.from("tarjetas_de_dispositivo").delete().in("serial", seriales), "borrar tarjetas de dispositivo");
    const filas = sinError(await db.from("clientes").delete().in("serial", seriales).select("serial"), "borrar fila del cliente");
    await borrarDispositivosSinRegistros(dispositivos);
    return filas?.length ?? 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const seriales = new Set([serial, ...Object.values(all).filter((c) => c.fusionado_en === serial).map((c) => c.serial)]);
    const quedan = Object.fromEntries(Object.entries(all).filter(([k]) => !seriales.has(k)));
    await escribir("clientes", quedan);
    await escribir("eventos", (await leer("eventos", [])).filter((e) => !seriales.has(e.serial)));
    const registros = await leer("registros", []);
    const dispositivos = [...new Set(registros.filter((r) => seriales.has(r.serial)).map((r) => r.dispositivo))];
    await escribir("registros", registros.filter((r) => !seriales.has(r.serial)));
    const tarjetas = await leer("tarjetas_de_dispositivo", {});
    await escribir("tarjetas_de_dispositivo", Object.fromEntries(Object.entries(tarjetas).filter(([, t]) => !seriales.has(t.serial))));
    await quitarDispositivosSinRegistros(dispositivos);
    return Object.keys(all).length - Object.keys(quedan).length;
  });
}

/**
 * Clientes sin ninguna actividad desde `antesDe` (ISO): ni alta, ni visita, ni
 * instalación. El plazo de conservación (lib/limpieza.js) los borra.
 */
export async function clientesSinUso(antesDe) {
  const viejo = (f) => !f || Date.parse(f) < Date.parse(antesDe);
  if (hasSupabase()) {
    // Lo viejo por alta se filtra en SQL; visita e instalación, aquí (dos `or` no se combinan bien).
    const filas = sinError(
      await supa().from("clientes").select("serial, negocio, creado, ultima_visita, instalado")
        .is("borrado_en", null).is("fusionado_en", null).lt("creado", antesDe),
      "leer clientes sin uso",
    ) || [];
    return filas.filter((c) => viejo(c.ultima_visita) && viejo(c.instalado)).map(({ serial, negocio }) => ({ serial, negocio }));
  }
  const all = await enFila(() => leer("clientes", {}));
  return Object.values(all)
    .filter((c) => !c.borrado_en && !c.fusionado_en && viejo(c.creado) && viejo(c.ultima_visita) && viejo(c.instalado))
    .map(({ serial, negocio }) => ({ serial, negocio }));
}

/** Historial más viejo que `antesDe` (ISO): fuera. @returns {Promise<number|null>} */
export async function recortarEventos(antesDe) {
  if (hasSupabase()) {
    sinError(await supa().from("eventos").delete().lt("ts", antesDe), "recortar eventos");
    return null;
  }
  return enFila(async () => {
    const all = await leer("eventos", []);
    const quedan = all.filter((e) => !(e.ts < antesDe));
    await escribir("eventos", quedan);
    return all.length - quedan.length;
  });
}

/**
 * "Este iPhone tuvo esta tarjeta" sirve para devolverle los sellos si la vuelve
 * a añadir; no para siempre. Lo que no se ha visto desde `antesDe`, fuera.
 */
export async function recortarTarjetasDeDispositivo(antesDe) {
  if (hasSupabase()) {
    sinError(await supa().from("tarjetas_de_dispositivo").delete().lt("visto", antesDe), "recortar tarjetas de dispositivo");
    return;
  }
  return enFila(async () => {
    const all = await leer("tarjetas_de_dispositivo", {});
    await escribir("tarjetas_de_dispositivo", Object.fromEntries(Object.entries(all).filter(([, t]) => !(t.visto < antesDe))));
  });
}

/**
 * Por qué canales tiene la tarjeta (Apple, Google, navegador) y desde cuándo.
 * Nunca los tokens: es lo que va en "Descargar sus datos".
 * @returns {Promise<{canal:string, desde:string|null}[]>}
 */
export async function canalesDeTarjeta(serial) {
  const canal = (t) => (t === "web" ? "navegador" : t === "google" ? "Google Wallet" : "Apple Wallet");
  if (hasSupabase()) {
    const filas = sinError(await supa().from("registros").select("pass_type, creado").eq("serial", serial), "leer canales") || [];
    return filas.map((r) => ({ canal: canal(r.pass_type), desde: r.creado ?? null }));
  }
  const registros = await enFila(() => leer("registros", []));
  return registros.filter((r) => r.serial === serial).map((r) => ({ canal: canal(r.pass_type), desde: r.creado ?? null }));
}

// ------------------------------------------------- constancia y auditoría
// `borrados`: lo que queda de un borrado, sin nada personal (el certificado que
// pide el contrato). `auditoria`: quién hizo qué fuera de las tarjetas.

/** @param {{negocio:string, tipo:"cliente"|"tienda", motivo:string, rol?:string|null, cuantos?:number}} b */
export async function registrarBorrado({ negocio, tipo, motivo, rol = null, cuantos = 1 }) {
  const fila = { negocio, tipo, motivo, rol, cuantos };
  if (hasSupabase()) {
    sinError(await supa().from("borrados").insert(fila), "apuntar borrado");
    return;
  }
  return enFila(async () => {
    const all = await leer("borrados", []);
    await escribir("borrados", [...all, { ...fila, id: (all.at(-1)?.id ?? 0) + 1, ts: ahoraISO() }]);
  });
}

/** Borrados de una tienda (o de todas), los últimos primero. */
export async function listBorrados(negocio = null, { limite = 50 } = {}) {
  if (hasSupabase()) {
    let q = supa().from("borrados").select("negocio, tipo, motivo, rol, cuantos, ts");
    if (negocio) q = q.eq("negocio", negocio);
    return sinError(await q.order("ts", { ascending: false }).limit(limite), "listar borrados") || [];
  }
  const all = await enFila(() => leer("borrados", []));
  return all.filter((b) => !negocio || b.negocio === negocio).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limite);
}

/** @param {{negocio?:string|null, usuario?:string|null, rol?:string|null, accion:string, detalle?:string|null}} a */
export async function addAuditoria({ negocio = null, usuario = null, rol = null, accion, detalle = null }) {
  const fila = { negocio, usuario, rol, accion, detalle };
  if (hasSupabase()) {
    sinError(await supa().from("auditoria").insert(fila), "apuntar auditoría");
    return;
  }
  return enFila(async () => {
    const all = await leer("auditoria", []);
    await escribir("auditoria", [...all, { ...fila, id: (all.at(-1)?.id ?? 0) + 1, ts: ahoraISO() }]);
  });
}

/** Lo último que pasó en una tienda (o en todas), los más recientes primero. */
export async function listAuditoria(negocio = null, { limite = 100 } = {}) {
  if (hasSupabase()) {
    let q = supa().from("auditoria").select("ts, negocio, usuario, rol, accion, detalle");
    if (negocio) q = q.eq("negocio", negocio);
    return sinError(await q.order("ts", { ascending: false }).limit(limite), "listar auditoría") || [];
  }
  const all = await enFila(() => leer("auditoria", []));
  return all.filter((a) => !negocio || a.negocio === negocio).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limite);
}

// ------------------------------------------------- datos de antes del cifrado
// Los nombres y notas que se guardaron sin CIFRADO_CLAVE siguen en claro: se
// leen igual, pero hay que cifrarlos una vez (botón del admin en el panel de
// estado). Solo se reescribe la columna que está en claro.

const enClaro = (c, campo) => c[campo] != null && c[campo] !== "" && !estaCifrado(c[campo]);
const estaEnClaro = (c) => PERSONALES.some((campo) => enClaro(c, campo));
const pendienteDeCifrar = (c) =>
  Object.fromEntries(
    PERSONALES.filter((campo) => enClaro(c, campo)).map((campo) => [campo, cifrarCampo(c.serial, campo, c[campo])]),
  );

async function clientesConDatosPersonales() {
  if (hasSupabase()) {
    return sinError(
      await supa().from("clientes").select("serial, nombre, nota").or("nombre.not.is.null,nota.not.is.null"),
      "leer datos personales",
    ) || [];
  }
  return Object.values(await enFila(() => leer("clientes", {})));
}

/** Cuántos clientes tienen nombre o nota sin cifrar. */
export async function contarSinCifrar() {
  return (await clientesConDatosPersonales()).filter(estaEnClaro).length;
}

/** Cifra los nombres y notas que siguen en claro. @returns {Promise<number>} clientes cifrados */
export async function cifrarPendientes() {
  if (!estadoClaveCifrado().ok) throw new Error("Falta una CIFRADO_CLAVE válida: sin ella no hay con qué cifrar");
  const pendientes = (await clientesConDatosPersonales()).filter(estaEnClaro);
  if (hasSupabase()) {
    let n = 0;
    for (const c of pendientes) {
      const patch = pendienteDeCifrar(c);
      // Solo si sigue el valor que se leyó: si la caja lo cambió mientras tanto,
      // el suyo ya se guardó cifrado y este (el viejo) no lo pisa.
      let q = supa().from("clientes").update(patch).eq("serial", c.serial);
      for (const campo of Object.keys(patch)) q = q.eq(campo, c[campo]);
      n += (sinError(await q.select("serial"), "cifrar datos")?.length ?? 0) > 0 ? 1 : 0;
    }
    return n;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const nuevos = { ...all };
    for (const c of pendientes) nuevos[c.serial] = { ...all[c.serial], ...pendienteDeCifrar(all[c.serial]) };
    await escribir("clientes", nuevos);
    return pendientes.length;
  });
}

// -------------------------------------------------------------- campañas
// Cada envío a un grupo se guarda con a quién fue. Sin eso no se puede
// responder a la única pregunta que importa: ¿volvió alguno?

/** @param {{negocio:string, grupo:string, texto:string, seriales:string[], avisados?:number}} campana */
export async function crearCampana({ negocio, grupo, texto, seriales, avisados = 0 }) {
  const fila = {
    negocio, grupo, texto, seriales,
    destinatarios: seriales.length, avisados, creado: ahoraISO(),
  };
  if (hasSupabase()) {
    const filas = sinError(await supa().from("campanas").insert(fila).select("id, creado"), "crear campaña");
    return { ...fila, id: filas?.[0]?.id ?? null, creado: filas?.[0]?.creado ?? fila.creado };
  }
  return enFila(async () => {
    const all = await leer("campanas", []);
    const id = (all.at(-1)?.id ?? 0) + 1;
    await escribir("campanas", [...all, { ...fila, id }]);
    return { ...fila, id };
  });
}

/**
 * Campañas de una tienda, la más reciente primero. `desde` (ISO) acota por
 * fecha: los avisos automáticos miran un año atrás para no repetirse.
 */
export async function listCampanas(negocio, { limite = 20, desde = null } = {}) {
  if (hasSupabase()) {
    let q = supa().from("campanas").select("id, grupo, texto, destinatarios, avisados, seriales, creado")
      .eq("negocio", negocio);
    if (desde) q = q.gt("creado", desde);
    const data = sinError(await q.order("creado", { ascending: false }).limit(limite), "listar campañas");
    return data || [];
  }
  const all = await enFila(() => leer("campanas", []));
  return all
    .filter((c) => c.negocio === negocio && (!desde || (c.creado || "") > desde))
    .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""))
    .slice(0, limite);
}

/** Seriales de la tienda que tienen la tarjeta en algún teléfono, por cualquier canal (= avisables). */
export async function serialesRegistrados(negocio) {
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("registros").select("serial").eq("negocio", negocio),
      "leer registros del negocio",
    );
    return new Set((data || []).map((r) => r.serial));
  }
  const registros = await enFila(() => leer("registros", []));
  return new Set(registros.filter((r) => r.negocio === negocio).map((r) => r.serial));
}

// ================= DISPOSITIVOS Y REGISTROS (a quién avisar) =================
// Quién tiene cada tarjeta y cómo llegarle. Tres canales comparten las tablas y
// se distinguen por `pass_type`:
//   <Pass Type ID de Apple>  un iPhone (deviceLibraryIdentifier + push token APNs)
//   "web"                    un navegador Android con los avisos activados
//                            (id = hash del endpoint, token = la suscripción en JSON)
//   "google"                 el pase guardado en Google Wallet (token = id del objeto)
// Así "tiene la tarjeta en el teléfono" es una sola pregunta para el CRM, sin
// tablas nuevas que migrar.

/**
 * @returns {Promise<boolean>} true si el registro es nuevo, false si ya existía.
 */
export async function registrarPase({ dispositivo, pushToken, passType, serial, negocio }) {
  if (hasSupabase()) {
    const db = supa();
    sinError(
      await db.from("dispositivos").upsert({ id: dispositivo, push_token: pushToken }),
      "guardar dispositivo",
    );
    // ON CONFLICT DO NOTHING: si el iPhone repite el registro a la vez, no hay error
    // de clave duplicada; solo devuelve fila cuando el registro es nuevo.
    const nuevas = sinError(
      await db.from("registros")
        .upsert({ dispositivo, pass_type: passType, serial, negocio }, { onConflict: "dispositivo,pass_type,serial", ignoreDuplicates: true })
        .select("serial"),
      "crear registro",
    );
    return (nuevas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const dispositivos = await leer("dispositivos", {});
    await escribir("dispositivos", { ...dispositivos, [dispositivo]: { push_token: pushToken } });
    const registros = await leer("registros", []);
    const existe = registros.some(
      (r) => r.dispositivo === dispositivo && r.pass_type === passType && r.serial === serial,
    );
    if (existe) return false;
    await escribir("registros", [...registros, { dispositivo, pass_type: passType, serial, negocio }]);
    return true;
  });
}

/**
 * Quita un registro. Si el dispositivo se queda sin pases, se borra también.
 *
 * @returns {Promise<{ultimo:boolean}>} `ultimo`: ese pase ya no está en ningún
 *   iPhone. Es el momento en que un cliente borra la tarjeta, y el CRM quiere
 *   saberlo: es la señal de abandono más clara que existe.
 */
export async function borrarRegistro({ dispositivo, passType, serial }) {
  if (hasSupabase()) {
    const db = supa();
    sinError(
      await db.from("registros").delete().eq("dispositivo", dispositivo)
        .eq("pass_type", passType).eq("serial", serial),
      "borrar registro",
    );
    const quedan = sinError(
      await db.from("registros").select("serial", { count: "exact", head: true }).eq("dispositivo", dispositivo),
      "contar registros",
    );
    if (!quedan) sinError(await db.from("dispositivos").delete().eq("id", dispositivo), "borrar dispositivo");
    const delPase = sinError(
      await db.from("registros").select("serial", { count: "exact", head: true }).eq("serial", serial),
      "contar registros del pase",
    );
    return { ultimo: !delPase };
  }
  return enFila(async () => {
    const registros = (await leer("registros", [])).filter(
      (r) => !(r.dispositivo === dispositivo && r.pass_type === passType && r.serial === serial),
    );
    await escribir("registros", registros);
    if (!registros.some((r) => r.dispositivo === dispositivo)) {
      const { [dispositivo]: _borrado, ...resto } = await leer("dispositivos", {});
      await escribir("dispositivos", resto);
    }
    return { ultimo: !registros.some((r) => r.serial === serial) };
  });
}

/**
 * Los Pass Type ID con que esta tarjeta está metida en algún iPhone (sin los
 * canales "web" y "google"). Lo pregunta la descarga del .pkpass: si se firma
 * con otro, el iPhone lo toma por un pase distinto y el cliente acaba con dos.
 * @returns {Promise<string[]>}
 */
export async function tiposDePaseInstalados(serial) {
  const deApple = (t) => t && t !== "web" && t !== "google";
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("registros").select("pass_type").eq("serial", serial),
      "leer pases instalados",
    );
    return [...new Set((data || []).map((r) => r.pass_type).filter(deApple))];
  }
  const registros = await enFila(() => leer("registros", []));
  return [...new Set(registros.filter((r) => r.serial === serial).map((r) => r.pass_type).filter(deApple))];
}

/**
 * En qué dispositivos está registrada esta tarjeta ahora mismo, de cualquier
 * canal (iPhone, navegador de Android, Google). Lo pregunta la fusión de
 * lib/unaTarjeta.js: una tarjeta viva en otro teléfono no se fusiona.
 * @returns {Promise<string[]>}
 */
export async function dispositivosDeTarjeta(serial) {
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("registros").select("dispositivo").eq("serial", serial),
      "leer dispositivos de la tarjeta",
    );
    return [...new Set((data || []).map((r) => r.dispositivo))];
  }
  const registros = await enFila(() => leer("registros", []));
  return [...new Set(registros.filter((r) => r.serial === serial).map((r) => r.dispositivo))];
}

/**
 * Pases registrados en un dispositivo, con su fecha de actualización.
 * @returns {Promise<{serial:string, actualizado:string}[]>}
 */
export async function pasesDeDispositivo({ dispositivo, passType }) {
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("registros").select("serial, clientes(actualizado)")
        .eq("dispositivo", dispositivo).eq("pass_type", passType),
      "leer pases del dispositivo",
    );
    return (data || [])
      .filter((r) => r.clientes)
      .map((r) => ({ serial: r.serial, actualizado: r.clientes.actualizado }));
  }
  const [registros, clientes] = await enFila(() => Promise.all([leer("registros", []), leer("clientes", {})]));
  return registros
    .filter((r) => r.dispositivo === dispositivo && r.pass_type === passType && clientes[r.serial])
    .map((r) => ({ serial: r.serial, actualizado: clientes[r.serial].actualizado }));
}

/**
 * A quién avisar: cada registro con el token de su dispositivo. Filtra por
 * seriales concretos, por negocio y por tipo de pase.
 *
 * `passType` separa los canales que comparten estas tablas: el Pass Type ID de
 * Apple (iPhone), "web" (avisos del navegador en Android) y "google" (Google
 * Wallet). Sin él salen todos, que es lo que quiere el CRM ("¿a quién le llega
 * algo?") y nunca lo que quiere un envío.
 *
 * @param {{seriales?: string[], negocio?: string, passType?: string}} filtro
 * @returns {Promise<{serial:string, dispositivo:string, token:string}[]>}
 */
export async function destinosDeAviso({ seriales, negocio, passType }) {
  if (hasSupabase()) {
    const consulta = async (lote) => {
      let q = supa().from("registros").select("serial, dispositivo, dispositivos(push_token)");
      if (lote) q = q.in("serial", lote);
      if (negocio) q = q.eq("negocio", negocio);
      if (passType) q = q.eq("pass_type", passType);
      return sinError(await q, "leer push tokens") || [];
    };
    const filas = [];
    if (seriales) for (const lote of enLotes(seriales)) filas.push(...await consulta(lote));
    else filas.push(...await consulta(null));
    return filas
      .map((r) => ({ serial: r.serial, dispositivo: r.dispositivo, token: r.dispositivos?.push_token }))
      .filter((d) => d.token);
  }
  const [registros, dispositivos] = await enFila(() => Promise.all([leer("registros", []), leer("dispositivos", {})]));
  return registros
    .filter((r) => (!seriales || seriales.includes(r.serial)) && (!negocio || r.negocio === negocio))
    .filter((r) => !passType || r.pass_type === passType)
    .map((r) => ({ serial: r.serial, dispositivo: r.dispositivo, token: dispositivos[r.dispositivo]?.push_token }))
    .filter((d) => d.token);
}

/**
 * Push tokens (únicos) a avisar. Filtra por seriales concretos, negocio y tipo.
 * @param {{seriales?: string[], negocio?: string, passType?: string}} filtro
 * @returns {Promise<string[]>}
 */
export async function pushTokens(filtro) {
  return [...new Set((await destinosDeAviso(filtro)).map((d) => d.token))];
}

/** Borra dispositivos cuyo token Apple ya no acepta (410 / BadDeviceToken). */
export async function borrarDispositivosPorToken(tokens) {
  if (!tokens.length) return;
  if (hasSupabase()) {
    // registros se borra en cascada (FK on delete cascade).
    sinError(await supa().from("dispositivos").delete().in("push_token", tokens), "borrar dispositivos");
    return;
  }
  return enFila(async () => {
    const dispositivos = await leer("dispositivos", {});
    const muertos = Object.keys(dispositivos).filter((id) => tokens.includes(dispositivos[id].push_token));
    await escribir("dispositivos", Object.fromEntries(
      Object.entries(dispositivos).filter(([id]) => !muertos.includes(id)),
    ));
    const registros = await leer("registros", []);
    await escribir("registros", registros.filter((r) => !muertos.includes(r.dispositivo)));
  });
}

/**
 * Borra dispositivos por su id (y sus registros, en cascada). Es lo que usan los
 * avisos del navegador: su token es la suscripción en JSON, con comillas, y un
 * `in (...)` por token no sobrevive a eso. El id (`web-<hex>`) sí.
 */
export async function borrarDispositivos(ids) {
  if (!ids.length) return;
  if (hasSupabase()) {
    for (const lote of enLotes(ids)) {
      sinError(await supa().from("dispositivos").delete().in("id", lote), "borrar dispositivos por id");
    }
    return;
  }
  return enFila(async () => {
    const fuera = new Set(ids);
    const dispositivos = await leer("dispositivos", {});
    await escribir("dispositivos", Object.fromEntries(Object.entries(dispositivos).filter(([id]) => !fuera.has(id))));
    const registros = await leer("registros", []);
    await escribir("registros", registros.filter((r) => !fuera.has(r.dispositivo)));
  });
}

// ============================ ACCESOS (ver claves.js) ============================
// Contraseña de cada usuario de tienda (`nube` = manager, `nube-caja` = caja),
// como hash. Sin fila, el login cae a la variable de entorno de siempre.

/** @returns {Promise<{usuario:string, negocio:string, rol:string, hash:string, actualizado:string}|null>} */
export async function getAcceso(usuario) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("accesos").select("usuario, negocio, rol, hash, actualizado").eq("usuario", usuario).maybeSingle(),
      "leer acceso",
    ) ?? null;
  }
  return (await enFila(() => leer("accesos", {})))[usuario] ?? null;
}

/** Cuándo se puso la contraseña de cada usuario de una tienda (sin hashes). */
export async function accesosDeNegocio(negocio) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("accesos").select("usuario, rol, actualizado").eq("negocio", negocio),
      "leer accesos",
    ) || [];
  }
  const todos = await enFila(() => leer("accesos", {}));
  return Object.values(todos).filter((a) => a.negocio === negocio).map(({ usuario, rol, actualizado }) => ({ usuario, rol, actualizado }));
}

export async function guardarAcceso({ usuario, negocio, rol, hash }) {
  const fila = { usuario, negocio, rol, hash, actualizado: ahoraISO() };
  if (hasSupabase()) {
    sinError(await supa().from("accesos").upsert(fila, { onConflict: "usuario" }), "guardar acceso");
    return;
  }
  return enFila(async () => {
    const todos = await leer("accesos", {});
    await escribir("accesos", { ...todos, [usuario]: fila });
  });
}

// ============================ INVITACIONES (ver invitaciones.js) ============================
// Un enlace por tienda para que su dueño elija sus contraseñas. Se guarda la
// huella del token, no el token: quien lea la tabla no puede usar el enlace.

/** Guarda la invitación nueva y anula las anteriores sin usar de esa tienda: solo vale el último enlace. */
export async function crearInvitacion({ huella, negocio, caduca }) {
  const fila = { huella, negocio, caduca, creado: ahoraISO(), usada: null };
  if (hasSupabase()) {
    const db = supa();
    sinError(await db.from("invitaciones").delete().eq("negocio", negocio).is("usada", null), "anular invitaciones");
    sinError(await db.from("invitaciones").insert(fila), "crear invitación");
    return;
  }
  return enFila(async () => {
    const todas = await leer("invitaciones", {});
    const quedan = Object.fromEntries(Object.entries(todas).filter(([, i]) => i.negocio !== negocio || i.usada));
    await escribir("invitaciones", { ...quedan, [huella]: fila });
  });
}

/** @returns {Promise<{huella:string, negocio:string, caduca:string, creado:string, usada:string|null}|null>} */
export async function getInvitacion(huella) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("invitaciones").select("huella, negocio, caduca, creado, usada").eq("huella", huella).maybeSingle(),
      "leer invitación",
    ) ?? null;
  }
  return (await enFila(() => leer("invitaciones", {})))[huella] ?? null;
}

/**
 * Gasta la invitación. Condicional (solo si seguía sin usar): con dos pestañas
 * a la vez, solo una fija las contraseñas.
 * @returns {Promise<boolean>} true si era la primera vez
 */
export async function gastarInvitacion(huella) {
  const ts = ahoraISO();
  if (hasSupabase()) {
    const filas = sinError(
      await supa().from("invitaciones").update({ usada: ts }).eq("huella", huella).is("usada", null).select("huella"),
      "gastar invitación",
    );
    return Boolean(filas?.length);
  }
  return enFila(async () => {
    const todas = await leer("invitaciones", {});
    if (!todas[huella] || todas[huella].usada) return false;
    await escribir("invitaciones", { ...todas, [huella]: { ...todas[huella], usada: ts } });
    return true;
  });
}

// ============================ TUTORIALES VISTOS ============================
// Qué recorridos de bienvenida ha visto cada usuario (`nube`, `nube-caja`,
// `admin`). En la base y no en el navegador: la caja cambia de móvil y el
// dueño entra desde el ordenador y desde el teléfono.

/** @returns {Promise<string[]>} claves de los recorridos que ya vio */
export async function tutorialesVistos(usuario) {
  if (hasSupabase()) {
    const filas = sinError(await supa().from("tutoriales").select("recorrido").eq("usuario", usuario), "leer tutoriales");
    return (filas || []).map((f) => f.recorrido);
  }
  const todos = await enFila(() => leer("tutoriales", {}));
  return Object.values(todos).filter((t) => t.usuario === usuario).map((t) => t.recorrido);
}

export async function marcarTutorial({ usuario, negocio, recorrido }) {
  const fila = { usuario, negocio, recorrido, visto: ahoraISO() };
  if (hasSupabase()) {
    sinError(await supa().from("tutoriales").upsert(fila, { onConflict: "usuario,recorrido" }), "marcar tutorial");
    return;
  }
  return enFila(async () => {
    const todos = await leer("tutoriales", {});
    await escribir("tutoriales", { ...todos, [`${usuario}|${recorrido}`]: fila });
  });
}

// ================= UNA TARJETA POR TELÉFONO (ver unaTarjeta.js) =================
// Qué tarjeta tiene (o TUVO) cada iPhone en cada tienda. A diferencia de
// `registros`, no se borra cuando el cliente quita el pase: es justo lo que
// hace falta recordar para devolverle sus sellos cuando lo vuelva a añadir.

/** Serial de la tarjeta de este iPhone en esta tienda, o null. */
export async function tarjetaDeDispositivo({ dispositivo, negocio }) {
  if (hasSupabase()) {
    const fila = sinError(
      await supa().from("tarjetas_de_dispositivo").select("serial")
        .eq("dispositivo", dispositivo).eq("negocio", negocio).maybeSingle(),
      "leer tarjeta del dispositivo",
    );
    return fila?.serial ?? null;
  }
  const tarjetas = await enFila(() => leer("tarjetas_de_dispositivo", {}));
  return tarjetas[`${dispositivo}|${negocio}`]?.serial ?? null;
}

export async function apuntarTarjetaDeDispositivo({ dispositivo, negocio, serial }) {
  const fila = { dispositivo, negocio, serial, visto: ahoraISO() };
  if (hasSupabase()) {
    sinError(
      await supa().from("tarjetas_de_dispositivo").upsert(fila, { onConflict: "dispositivo,negocio" }),
      "apuntar tarjeta del dispositivo",
    );
    return;
  }
  return enFila(async () => {
    const tarjetas = await leer("tarjetas_de_dispositivo", {});
    await escribir("tarjetas_de_dispositivo", { ...tarjetas, [`${dispositivo}|${negocio}`]: fila });
  });
}

/**
 * Pasa la tarjeta `viejo` a `nuevo`: `nuevo` se queda con `campos` (ver
 * `fusionar()`) y el historial; `viejo` queda anulada, a cero y apuntando a
 * `nuevo`. Los códigos cortos se intercambian: la nueva conserva el que la
 * caja ya conocía y ninguno se repite dentro de la tienda.
 *
 * Primero se RECLAMA la vieja con un guardado condicional (sigue sin fusionar y
 * con el mismo saldo): si dos registros llegan a la vez, o una caja le pone un
 * sello justo ahora, solo uno gana y no se pierde ni se duplica nada.
 *
 * @returns {Promise<boolean>} true si se fusionó
 */
export async function fusionarClientes(viejo, nuevo, campos) {
  const ts = ahoraISO();
  // Los datos personales se van con la tarjeta nueva: en la anulada no queda nada.
  const anulada = { fusionado_en: nuevo.serial, codigo: nuevo.codigo, actualizado: ts, mensaje: null, nombre: null, nota: null };
  for (const k of SALDO) anulada[k] = 0;
  const patch = { actualizado: ts };
  for (const k of [...SALDO, "codigo", "visitas", "ultima_visita", "instalado", "origen", "creado"]) {
    if (k in campos) patch[k] = campos[k];
  }
  for (const k of PERSONALES) patch[k] = cifrarCampo(nuevo.serial, k, campos[k] ?? null);

  if (hasSupabase()) {
    const db = supa();
    let q = db.from("clientes").update(anulada).eq("serial", viejo.serial).is("fusionado_en", null);
    for (const k of SALDO) q = q.eq(k, viejo[k] || 0);
    const reclamada = sinError(await q.select("serial"), "anular tarjeta fusionada");
    if (!reclamada?.length) return false;
    try {
      sinError(await db.from("clientes").update(patch).eq("serial", nuevo.serial), "fusionar tarjeta");
    } catch (e) {
      // La vieja ya está a cero: sin esto sus sellos se perderían. Se deja como estaba.
      const deshacer = { fusionado_en: null, codigo: viejo.codigo, actualizado: ts, mensaje: viejo.mensaje ?? null };
      for (const k of SALDO) deshacer[k] = viejo[k] || 0;
      for (const k of PERSONALES) deshacer[k] = cifrarCampo(viejo.serial, k, viejo[k] ?? null);
      await db.from("clientes").update(deshacer).eq("serial", viejo.serial);
      throw e;
    }
    sinError(await db.from("eventos").update({ serial: nuevo.serial }).eq("serial", viejo.serial), "mover historial");
    return true;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const v = all[viejo.serial];
    if (!v || v.fusionado_en || !all[nuevo.serial] || SALDO.some((k) => (v[k] || 0) !== (viejo[k] || 0))) return false;
    await escribir("clientes", {
      ...all,
      [viejo.serial]: { ...v, ...anulada },
      [nuevo.serial]: { ...all[nuevo.serial], ...patch },
    });
    const eventos = await leer("eventos", []);
    await escribir("eventos", eventos.map((e) => (e.serial === viejo.serial ? { ...e, serial: nuevo.serial } : e)));
    return true;
  });
}

// ============================ INTENTOS (límites de uso) ============================
// Contadores con ventana temporal para frenar abusos (lib/limitador.js):
// PINs fallidos ("login:nube:<huella>"), emisiones de pases ("tap:<huella>")...
// La huella sale de la IP, pero no es la IP (ver limitador.js).
//
// Nada cuenta más de un día atrás: lo de antes se borra al apuntar uno nuevo.
// Así la tabla no crece sin fin y no se guarda rastro de nadie más de lo necesario.
const RETENCION_INTENTOS_MS = 24 * 60 * 60 * 1000;

export async function registrarIntento(clave) {
  const limite = Date.now() - RETENCION_INTENTOS_MS;
  if (hasSupabase()) {
    const db = supa();
    sinError(await db.from("intentos").delete().lt("ts", new Date(limite).toISOString()), "limpiar intentos");
    sinError(await db.from("intentos").insert({ clave }), "registrar intento");
    return;
  }
  return enFila(async () => {
    const all = await leer("intentos", []);
    await escribir("intentos", [...all.filter((i) => Date.parse(i.ts) > limite), { clave, ts: ahoraISO() }]);
  });
}

/**
 * Cuándo se apuntó por última vez `clave` (ISO), o null. El reloj de los avisos
 * automáticos deja aquí su latido: así la pantalla sabe si está en marcha.
 */
export async function ultimoIntento(clave) {
  if (hasSupabase()) {
    const fila = sinError(
      await supa().from("intentos").select("ts").eq("clave", clave).order("ts", { ascending: false }).limit(1).maybeSingle(),
      "leer último intento",
    );
    return fila?.ts ?? null;
  }
  const all = await enFila(() => leer("intentos", []));
  return all.filter((i) => i.clave === clave).map((i) => i.ts).sort().at(-1) ?? null;
}

/** Intentos de cualquier clave que empiece por `prefijo` ("login:"): las alertas. */
export async function contarIntentosPorPrefijo(prefijo, desdeMs) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("intentos").select("clave", { count: "exact", head: true })
        .like("clave", `${prefijo}%`).gt("ts", new Date(desdeMs).toISOString()),
      "contar intentos por prefijo",
    ) || 0;
  }
  const all = await enFila(() => leer("intentos", []));
  return all.filter((i) => i.clave.startsWith(prefijo) && Date.parse(i.ts) > desdeMs).length;
}

export async function contarIntentos(clave, desdeMs) {
  if (hasSupabase()) {
    return sinError(
      await supa().from("intentos").select("clave", { count: "exact", head: true })
        .eq("clave", clave).gt("ts", new Date(desdeMs).toISOString()),
      "contar intentos",
    ) || 0;
  }
  const all = await enFila(() => leer("intentos", []));
  return all.filter((i) => i.clave === clave && Date.parse(i.ts) > desdeMs).length;
}
