import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { SEMILLAS, componerNegocio, configInicial, esSlug } from "./negocios";
import { codigoDesdeSerial, codigoLibre, normalizarCodigo } from "./codigo";

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
export const TABLAS = ["negocios", "clientes", "eventos", "dispositivos", "registros", "intentos"];

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
    notas: patch.notas ?? actual.notas,
    archivado: patch.archivado ?? actual.archivado,
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

/** Archiva (o desarchiva) un negocio: desaparece de todo, pero no se pierde nada. */
export const archivarNegocio = (slug, archivado = true) => saveNegocio(slug, { archivado });

/**
 * Borra un negocio PARA SIEMPRE, con sus clientes y su historial. No se puede
 * deshacer: los pases que ya estén en un teléfono dejan de actualizarse.
 * @returns {Promise<{borrados:number}>} clientes eliminados
 */
export async function borrarNegocio(slug) {
  const clientes = await listClientes(slug);
  const seriales = clientes.map((c) => c.serial);

  if (hasSupabase()) {
    const db = supa();
    // `registros` cae solo por la FK; los eventos van por serial, sin FK.
    if (seriales.length) sinError(await db.from("eventos").delete().in("serial", seriales), "borrar eventos");
    sinError(await db.from("clientes").delete().eq("negocio", slug), "borrar clientes");
    sinError(await db.from("negocios").delete().eq("slug", slug), "borrar negocio");
    return { borrados: seriales.length };
  }
  return enFila(async () => {
    const negocios = await leer("negocios", {});
    delete negocios[slug];
    await escribir("negocios", negocios);

    const todos = await leer("clientes", {});
    await escribir("clientes", Object.fromEntries(Object.entries(todos).filter(([, c]) => c.negocio !== slug)));
    await escribir("eventos", (await leer("eventos", [])).filter((e) => !seriales.includes(e.serial)));

    const registros = await leer("registros", []);
    await escribir("registros", registros.filter((r) => !seriales.includes(r.serial)));
    return { borrados: seriales.length };
  });
}

// ============================ CLIENTES ============================
const CAMPOS_CLIENTE = "serial, negocio, codigo, ww_serial, sellos, premios, nombre, auth_token, actualizado, creado";

function normalizarCliente(c) {
  return c
    ? {
        serial: c.serial,
        negocio: c.negocio,
        // Clientes creados antes del código corto: se deduce del serial (estable).
        codigo: c.codigo || codigoDesdeSerial(c.serial),
        ww_serial: c.ww_serial ?? null,
        sellos: c.sellos ?? 0,
        premios: c.premios ?? 0,
        nombre: c.nombre ?? null,
        auth_token: c.auth_token ?? null,
        actualizado: c.actualizado ?? c.creado ?? null,
        creado: c.creado ?? null,
      }
    : null;
}

/** Lo que puede salir hacia el navegador: sin auth_token ni ww_serial. */
export const clientePublico = (c) =>
  c && {
    serial: c.serial, negocio: c.negocio, codigo: c.codigo, sellos: c.sellos, premios: c.premios,
    nombre: c.nombre ?? null, creado: c.creado ?? null,
  };

/**
 * @param {{serial:string, negocio:string, authToken:string, wwSerial?:string|null}} datos
 */
export async function crearCliente({ serial, negocio, authToken, wwSerial = null }) {
  const ts = ahoraISO();
  const base = {
    serial, negocio, ww_serial: wwSerial, auth_token: authToken,
    sellos: 0, premios: 0, nombre: null, actualizado: ts, creado: ts,
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
 * @param {{serial:string, sellos:number, premios:number}} cliente
 * @param {{esperado?: {sellos:number, premios:number}}} [opciones]
 * @returns {Promise<boolean>} true si se guardó
 */
export async function saveCliente(cliente, { esperado } = {}) {
  const patch = { sellos: cliente.sellos, premios: cliente.premios || 0, actualizado: ahoraISO() };

  if (hasSupabase()) {
    let q = supa().from("clientes").update(patch).eq("serial", cliente.serial);
    if (esperado) q = q.eq("sellos", esperado.sellos).eq("premios", esperado.premios || 0);
    const filas = sinError(await q.select("serial"), "guardar cliente");
    return (filas?.length ?? 0) > 0;
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    const actual = all[cliente.serial];
    if (!actual) return false;
    if (esperado && (actual.sellos !== esperado.sellos || (actual.premios || 0) !== (esperado.premios || 0))) {
      return false;
    }
    await escribir("clientes", { ...all, [cliente.serial]: { ...actual, ...patch } });
    return true;
  });
}

/** Cambia SOLO el nombre (no pisa sellos que otra caja esté poniendo a la vez). */
export async function guardarNombre(serial, nombre) {
  const patch = { nombre: nombre ?? null, actualizado: ahoraISO() };
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
    let q = supa().from("clientes").select(CAMPOS_CLIENTE).order("creado", { ascending: false });
    if (negocio) q = q.eq("negocio", negocio);
    if (limite) q = q.limit(limite);
    return (sinError(await q, "listar clientes") || []).map(normalizarCliente);
  }
  const all = await enFila(() => leer("clientes", {}));
  const lista = Object.values(all)
    .filter((c) => !negocio || c.negocio === negocio)
    .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""))
    .map(normalizarCliente);
  return limite ? lista.slice(0, limite) : lista;
}

// ============================ EVENTOS ============================
export async function addEvento(serial, tipo, mensaje) {
  if (hasSupabase()) {
    sinError(await supa().from("eventos").insert({ serial, tipo, mensaje }), "guardar evento");
    return;
  }
  return enFila(async () => {
    const all = await leer("eventos", []);
    await escribir("eventos", [...all, { serial, tipo, mensaje, ts: ahoraISO() }]);
  });
}

export async function listEventos(serial, limit = 8) {
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("eventos").select("tipo, mensaje, ts").eq("serial", serial)
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

// ================= APPLE WALLET: dispositivos y registros =================
// Un iPhone (deviceLibraryIdentifier) se registra para recibir avisos de un pase.
// Guardamos su push token y qué pases tiene, para avisarle cuando cambien.

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

/** Quita un registro. Si el dispositivo se queda sin pases, se borra también. */
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
    return;
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
  });
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
 * Push tokens (únicos) a avisar. Filtra por seriales concretos o por negocio.
 * @param {{seriales?: string[], negocio?: string}} filtro
 * @returns {Promise<string[]>}
 */
export async function pushTokens({ seriales, negocio }) {
  if (hasSupabase()) {
    let q = supa().from("registros").select("dispositivos(push_token)");
    if (seriales) q = q.in("serial", seriales);
    if (negocio) q = q.eq("negocio", negocio);
    const data = sinError(await q, "leer push tokens");
    return [...new Set((data || []).map((r) => r.dispositivos?.push_token).filter(Boolean))];
  }
  const [registros, dispositivos] = await enFila(() => Promise.all([leer("registros", []), leer("dispositivos", {})]));
  const tokens = registros
    .filter((r) => (!seriales || seriales.includes(r.serial)) && (!negocio || r.negocio === negocio))
    .map((r) => dispositivos[r.dispositivo]?.push_token)
    .filter(Boolean);
  return [...new Set(tokens)];
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

// ============================ INTENTOS (límites de uso) ============================
// Contadores con ventana temporal para frenar abusos (lib/limitador.js):
// PINs fallidos ("login:nube:ip"), emisiones de pases ("tap:ip"), logs ("log:ip").

export async function registrarIntento(clave) {
  if (hasSupabase()) {
    sinError(await supa().from("intentos").insert({ clave }), "registrar intento");
    return;
  }
  return enFila(async () => {
    const all = await leer("intentos", []);
    const limite = Date.now() - 24 * 60 * 60 * 1000; // no crecer sin fin en demo
    await escribir("intentos", [...all.filter((i) => Date.parse(i.ts) > limite), { clave, ts: ahoraISO() }]);
  });
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
