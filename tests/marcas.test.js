import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Google y Apple prohíben tocar sus botones: ni color, ni radio, ni textos
// propios (Google además lo revisa antes de dar acceso de publicación). Estos son
// los SVG de sus paquetes oficiales sin un byte cambiado:
//   Google  add-to-wallet-svg.zip, variantes esES
//   Apple   Add-to-Apple-Wallet.zip, ES/RGB (en España se llama "Cartera")
// Si este test falla, alguien los ha editado: volver a copiarlos del paquete.
const OFICIALES = {
  "public/marcas/google-wallet-anadir.svg": "b2f6002c00e794352ba2e032606392131385fa0813ef8cc4a958e2f5fb8ebd5b",
  "public/marcas/google-wallet-anadir-compacto.svg": "ccf813397a0443cbc2a7e0601a3e98010bd74d25b4c90c386351443c87e01816",
  "public/marcas/apple-wallet-anadir.svg": "be973073bd9d7876e1bfbe500044bafc111dff382b74c2b2400e9165ce44d3f0",
};

describe("botones oficiales de Wallet", () => {
  for (const [ruta, sha] of Object.entries(OFICIALES)) {
    it(`${ruta} es el oficial de Google, intacto`, () => {
      const hash = createHash("sha256").update(readFileSync(ruta)).digest("hex");
      expect(hash).toBe(sha);
    });
  }
});
