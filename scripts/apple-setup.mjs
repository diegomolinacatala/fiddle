#!/usr/bin/env node
// ============================================================================
// Configuración de Apple Wallet SIN Mac (sirve en Windows/Linux).
//
//   node scripts/apple-setup.mjs csr [--email tu@correo] [--nombre "Sellos"] [--force]
//       Genera certs/pass.key.pem (clave privada, NO la subas a ningún sitio)
//       y certs/pass.certSigningRequest (el CSR que subes a developer.apple.com).
//
//   node scripts/apple-setup.mjs env [--cer certs/pass.cer] [--wwdr certs/AppleWWDRCAG4.cer]
//       Con el .cer que te descargas de Apple: comprueba que casa con tu clave,
//       lee el Pass Type ID y el Team ID, y escribe certs/apple.env con las
//       variables APPLE_* listas para pegar en Vercel / .env.local.
//       Si no tienes el WWDR G4, lo descarga de apple.com.
//
//   node scripts/apple-setup.mjs env --tienda <slug> [--cer certs/<slug>.cer]
//       Pass Type ID PROPIO de una tienda (para que su tarjeta no se apile con
//       las de las demás en el Wallet). El .cer se pide con el MISMO CSR que el
//       general. Escribe certs/apple-<slug>.env con sus 2 variables.
//
//   node scripts/apple-setup.mjs prueba
//       Certificados FALSOS para probar en local la firma y el web service
//       (el iPhone no acepta esos pases). Escribe certs/prueba.env.
//
// Guía paso a paso: docs/APPLE-WALLET.md
// ============================================================================
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generarCsr, cadenaDePrueba, aPem, leerCertificadoPase, claveCoincide, aBase64,
} from "./lib/certs.mjs";
import { variablesDe } from "../src/lib/apple/config.js";

const DIR = "certs";
const URL_WWDR_G4 = "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer";

function argumentos(lista) {
  const out = {};
  for (let i = 0; i < lista.length; i++) {
    if (!lista[i].startsWith("--")) continue;
    const clave = lista[i].slice(2);
    const siguiente = lista[i + 1];
    out[clave] = siguiente && !siguiente.startsWith("--") ? (i++, siguiente) : true;
  }
  return out;
}

const salir = (mensaje) => {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
};

function lineasEnv(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

function csr(opts) {
  mkdirSync(DIR, { recursive: true });
  const rutaClave = path.join(DIR, "pass.key.pem");
  const rutaCsr = path.join(DIR, "pass.certSigningRequest");
  if (existsSync(rutaClave) && !opts.force) {
    salir(`${rutaClave} ya existe. Si de verdad quieres otra clave (invalida el certificado anterior), usa --force.`);
  }
  const { keyPem, csrPem } = generarCsr({ nombre: opts.nombre || "Sellos Wallet", email: opts.email });
  writeFileSync(rutaClave, keyPem, { mode: 0o600 });
  writeFileSync(rutaCsr, csrPem);
  console.log(`
✔ Clave privada: ${rutaClave}   (guárdala en un gestor de contraseñas; NO la subas a git)
✔ CSR:           ${rutaCsr}

Siguiente paso en https://developer.apple.com/account/resources/identifiers/list/passTypeId
  1. Crea (o abre) tu Pass Type ID, p.ej. pass.com.tudominio.sellos
  2. "Create Certificate" -> sube ${rutaCsr}
  3. Descarga el .cer y guárdalo como ${path.join(DIR, "pass.cer")}
  4. node scripts/apple-setup.mjs env
`);
}

async function obtenerWwdr(ruta) {
  if (ruta) return aPem(readFileSync(ruta));
  const local = path.join(DIR, "AppleWWDRCAG4.cer");
  if (existsSync(local)) return aPem(readFileSync(local));
  console.log(`Descargando el intermedio WWDR G4 de ${URL_WWDR_G4} ...`);
  const res = await fetch(URL_WWDR_G4);
  if (!res.ok) salir(`No se pudo descargar el WWDR G4 (${res.status}). Bájalo a mano a ${local}.`);
  const der = Buffer.from(await res.arrayBuffer());
  writeFileSync(local, der);
  return aPem(der);
}

async function env(opts) {
  if (opts.tienda !== undefined && !/^[a-z0-9-]+$/.test(String(opts.tienda))) {
    salir("--tienda necesita el slug de la tienda, tal como sale en su URL (p.ej. la-delicanteria).");
  }
  const rutaCer = opts.cer || path.join(DIR, opts.tienda ? `${opts.tienda}.cer` : "pass.cer");
  const rutaClave = opts.key || path.join(DIR, "pass.key.pem");
  if (!existsSync(rutaCer)) salir(`No encuentro ${rutaCer}. Descárgalo de Apple (paso 3 de "csr").`);
  if (!existsSync(rutaClave)) salir(`No encuentro ${rutaClave}. ¿Generaste el CSR en este ordenador?`);

  const certPem = aPem(readFileSync(rutaCer));
  const keyPem = readFileSync(rutaClave, "utf8");
  if (!claveCoincide(certPem, keyPem, opts.passphrase)) {
    salir("El certificado NO corresponde a esta clave privada. Sube de nuevo el CSR generado con esta clave.");
  }

  const info = leerCertificadoPase(certPem);
  if (!info.passTypeId?.startsWith("pass.")) {
    salir(`Este certificado no parece de un Pass Type ID (UID=${info.passTypeId}). ¿Descargaste el correcto?`);
  }
  if (info.caduca < new Date()) salir(`El certificado caducó el ${info.caduca.toISOString().slice(0, 10)}.`);

  if (opts.tienda) return envTienda(opts.tienda, certPem, info);

  const wwdrPem = await obtenerWwdr(opts.wwdr);
  const vars = {
    APPLE_PASS_TYPE_ID: info.passTypeId,
    APPLE_TEAM_ID: info.teamId,
    APPLE_PASS_CERT: aBase64(certPem),
    APPLE_PASS_KEY: aBase64(keyPem),
    APPLE_WWDR_CERT: aBase64(wwdrPem),
    ...(opts.passphrase ? { APPLE_PASS_KEY_PASSPHRASE: opts.passphrase } : {}),
  };
  const salida = path.join(DIR, "apple.env");
  writeFileSync(salida, lineasEnv(vars), { mode: 0o600 });
  console.log(`
✔ Pass Type ID: ${info.passTypeId}
✔ Team ID:      ${info.teamId}
✔ Caduca:       ${info.caduca.toISOString().slice(0, 10)}  (renuévalo antes: con él se firman y actualizan los pases)
✔ Variables en ${salida}

Pega esas 5 variables en Vercel (Settings -> Environment Variables, entorno Production).
NO hace falta .env.local: en local (http://localhost) Apple no puede actualizar pases.
Asegúrate de que APP_URL es la URL HTTPS pública: Apple solo actualiza pases contra HTTPS.
`);
}

// Solo lo que cambia por tienda: Team ID, clave y WWDR ya están en Vercel.
function envTienda(slug, certPem, info) {
  const nombres = variablesDe(slug);
  const salida = path.join(DIR, `apple-${slug}.env`);
  writeFileSync(salida, lineasEnv({ [nombres.passTypeId]: info.passTypeId, [nombres.cert]: aBase64(certPem) }), { mode: 0o600 });
  console.log(`
✔ Tienda:       ${slug}
✔ Pass Type ID: ${info.passTypeId}
✔ Caduca:       ${info.caduca.toISOString().slice(0, 10)}  (cada tienda se renueva por separado)
✔ Variables en ${salida}

Pega esas 2 variables en Vercel (Production) y vuelve a desplegar. En /admin,
"Estado de la integración" debe tener la fila "iPhone · ${slug}" en verde.
Las tarjetas que ya estuvieran instaladas siguen apiladas hasta que el cliente
las borre y las vuelva a añadir.
`);
}

function prueba() {
  mkdirSync(DIR, { recursive: true });
  const c = cadenaDePrueba({ passTypeId: "pass.dev.sellos.prueba", teamId: "PRUEBA0000" });
  const salida = path.join(DIR, "prueba.env");
  writeFileSync(salida, lineasEnv({
    APPLE_PASS_TYPE_ID: c.passTypeId,
    APPLE_TEAM_ID: c.teamId,
    APPLE_PASS_CERT: aBase64(c.certPem),
    APPLE_PASS_KEY: aBase64(c.keyPem),
    APPLE_WWDR_CERT: aBase64(c.wwdrPem),
  }));
  console.log(`✔ Certificados de PRUEBA en ${salida} (copia las líneas a .env.local para probar en local).`);
}

const [comando, ...resto] = process.argv.slice(2);
const opts = argumentos(resto);
if (comando === "csr") csr(opts);
else if (comando === "env") await env(opts);
else if (comando === "prueba") prueba();
else {
  console.log("Uso: node scripts/apple-setup.mjs <csr|env|prueba> [opciones]  ·  ver docs/APPLE-WALLET.md");
  process.exit(comando ? 1 : 0);
}
