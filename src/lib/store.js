import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { NEGOCIOS, configDefault, esNegocio } from "./negocios";

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
// Une el preset (nombre, tipo, tema) con la config editable guardada.
function componer(slug, config) {
  const preset = NEGOCIOS[slug];
  const c = { ...configDefault(slug), ...(config || {}) };
  return {
    slug,
    nombre: preset.nombre,
    tipo: preset.tipo,
    tema: preset.tema,
    meta: c.meta,
    premio: c.premio,
    acciones: c.acciones,
    promo: c.promo ?? null,
    ubicaciones: Array.isArray(c.ubicaciones) ? c.ubicaciones : [],
  };
}

export async function getNegocio(slug) {
  if (!esNegocio(slug)) return null;
  if (hasSupabase()) {
    const data = sinError(
      await supa().from("negocios").select("config").eq("slug", slug).maybeSingle(),
      "leer negocio",
    );
    return componer(slug, data?.config);
  }
  return enFila(async () => componer(slug, (await leer("negocios", {}))[slug]));
}

export async function listNegocios() {
  return Promise.all(Object.keys(NEGOCIOS).map((slug) => getNegocio(slug)));
}

const fusionarConfig = (actual, patch) => ({
  meta: patch.meta ?? actual.meta,
  premio: patch.premio ?? actual.premio,
  acciones: patch.acciones ?? actual.acciones,
  promo: patch.promo !== undefined ? patch.promo : actual.promo,
  ubicaciones: patch.ubicaciones ?? actual.ubicaciones,
});

export async function saveNegocio(slug, patch) {
  if (!esNegocio(slug)) return null;
  if (hasSupabase()) {
    const config = fusionarConfig(await getNegocio(slug), patch);
    const { nombre, tipo } = NEGOCIOS[slug];
    sinError(await supa().from("negocios").upsert({ slug, nombre, tipo, config }), "guardar negocio");
    return componer(slug, config);
  }
  return enFila(async () => {
    const all = await leer("negocios", {});
    const config = fusionarConfig(componer(slug, all[slug]), patch);
    await escribir("negocios", { ...all, [slug]: config });
    return componer(slug, config);
  });
}

// ============================ CLIENTES ============================
const CAMPOS_CLIENTE = "serial, negocio, ww_serial, sellos, premios, nombre, auth_token, actualizado, creado";

function normalizarCliente(c) {
  return c
    ? {
        serial: c.serial,
        negocio: c.negocio,
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
    serial: c.serial, negocio: c.negocio, sellos: c.sellos, premios: c.premios,
    nombre: c.nombre ?? null, creado: c.creado ?? null,
  };

/**
 * @param {{serial:string, negocio:string, authToken:string, wwSerial?:string|null}} datos
 */
export async function crearCliente({ serial, negocio, authToken, wwSerial = null }) {
  const ts = ahoraISO();
  const fila = {
    serial, negocio, ww_serial: wwSerial, auth_token: authToken,
    sellos: 0, premios: 0, nombre: null, actualizado: ts, creado: ts,
  };
  if (hasSupabase()) {
    sinError(await supa().from("clientes").insert(fila), "crear cliente");
    return normalizarCliente(fila);
  }
  return enFila(async () => {
    const all = await leer("clientes", {});
    await escribir("clientes", { ...all, [serial]: fila });
    return normalizarCliente(fila);
  });
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
