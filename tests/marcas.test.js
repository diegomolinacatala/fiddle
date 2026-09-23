import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Google revisa el botón antes de dar acceso de publicación y prohíbe tocarlo:
// ni color, ni radio, ni textos propios. Estos son los SVG de su paquete oficial
// (add-to-wallet-svg.zip, variantes esES) sin un byte cambiado. Si este test
// falla, alguien los ha editado: volver a copiarlos del paquete de Google.
const OFICIALES = {
  "public/marcas/google-wallet-anadir.svg": "b2f6002c00e794352ba2e032606392131385fa0813ef8cc4a958e2f5fb8ebd5b",
  "public/marcas/google-wallet-anadir-compacto.svg": "ccf813397a0443cbc2a7e0601a3e98010bd74d25b4c90c386351443c87e01816",
};

describe("botón «Añadir a Google Wallet»", () => {
  for (const [ruta, sha] of Object.entries(OFICIALES)) {
    it(`${ruta} es el oficial de Google, intacto`, () => {
      const hash = createHash("sha256").update(readFileSync(ruta)).digest("hex");
      expect(hash).toBe(sha);
    });
  }
});
