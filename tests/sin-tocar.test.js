import { describe, it, expect } from "vitest";
import { cuentaSinTocar, SEGUNDOS_SIN_TOCAR, SEGUNDOS_AVISO, TOQUES } from "@/lib/sinTocar";

describe("la ficha vuelve sola al escáner", () => {
  it("son 30 segundos y la barra sale los 5 últimos", () => {
    expect(SEGUNDOS_SIN_TOCAR).toBe(30);
    expect(SEGUNDOS_AVISO).toBe(5);
  });

  it("recién tocada, quieta hasta que empieza el aviso", () => {
    expect(cuentaSinTocar(0, 0)).toEqual({ fase: "quieta", quedan: 30_000, mirar: 25_000 });
    expect(cuentaSinTocar(0, 24_999)).toEqual({ fase: "quieta", quedan: 5_001, mirar: 1 });
  });

  it("los últimos segundos, el aviso, hasta irse", () => {
    expect(cuentaSinTocar(0, 25_000)).toEqual({ fase: "aviso", quedan: 5_000, mirar: 5_000 });
    expect(cuentaSinTocar(0, 29_000)).toEqual({ fase: "aviso", quedan: 1_000, mirar: 1_000 });
  });

  it("a los 30 segundos se va, y también si el móvil estuvo una hora con la pantalla apagada", () => {
    expect(cuentaSinTocar(0, 30_000)).toEqual({ fase: "salir", quedan: 0, mirar: 0 });
    expect(cuentaSinTocar(0, 3_600_000).fase).toBe("salir");
  });

  it("un toque vuelve a empezar la cuenta", () => {
    // Tocada a los 20 s: a los 26 s le quedan 24, no 4.
    expect(cuentaSinTocar(20_000, 26_000)).toEqual({ fase: "quieta", quedan: 24_000, mirar: 19_000 });
  });

  it("si el reloj del móvil va hacia atrás, no espera más de la cuenta entera", () => {
    expect(cuentaSinTocar(60_000, 0)).toEqual({ fase: "quieta", quedan: 30_000, mirar: 25_000 });
  });

  it("con otros segundos, las mismas reglas", () => {
    expect(cuentaSinTocar(0, 0, 10, 3)).toEqual({ fase: "quieta", quedan: 10_000, mirar: 7_000 });
    // Un aviso más largo que la cuenta es la cuenta entera.
    expect(cuentaSinTocar(0, 0, 4, 10).fase).toBe("aviso");
  });

  it("cuenta como tocar: toques, scroll con el dedo o la rueda, y teclado", () => {
    for (const ev of ["pointerdown", "touchstart", "touchmove", "wheel", "keydown", "input"]) expect(TOQUES).toContain(ev);
  });

  it("el evento scroll no cuenta: también salta cuando la página cambia de alto sola", () => {
    expect(TOQUES).not.toContain("scroll");
  });
});
