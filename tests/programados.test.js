import { describe, it, expect } from "vitest";
import {
  elegibles, momentoDelDia, normalizarRegla, validarReglas, programadoNuevo, enviosDe, fraseRegla, proximoEnvio,
  normalizarLimiteDia, esProgramado, frecuenciaSemanal, proximoDiaAbierto,
} from "@/lib/automatizaciones";

const HORA = 60 * 60 * 1000;
const horario = { zona: "Europe/Madrid", semana: Array.from({ length: 7 }, () => ({ abre: "08:00", cierra: "20:00" })), cerrados: [] };
const ctx = (serial, extra = {}) => ({ serial, perfil: { contactable: true, visitas: 3, diasSinVenir: 2 }, desde: 0, vars: {}, ...extra });

describe("avisos programados", () => {
  it("a todos, cada vez que toca: hoy no se repite, mañana sí", () => {
    const r = programadoNuevo([], { dias: [], hora: "10:00" });
    expect(esProgramado(r)).toBe(true);
    const ahora = Date.parse("2026-10-05T10:00:00Z");
    const inicioHoy = Date.parse("2026-10-04T22:00:00Z");
    const ayer = enviosDe([{ grupo: `auto:${r.id}`, creado: new Date(ahora - 24 * HORA).toISOString(), seriales: ["a"] }]);
    expect(elegibles(r, [ctx("a"), ctx("b")], ayer, { ahora, pausaDias: 0, inicioHoy }).map((x) => x.serial)).toEqual(["a", "b"]);
    const hoy = enviosDe([{ grupo: `auto:${r.id}`, creado: new Date(ahora - HORA).toISOString(), seriales: ["a"] }]);
    expect(elegibles(r, [ctx("a"), ctx("b")], hoy, { ahora, pausaDias: 0, inicioHoy }).map((x) => x.serial)).toEqual(["b"]);
  });

  it("puede saltarse la pausa, pero nunca el máximo del día", () => {
    const ahora = Date.parse("2026-10-05T15:00:00Z");
    const inicioHoy = Date.parse("2026-10-04T22:00:00Z");
    const otro = { grupo: "auto:otro", creado: new Date(ahora - 2 * HORA).toISOString(), seriales: ["a"] };
    const envios = enviosDe([otro]);
    const normal = programadoNuevo([], {});
    expect(elegibles(normal, [ctx("a")], envios, { ahora, pausaDias: 3, inicioHoy })).toHaveLength(0);
    const salta = { ...normal, ignorarPausa: true };
    expect(elegibles(salta, [ctx("a")], envios, { ahora, pausaDias: 3, inicioHoy, limiteDia: 2 })).toHaveLength(1);
    const dos = enviosDe([otro, { ...otro, grupo: "auto:otro2" }]);
    expect(elegibles(salta, [ctx("a")], dos, { ahora, pausaDias: 3, inicioHoy, limiteDia: 2 })).toHaveLength(0);
  });

  it("un día concreto sale ese día y ninguno más", () => {
    const r = programadoNuevo([], { fecha: "2026-10-10", hora: "11:00" });
    expect(momentoDelDia(r, horario, "2026-10-10")).toBe(11 * 60);
    expect(momentoDelDia(r, horario, "2026-10-11")).toBeNull();
    expect(fraseRegla(r)).toMatchObject({ quien: "A todos" });
    expect(fraseRegla(r).cuando).toMatch(/10 de octubre a las 11:00/);
    expect(proximoEnvio(r, horario, Date.parse("2026-09-01T08:00:00Z"))).toMatchObject({ fecha: "2026-10-10" });
  });

  it("se guarda limpio; «a todos» solo vale programado; una regla vieja no cambia", () => {
    const r = normalizarRegla({ ...programadoNuevo([], { fecha: "2026-10-10" }), ignorarPausa: true });
    expect(r).toMatchObject({ cada: "vez", fecha: "2026-10-10", ignorarPausa: true, valor: null });
    expect(validarReglas([{ ...r, cada: undefined }]).error).toMatch(/solo vale para un aviso programado/);
    const vieja = normalizarRegla({ id: "x", disparo: "sin_venir", valor: 21, hora: "12:00", texto: "Hola", activa: true });
    expect(vieja).not.toHaveProperty("cada");
    expect(vieja).not.toHaveProperty("fecha");
  });

  it("el máximo del día va de 1 a 3 (lo que Google deja sonar), y de partida 1", () => {
    expect(normalizarLimiteDia(undefined)).toBe(1);
    expect(normalizarLimiteDia(9)).toBe(3);
    expect(normalizarLimiteDia(0)).toBe(1);
  });

  it("uno nuevo sale UNA vez, el próximo día que abre: lo frecuente se elige a propósito", () => {
    // Abre de lunes a sábado. Hoy es sábado 3: el próximo, el lunes 5.
    const lunesASabado = { ...horario, semana: horario.semana.map((t, i) => (i === 6 ? null : t)) };
    expect(proximoDiaAbierto(lunesASabado, "2026-10-03")).toBe("2026-10-05");
    const r = programadoNuevo([], {}, { horario: lunesASabado, hoy: "2026-10-03" });
    expect(r).toMatchObject({ fecha: "2026-10-05", cada: "vez" });
    // Lo que llega ya relleno (desde Clientes) manda.
    expect(programadoNuevo([], { dias: [1] }, { horario, hoy: "2026-10-03" })).not.toHaveProperty("fecha");
  });

  it("cada semana: uno es lo recomendable; varios, se avisa; todos, es diario", () => {
    expect(frecuenciaSemanal(1, 6).nivel).toBe("bien");
    expect(frecuenciaSemanal(2, 6).nivel).toBe("ojo");
    expect(frecuenciaSemanal(3, 6).nivel).toBe("mal");
    expect(frecuenciaSemanal(6, 6).texto).toMatch(/DIARIO/);
  });
});
