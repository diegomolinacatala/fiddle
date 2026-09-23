#!/usr/bin/env node
// ============================================================================
// Genera CIFRADO_CLAVE (32 bytes en base64), la que cifra nombres y notas de los
// clientes (src/lib/cifrado.js). La escribe en certs/cifrado.env (ignorado por
// git) para pegarla en Vercel -> Settings -> Environment Variables.
//
//   npm run clave-cifrado
//
// NUNCA sobrescribe: con otra clave, lo que ya se cifró no se puede leer. Para
// cambiarla de verdad hace falta migrar los datos, no generar otra.
// ============================================================================
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const salida = path.join(raiz, "certs", "cifrado.env");

if (existsSync(salida)) {
  console.error(`\n✖ ${salida} ya existe. No se genera otra: la de ahí es la que abre los datos.\n`);
  process.exit(1);
}

mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, `CIFRADO_CLAVE=${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
console.log(`
✔ Clave en ${salida}

1. Pégala en Vercel -> Settings -> Environment Variables (Production), marcada Sensitive.
2. Guarda una copia fuera del ordenador (gestor de contraseñas). Si se pierde,
   los nombres y notas cifrados se pierden con ella.
`);
