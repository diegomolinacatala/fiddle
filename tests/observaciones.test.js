import { describe, it, expect } from "vitest";
import { observaciones, enlaceDeAccion, listaDias } from "@/lib/observaciones";

// Lunes a viernes de 8 a 20. Mucha gente por la mañana, casi nadie martes y miércoles por la tarde.
const horario = {
  zona: "Europe/Madrid",
  semana: [0, 1, 2, 3, 4].map(() => ({ abre: "08:00", cierra: "20:00" })).concat([null, null]),
  cerrados: [],
};
function rejilla() {
  const r = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (let d = 0; d < 5; d++) {
    for (let h = 8; h < 12; h++) r[d][h] = 12;
    for (let h = 12; h < 16; h++) r[d][h] = 5;
    for (let h = 16; h < 20; h++) r[d][h] = d === 1 || d === 2 ? 0 : 5;
  }
  return r;
}

describe("lo que dicen los números", () => {
  it("encuentra las tardes tranquilas y propone un aviso para ellas", () => {
    const obs = observaciones({ rejilla: rejilla(), horario });
    const tranquilo = obs.find((o) => o.id.startsWith("tranquilo"));
    expect(tranquilo.texto).toBe("Lo más tranquilo: las tardes de martes y miércoles.");
    // Un día a la semana (el más flojo), no uno por cada tarde tranquila.
    // No es un grupo de clientes: es un momento. A todos, "solo ese día", con día y hora propuestos.
    expect(tranquilo.accion).toMatchObject({ tipo: "enviar", grupo: "momento", dia: 1, hora: "16:00" });
    expect(tranquilo.accion.label).toBe("Avisar los martes");
  });

  it("dice cuándo es lo más fuerte, sin botón", () => {
    const fuerte = observaciones({ rejilla: rejilla(), horario }).find((o) => o.id.startsWith("fuerte"));
    expect(fuerte.texto).toMatch(/^Lo más fuerte: las mañanas de lunes a viernes/);
    expect(fuerte.accion).toBeUndefined();
  });

  it("con pocas visitas no se inventa patrones", () => {
    const poco = Array.from({ length: 7 }, () => new Array(24).fill(0));
    poco[0][9] = 3;
    expect(observaciones({ rejilla: poco, horario }).map((o) => o.id)).toEqual(["pocos"]);
  });

  it("los grupos y la tendencia llevan a escribirles", () => {
    const obs = observaciones({
      rejilla: rejilla(), horario,
      metricas: { visitas30: 40, visitas30Previas: 80 },
      grupos: [{ key: "premio_listo", total: 4 }, { key: "a_punto", total: 1 }],
    });
    expect(obs.find((o) => o.id === "baja").texto).toBe("Estos 30 días han venido un 50% menos que los 30 anteriores.");
    expect(obs.find((o) => o.id === "premios").accion).toMatchObject({ tipo: "grupo", grupo: "premio_listo" });
    expect(obs.find((o) => o.id === "a-punto")).toBeUndefined();
  });

  it("el enlace lleva a Avisos con todo preparado", () => {
    expect(enlaceDeAccion("deli", { tipo: "grupo", grupo: "riesgo" })).toBe("/deli/avisos?grupo=riesgo");
    // Un hueco: a Enviar, con el texto, el día, la hora y de dónde viene.
    const hueco = new URL(enlaceDeAccion("deli", { tipo: "enviar", grupo: "momento", dia: 1, hora: "16:00", texto: "Tranquilo" }, "Lo más tranquilo: las tardes de martes."), "http://x");
    expect(hueco.pathname).toBe("/deli/avisos");
    expect(Object.fromEntries(hueco.searchParams)).toEqual({ grupo: "momento", texto: "Tranquilo", dia: "1", hora: "16:00", por: "Lo más tranquilo: las tardes de martes." });
    const url = enlaceDeAccion("deli", { tipo: "programar", base: { nombre: "Tardes tranquilas", dias: [1, 2] } });
    const crudo = new URL(url, "http://x").searchParams.get("programar");
    expect(JSON.parse(Buffer.from(crudo.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))).toEqual({ nombre: "Tardes tranquilas", dias: [1, 2] });
  });

  it("los días se dicen como se dicen", () => {
    expect(listaDias([1, 2])).toBe("martes y miércoles");
    expect(listaDias([0, 1, 2, 3])).toBe("de lunes a jueves");
    expect(listaDias([5])).toBe("los sábados");
  });
});

it("un solo día: «las tardes de los sábados»", () => {
  const r = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const h6 = { zona: "Europe/Madrid", semana: Array.from({ length: 7 }, () => ({ abre: "08:00", cierra: "20:00" })), cerrados: [] };
  for (let d = 0; d < 7; d++) for (let h = 8; h < 20; h++) r[d][h] = d === 5 && h >= 16 ? 0 : 4;
  expect(observaciones({ rejilla: r, horario: h6 }).find((o) => o.id.startsWith("tranquilo")).texto).toBe("Lo más tranquilo: las tardes de los sábados.");
});
