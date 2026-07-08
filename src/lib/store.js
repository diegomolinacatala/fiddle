import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { NEGOCIOS, configDefault } from "./negocios";

export const hasSupabase = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

function supa() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------- Backend demo: ficheros JSON en .data/ ----------
const DIR = path.join(process.cwd(), ".data");
const F = {
  negocios: path.join(DIR, "negocios.json"),
  clientes: path.join(DIR, "clientes.json"),
  eventos: path.join(DIR, "eventos.json"),
};
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Une el preset (nombre, tipo, tema) con la config editable guardada.
function componer(slug, config) {
  const preset = NEGOCIOS[slug];
  if (!preset) return null;
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
  };
}

// ============================ NEGOCIOS ============================
export async function getNegocio(slug) {
  if (!NEGOCIOS[slug]) return null;
  if (hasSupabase()) {
    const { data } = await supa().from("negocios").select("config").eq("slug", slug).single();
    return componer(slug, data?.config);
  }
  const all = await readJson(F.negocios, {});
  return componer(slug, all[slug]);
}

export async function listNegocios() {
  const out = [];
  for (const slug of Object.keys(NEGOCIOS)) out.push(await getNegocio(slug));
  return out;
}

export async function saveNegocio(slug, patch) {
  if (!NEGOCIOS[slug]) return null;
  const actual = await getNegocio(slug);
  const config = {
    meta: patch.meta ?? actual.meta,
    premio: patch.premio ?? actual.premio,
    acciones: patch.acciones ?? actual.acciones,
    promo: patch.promo !== undefined ? patch.promo : actual.promo,
  };
  if (hasSupabase()) {
    await supa().from("negocios").upsert({ slug, nombre: NEGOCIOS[slug].nombre, tipo: NEGOCIOS[slug].tipo, config });
    return componer(slug, config);
  }
  const all = await readJson(F.negocios, {});
  all[slug] = config;
  await writeJson(F.negocios, all);
  return componer(slug, config);
}

// ============================ CLIENTES ============================
export async function crearCliente(serial, negocio, wwSerial) {
  if (hasSupabase()) {
    const { error } = await supa().from("clientes").insert({ serial, negocio, ww_serial: wwSerial, sellos: 0, premios: 0 });
    if (error) throw new Error(`Supabase insert cliente: ${error.message}`);
    return;
  }
  const all = await readJson(F.clientes, {});
  all[serial] = { serial, negocio, ww_serial: wwSerial ?? null, sellos: 0, premios: 0, creado: new Date().toISOString() };
  await writeJson(F.clientes, all);
}

export async function getCliente(serial) {
  if (hasSupabase()) {
    const { data } = await supa().from("clientes").select("serial, negocio, ww_serial, sellos, premios").eq("serial", serial).single();
    return data || null;
  }
  const all = await readJson(F.clientes, {});
  const c = all[serial];
  return c ? { serial: c.serial, negocio: c.negocio, ww_serial: c.ww_serial ?? null, sellos: c.sellos, premios: c.premios || 0 } : null;
}

export async function saveCliente(cliente) {
  if (hasSupabase()) {
    const { error } = await supa().from("clientes").update({ sellos: cliente.sellos, premios: cliente.premios || 0 }).eq("serial", cliente.serial);
    if (error) throw new Error(`Supabase update cliente: ${error.message}`);
    return;
  }
  const all = await readJson(F.clientes, {});
  if (all[cliente.serial]) {
    all[cliente.serial] = { ...all[cliente.serial], sellos: cliente.sellos, premios: cliente.premios || 0 };
    await writeJson(F.clientes, all);
  }
}

export async function listClientes(negocio) {
  if (hasSupabase()) {
    let q = supa().from("clientes").select("serial, negocio, ww_serial, sellos, premios, creado").order("creado", { ascending: false });
    if (negocio) q = q.eq("negocio", negocio);
    const { data } = await q;
    return data || [];
  }
  const all = await readJson(F.clientes, {});
  let arr = Object.values(all);
  if (negocio) arr = arr.filter((c) => c.negocio === negocio);
  return arr.sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
}

// ============================ EVENTOS ============================
export async function addEvento(serial, tipo, mensaje) {
  if (hasSupabase()) {
    await supa().from("eventos").insert({ serial, tipo, mensaje });
    return;
  }
  const all = await readJson(F.eventos, []);
  all.push({ serial, tipo, mensaje, ts: new Date().toISOString() });
  await writeJson(F.eventos, all);
}

export async function listEventos(serial, limit = 8) {
  if (hasSupabase()) {
    const { data } = await supa().from("eventos").select("tipo, mensaje, ts").eq("serial", serial).order("ts", { ascending: false }).limit(limit);
    return data || [];
  }
  const all = await readJson(F.eventos, []);
  return all.filter((e) => e.serial === serial).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}
