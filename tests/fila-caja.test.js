import { describe, it, expect, vi } from "vitest";
import { crearFila } from "@/lib/filaCaja";

// Un reloj de mentira: los plazos vencen cuando lo dice el test.
function relojDePrueba() {
  const vivos = new Map();
  let n = 0;
  return {
    poner: (f, ms) => { n += 1; vivos.set(n, { f, ms }); return n; },
    quitar: (t) => { vivos.delete(t); },
    vencer() { for (const [t, { f }] of [...vivos]) { vivos.delete(t); f(); } },
    get activos() { return vivos.size; },
  };
}

// Un servidor que contesta cuando se le dice, en el orden en que le llegó.
function prueba() {
  const recibidas = [];
  const abiertas = [];
  const reloj = relojDePrueba();
  const mandar = vi.fn((key) => new Promise((ok) => { recibidas.push(key); abiertas.push(ok); }));
  const mandarAlSalir = vi.fn();
  const alSoltar = vi.fn();
  const alAcabar = vi.fn();
  const fila = crearFila({ mandar, mandarAlSalir, alSoltar, alAcabar, reloj });
  return { fila, reloj, recibidas, mandar, mandarAlSalir, alSoltar, alAcabar, contestar: () => abiertas.shift()?.() };
}

// Deja correr lo que la fila tenga encadenado.
const tic = () => new Promise((r) => setTimeout(r, 0));

describe("la fila de la caja", () => {
  it("manda de uno en uno: la segunda no sale hasta que contesta la primera", async () => {
    const t = prueba();
    t.fila.enviar("sellar");
    t.fila.enviar("sellar2");
    await tic();
    expect(t.recibidas).toEqual(["sellar"]);
    expect(t.fila.pendientes).toBe(2);
    t.contestar();
    await tic();
    expect(t.recibidas).toEqual(["sellar", "sellar2"]);
    expect(t.fila.pendientes).toBe(1);
    t.contestar();
    await tic();
    expect(t.fila.pendientes).toBe(0);
    expect(t.alAcabar).toHaveBeenCalledTimes(2);
  });

  it("el premio espera su plazo y sale una sola vez", async () => {
    const t = prueba();
    t.fila.esperar("canjear", 8000, { antes: { sellos: 8 } });
    await tic();
    expect(t.mandar).not.toHaveBeenCalled();
    expect(t.fila.pendientes).toBe(1);
    t.reloj.vencer();
    await tic();
    expect(t.recibidas).toEqual(["canjear"]);
    // Ya salió: ni otro plazo, ni otro toque, ni salir de la página lo mandan otra vez.
    t.reloj.vencer();
    expect(t.fila.confirmar()).toBeNull();
    expect(t.fila.alSalir()).toBeNull();
    await tic();
    expect(t.mandar).toHaveBeenCalledTimes(1);
    expect(t.mandarAlSalir).not.toHaveBeenCalled();
  });

  it("deshacer: el premio no sale nunca", async () => {
    const t = prueba();
    t.fila.esperar("guardar", 8000, { antes: { sellos: 8 } });
    const p = t.fila.soltar();
    expect(p).toMatchObject({ key: "guardar", antes: { sellos: 8 } });
    expect(t.reloj.activos).toBe(0);
    expect(t.fila.pendientes).toBe(0);
    await t.fila.vaciar();
    t.fila.alSalir();
    expect(t.mandar).not.toHaveBeenCalled();
    expect(t.mandarAlSalir).not.toHaveBeenCalled();
    expect(t.alSoltar).toHaveBeenCalledTimes(1);
  });

  it("otro premio manda el que esperaba, y en el orden en que se dieron", async () => {
    const t = prueba();
    t.fila.esperar("canjear", 8000);
    t.fila.esperar("usarGuardado", 8000);
    expect(t.fila.esperando.key).toBe("usarGuardado");
    expect(t.reloj.activos).toBe(1);
    // Otro toque (un sello) confirma el que queda antes de mandarse él.
    t.fila.confirmar();
    t.fila.enviar("sellar");
    for (let i = 0; i < 3; i += 1) { await tic(); t.contestar(); }
    await t.fila.vaciar();
    expect(t.recibidas).toEqual(["canjear", "usarGuardado", "sellar"]);
    expect(t.fila.pendientes).toBe(0);
  });

  it("vaciar manda lo que espera por la fila, espera la respuesta y no deja nada para salir", async () => {
    const t = prueba();
    t.fila.enviar("sellar");
    t.fila.esperar("canjear", 8000);
    let vacia = false;
    const vaciando = t.fila.vaciar().then(() => { vacia = true; });
    await tic();
    expect(t.recibidas).toEqual(["sellar"]);
    expect(t.reloj.activos).toBe(0); // el plazo ya no corre: no saldrá otra vez al vencer
    t.contestar();
    await tic();
    expect(t.recibidas).toEqual(["sellar", "canjear"]);
    expect(vacia).toBe(false);
    t.contestar();
    await vaciando;
    expect(vacia).toBe(true);
    expect(t.fila.pendientes).toBe(0);
    // Lo que hace la ficha al desmontarse: ya no queda nada que mandar con sendBeacon.
    expect(t.fila.alSalir()).toBeNull();
    t.reloj.vencer();
    await tic();
    expect(t.mandar).toHaveBeenCalledTimes(2);
    expect(t.mandarAlSalir).not.toHaveBeenCalled();
  });

  it("vaciar espera también lo que entra mientras tanto", async () => {
    const t = prueba();
    t.fila.enviar("sellar");
    let vacia = false;
    const vaciando = t.fila.vaciar().then(() => { vacia = true; });
    await tic();
    t.fila.enviar("sellar");
    t.contestar();
    await tic();
    expect(vacia).toBe(false);
    t.contestar();
    await vaciando;
    expect(t.recibidas).toEqual(["sellar", "sellar"]);
    expect(t.fila.pendientes).toBe(0);
  });

  it("sin nada pendiente, vaciar acaba al momento", async () => {
    const t = prueba();
    await t.fila.vaciar();
    expect(t.mandar).not.toHaveBeenCalled();
  });

  it("al salir de la página, lo que espera sale sin fila, una sola vez", async () => {
    const t = prueba();
    t.fila.esperar("usarGuardado", 8000);
    expect(t.fila.alSalir()).toMatchObject({ key: "usarGuardado" });
    expect(t.mandarAlSalir).toHaveBeenCalledWith("usarGuardado");
    expect(t.reloj.activos).toBe(0);
    t.fila.alSalir();
    await t.fila.vaciar();
    expect(t.mandarAlSalir).toHaveBeenCalledTimes(1);
    expect(t.mandar).not.toHaveBeenCalled();
  });

  it("deshacer cambios va por la misma fila: después de lo que había, antes de lo que venga", async () => {
    const t = prueba();
    t.fila.enviar("sellar");
    t.fila.encolar(() => new Promise((ok) => { t.recibidas.push("deshacer"); ok(); }));
    t.fila.enviar("sellar2");
    await tic();
    expect(t.recibidas).toEqual(["sellar"]);
    t.contestar();
    await tic();
    await tic();
    expect(t.recibidas).toEqual(["sellar", "deshacer", "sellar2"]);
    t.contestar();
    await t.fila.vaciar();
    expect(t.fila.pendientes).toBe(0);
    expect(t.alAcabar).toHaveBeenCalledTimes(3);
  });

  it("si una petición lanza, la fila no se atasca", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mandar = vi.fn().mockRejectedValueOnce(new Error("roto")).mockResolvedValue(undefined);
    const fila = crearFila({ mandar, mandarAlSalir: vi.fn() });
    fila.enviar("sellar");
    fila.enviar("sellar");
    await fila.vaciar();
    expect(mandar).toHaveBeenCalledTimes(2);
    expect(fila.pendientes).toBe(0);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
