import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PROGRAMA } from "./config";

// Hay Supabase real si están las dos variables. Si no, modo demo (ficheros locales).
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
  programa: path.join(DIR, "programa.json"),
  clientes: path.join(DIR, "clientes.json"),
  eventos: path.join(DIR, "eventos.json"),
};
async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function writeJson(file, data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// ============================ PROGRAMA (config manager) ============================
export async function getPrograma() {
  if (hasSupabase()) {
    const { data } = await supa().from("programa").select("*").eq("id", "default").single();
    if (!data) return { ...DEFAULT_PROGRAMA };
    return {
      titulo: data.titulo,
      color: data.color,
      meta: data.meta,
      premio: data.premio,
      acciones: data.acciones ?? DEFAULT_PROGRAMA.acciones,
      promo: data.promo ?? null,
    };
  }
  const p = await readJson(F.programa, null);
  return { ...DEFAULT_PROGRAMA, ...(p || {}) };
}

export async function savePrograma(patch) {
  const nuevo = { ...(await getPrograma()), ...patch };
  if (hasSupabase()) {
    await supa().from("programa").upsert({ id: "default", ...nuevo });
    return nuevo;
  }
  await writeJson(F.programa, nuevo);
  return nuevo;
}

// ============================ CLIENTES ============================
export async function crearCliente(serial) {
  if (hasSupabase()) {
    const { error } = await supa().from("clientes").insert({ serial, sellos: 0, premios: 0 });
    if (error) throw new Error(`Supabase insert cliente: ${error.message}`);
    return;
  }
  const all = await readJson(F.clientes, {});
  all[serial] = { serial, sellos: 0, premios: 0, creado: new Date().toISOString() };
  await writeJson(F.clientes, all);
}

export async function getCliente(serial) {
  if (hasSupabase()) {
    const { data } = await supa()
      .from("clientes").select("serial, sellos, premios").eq("serial", serial).single();
    return data || null;
  }
  const all = await readJson(F.clientes, {});
  const c = all[serial];
  return c ? { serial: c.serial, sellos: c.sellos, premios: c.premios || 0 } : null;
}

export async function saveCliente(cliente) {
  if (hasSupabase()) {
    const { error } = await supa()
      .from("clientes")
      .update({ sellos: cliente.sellos, premios: cliente.premios || 0 })
      .eq("serial", cliente.serial);
    if (error) throw new Error(`Supabase update cliente: ${error.message}`);
    return;
  }
  const all = await readJson(F.clientes, {});
  if (all[cliente.serial]) {
    all[cliente.serial] = {
      ...all[cliente.serial],
      sellos: cliente.sellos,
      premios: cliente.premios || 0,
    };
    await writeJson(F.clientes, all);
  }
}

export async function listClientes() {
  if (hasSupabase()) {
    const { data } = await supa()
      .from("clientes").select("serial, sellos, premios, creado")
      .order("creado", { ascending: false });
    return data || [];
  }
  const all = await readJson(F.clientes, {});
  return Object.values(all).sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
}

// ============================ EVENTOS (historial) ============================
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
    const { data } = await supa()
      .from("eventos").select("tipo, mensaje, ts").eq("serial", serial)
      .order("ts", { ascending: false }).limit(limit);
    return data || [];
  }
  const all = await readJson(F.eventos, []);
  return all
    .filter((e) => e.serial === serial)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit);
}
