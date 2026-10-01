import { describe, it, expect } from "vitest";
import { filasDeCaja, normalizarCaja, OPCIONES_CAJA } from "@/lib/caja";
import { premiosDe } from "@/lib/acciones";
import { patchNegocio } from "@/lib/validacion";

const una = { tipo: "sellos", meta: 8, premio: "café gratis", cartillas: null, acciones: ["sellar", "restar", "canjear"] };
const dos = {
  ...una,
  cartillas: [
    { nombre: "Cookies", marca: "galleta", meta: 8, premio: "cookie gratis" },
    { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
  ],
};

describe("la vista de la caja", () => {
  it("de partida, lo de siempre", () => {
    expect(normalizarCaja(undefined)).toEqual(Object.fromEntries(Object.entries(OPCIONES_CAJA).map(([k, o]) => [k, o.def])));
    expect(normalizarCaja({ sumarDos: true, raro: 1, grande: "si" })).toMatchObject({ sumarDos: true, grande: false });
  });

  it("una fila por cartilla, que suma, con el − dentro si se puede quitar", () => {
    expect(filasDeCaja(una)).toEqual([
      { tipo: "cartilla", key: "sellar", restar: "restar", dos: false, label: "Añadir sello", icon: "mas", cartilla: 0 },
    ]);
    const filas = filasDeCaja({ ...dos, caja: { sumarDos: true } });
    expect(filas.map((f) => [f.key, f.restar, f.label, f.dos])).toEqual([
      ["sellar", "restar", "Añadir cookie", true],
      ["sellar2", "restar2", "Añadir café", true],
    ]);
    expect(filasDeCaja({ ...una, acciones: ["sellar"] })[0].restar).toBeNull();
  });

  it("un cupón no suma: aplica el descuento; confirmar visita va aparte", () => {
    const cupon = { tipo: "descuento", meta: 1, premio: "20%", acciones: ["canjear", "confirmar"] };
    expect(filasDeCaja(cupon).map((f) => f.key)).toEqual(["canjear", "confirmar"]);
  });

  it("si la tienda no guarda premios, el recuadro solo ofrece darlo", () => {
    const cliente = { sellos: 8, sellos2: 0, guardados: 0, guardados2: 0 };
    expect(premiosDe(cliente, una)[0].acciones.guardar).toBe("guardar");
    expect(premiosDe(cliente, { ...una, caja: { guardarPremios: false } })[0].acciones.guardar).toBeNull();
  });

  it("el manager la guarda limpia", () => {
    expect(patchNegocio({ caja: { volverAlEscaner: true, x: 2 } }, []).patch.caja).toEqual({ ...normalizarCaja({}), volverAlEscaner: true });
  });
});
