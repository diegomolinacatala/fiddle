import { vi } from "vitest";

// ============================================================================
// UN BUZÓN DE MENTIRA para los tests que verifican un correo (lib/codigos.js).
// Cada test lo usa así, arriba del todo (vi.mock se sube solo):
//   vi.mock("@/lib/correo", async () => (await import("./correoFalso.js")).modulo);
// y lee el código que «llegó» con `ultimoCodigo()`.
// ============================================================================

export const buzon = [];
export const modulo = {
  hayCorreo: () => true,
  mandarCorreo: vi.fn(async (correo) => {
    buzon.push(correo);
    return { ok: true };
  }),
};
/** Las 6 cifras del último correo mandado (a `para`, si se dice). */
export function ultimoCodigo(para) {
  const correo = [...buzon].reverse().find((c) => !para || c.para === para);
  return /\b(\d{6})\b/.exec(correo?.texto ?? "")?.[1] ?? null;
}
