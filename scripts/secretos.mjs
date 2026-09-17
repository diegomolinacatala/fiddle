#!/usr/bin/env node
// ============================================================================
// Genera los secretos de producción: AUTH_SECRET + una contraseña de 6 cifras
// por negocio y rol (CLAVE_<SLUG>_<ROL>; el nombre antiguo PIN_<SLUG>_<ROL>
// también sigue valiendo). Los escribe en certs/secretos.env (ignorado por git)
// listos para pegar en Vercel -> Settings -> Environment Variables.
//
//   npm run secretos            (no sobrescribe si ya existe)
//   npm run secretos -- --force
// ============================================================================
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LISTA_NEGOCIOS } from "../src/lib/negocios.js";
import { varClave, usuarioDe } from "../src/lib/auth.js";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const salida = process.argv.includes("--salida")
  ? path.resolve(process.argv[process.argv.indexOf("--salida") + 1])
  : path.join(raiz, "certs", "secretos.env");

if (existsSync(salida) && !process.argv.includes("--force")) {
  console.error(`\n✖ ${salida} ya existe. Usa --force para generar secretos nuevos (invalida los PINs actuales).\n`);
  process.exit(1);
}

const lineas = [`AUTH_SECRET=${randomBytes(32).toString("hex")}`];
const tabla = [];
for (const n of LISTA_NEGOCIOS) {
  for (const rol of ["manager", "caja"]) {
    const clave = String(randomInt(0, 1_000_000)).padStart(6, "0");
    lineas.push(`${varClave(n.slug, rol)}=${clave}`);
    tabla.push(`  ${n.nombre.padEnd(14)} ${rol.padEnd(8)} usuario ${usuarioDe(n.slug, rol).padEnd(14)} contraseña ${clave}`);
  }
}

mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, lineas.join("\n") + "\n", { mode: 0o600 });
console.log(`
✔ Secretos en ${salida}

Accesos (da el de manager solo al responsable de cada negocio):
${tabla.join("\n")}

Pega el contenido del fichero en Vercel -> Settings -> Environment Variables.
`);
