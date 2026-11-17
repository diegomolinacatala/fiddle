// ============================================================================
// EL TABLERO DE /admin Y LAS TAREAS DEL VAULT, A LA PAR
// ----------------------------------------------------------------------------
//   npm run tareas -- <carpeta del vault>              enseña lo que cambiaría
//   npm run tareas -- <carpeta del vault> --aplicar    lo cambia
//
// Lee `Tareas/*.md` de una copia del vault (`gh repo clone Victrozz/fiddleobsidian`,
// recién traída con `git pull --rebase`) y el tablero de la base de `.env.local`
// (sin Supabase, los ficheros de `DATA_DIR`). La cuenta está en `src/lib/sincronia.js`.
// No hace commit en el vault: eso, después, con un mensaje que diga qué cambió.
// ============================================================================

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Las variables de .env.local, sin pisar las que ya vengan (SUPABASE_URL= vacía = ficheros).
const env = path.join(raiz, ".env.local");
if (existsSync(env)) {
  for (const linea of readFileSync(env, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const vault = args.find((a) => !a.startsWith("--"));
if (!vault) {
  console.error("Uso: npm run tareas -- <carpeta del vault> [--aplicar]");
  process.exit(1);
}
const carpeta = path.join(vault, "Tareas");
if (!existsSync(carpeta)) {
  console.error(`No está ${carpeta}: ¿es la carpeta del vault?`);
  process.exit(1);
}

const store = await import("../src/lib/store.js");
const { planDeSincronia, resumenDelPlan, escribirNota } = await import("../src/lib/sincronia.js");

// ------------------------------------------------------------ el vault
const git = (...a) => execFileSync("git", ["-C", vault, ...a], { encoding: "utf8" }).trim();
// quotepath=off: si no, git escribe «Diseñar» como "Dise\303\261ar" y no se reconoce.
const tocadas = new Set(git("-c", "core.quotepath=off", "status", "--porcelain", "--", "Tareas").split("\n").filter(Boolean)
  .map((l) => l.slice(3).split(" -> ").pop().replace(/^"|"$/g, "")));

const notas = readdirSync(carpeta).filter((f) => f.endsWith(".md")).map((f) => {
  const archivo = `Tareas/${f}`;
  const ruta = path.join(vault, archivo);
  // Cuándo se tocó: el último commit, o el fichero si aún no está en ninguno.
  const editado = tocadas.has(archivo)
    ? statSync(ruta).mtime.toISOString()
    : git("log", "-1", "--format=%cI", "--", archivo) || statSync(ruta).mtime.toISOString();
  return { archivo, texto: readFileSync(ruta, "utf8"), editado };
});
if (!notas.length) {
  console.error("Tareas/ está vacía: no se sincroniza nada (¿copia del vault a medias?).");
  process.exit(1);
}

// ------------------------------------------------------------ el tablero
const [tareas, etiquetas] = await Promise.all([store.listTareas(), store.etiquetasDeTareas()]);
const hoy = new Date().toISOString().slice(0, 10);
const plan = planDeSincronia({ notas, tareas, etiquetas, hoy });

console.log(`Tablero: ${store.hasSupabase() ? "Supabase" : "ficheros locales"} · ${tareas.length} tareas. Vault: ${notas.length} notas en Tareas/.`);
console.log(resumenDelPlan(plan));
const detalle = [
  ...plan.importar.map((i) => `  + al tablero: ${i.tarea.titulo}`),
  ...plan.crearNota.map((c) => `  + al vault: ${c.archivo}`),
  ...plan.cambiarNota.map((c) => `  ~ ${c.archivo}: ${Object.keys(c.cambios).join(", ")}`),
  ...plan.cambiarFila.filter((c) => Object.keys(c.cambios).some((k) => k !== "vault"))
    .map((c) => `  ~ tablero «${tareas.find((t) => t.id === c.id)?.titulo}»: ${Object.keys(c.cambios).filter((k) => k !== "vault").join(", ")}`),
  ...plan.borrarFila.map((b) => `  - del tablero: ${b.titulo}`),
  ...plan.renombrar.map((r) => `  > ${r.de} -> ${r.a}`),
];
if (detalle.length) console.log(detalle.join("\n"));

if (!aplicar) {
  console.log("\nNo se ha tocado nada. Para hacerlo: lo mismo con --aplicar.");
  process.exit(0);
}

// ------------------------------------------------------------ aplicar
const leer = (archivo) => readFileSync(path.join(vault, archivo), "utf8");
const escribir = (archivo, texto) => writeFileSync(path.join(vault, archivo), texto);
const baseDe = (t) => Object.fromEntries(["titulo", "columna", "quien", "etiqueta", "nota"].map((c) => [c, t[c] ?? null]));

if (plan.etiquetasNuevas.length) await store.guardarEtiquetasDeTareas(plan.etiquetas);

for (const { archivo, tarea } of plan.importar) {
  const fila = await store.crearTarea({ ...tarea, vault: { archivo, base: baseDe(tarea) } });
  escribir(archivo, escribirNota(leer(archivo), { tablero: fila.id }));
}
for (const { id, cambios } of plan.cambiarFila) await store.cambiarTarea(id, cambios);
for (const { id } of plan.borrarFila) await store.borrarTarea(id);
for (const { archivo, cambios } of plan.cambiarNota) escribir(archivo, escribirNota(leer(archivo), cambios));

// Renombrar como lo hace Obsidian: el archivo y cada [[enlace]] que lo nombra.
for (const { de, a } of plan.renombrar) {
  renameSync(path.join(vault, de), path.join(vault, a));
  const viejo = path.basename(de, ".md");
  const nuevo = path.basename(a, ".md");
  const patron = new RegExp(`\\[\\[${viejo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\]|#])`, "g");
  for (const f of todasLasNotas(vault)) {
    const texto = readFileSync(f, "utf8");
    if (patron.test(texto)) writeFileSync(f, texto.replace(patron, `[[${nuevo}`));
    patron.lastIndex = 0;
  }
}

for (const { id, archivo, texto, base } of plan.crearNota) {
  escribir(archivo, texto);
  await store.cambiarTarea(id, { vault: { archivo, base } });
}

console.log("\nHecho. En el vault queda por hacer commit y push de lo cambiado (git status).");

function todasLasNotas(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const ruta = path.join(dir, e.name);
    return e.isDirectory() ? todasLasNotas(ruta) : e.name.endsWith(".md") ? [ruta] : [];
  });
}
