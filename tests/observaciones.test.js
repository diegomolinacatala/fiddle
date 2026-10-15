import { describe, it, expect } from "vitest";
import { observaciones, enlaceDeAccion, listaDias, suficiencia, textoFalta } from "@/lib/observaciones";

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

  it("habla de «los mediodías», no de «las mediodías»", () => {
    // Martes y miércoles a mediodía, casi nadie.
    const r = rejilla();
    for (let h = 12; h < 16; h++) { r[1][h] = 0; r[2][h] = 0; }
    for (let d = 0; d < 5; d++) for (let h = 16; h < 20; h++) r[d][h] = 5;
    const tranquilo = observaciones({ rejilla: r, horario }).find((o) => o.id.startsWith("tranquilo"));
    expect(tranquilo.texto).toBe("Lo más tranquilo: los mediodías de martes y miércoles.");
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

describe("¿hay con qué? (suficiencia)", () => {
  // Lunes 5 de octubre de 2026 en adelante; la tienda abre de lunes a viernes.
  const AHORA = Date.parse("2026-10-19T18:00:00Z"); // lunes, dos semanas después
  const visita = (fecha, serial, hora = "09") => ({ serial, tipo: "sellar", ts: `${fecha}T${hora}:00:00Z` });
  const semana = (lunes, por = 4) => [0, 1, 2, 3, 4].flatMap((d) => {
    const f = new Date(Date.parse(`${lunes}T12:00:00Z`) + d * 864e5).toISOString().slice(0, 10);
    return Array.from({ length: por }, (_, i) => visita(f, `c${i}`));
  });

  it("la primera semana no basta, aunque haya visitas de sobra", () => {
    const s = suficiencia({ eventos: semana("2026-10-05", 10), horario, ahora: Date.parse("2026-10-10T12:00:00Z") });
    expect(s.visitas).toBe(50);
    expect(s.suficiente).toBe(false);
    expect(s.faltan).toEqual([0, 1, 2, 3, 4]); // sábado y domingo cierra: no faltan
    expect(textoFalta(s)).toBe("Hace falta ver cada día que abres al menos 2 veces con visitas (faltan de lunes a viernes).");
  });

  it("con dos semanas de cada día y visitas suficientes, sí", () => {
    const s = suficiencia({ eventos: [...semana("2026-10-05"), ...semana("2026-10-12")], horario, ahora: AHORA });
    expect(s).toMatchObject({ suficiente: true, faltan: [] });
  });

  it("un día que no se ha visto dos veces sigue faltando, y lo dice", () => {
    const eventos = [...semana("2026-10-05"), ...semana("2026-10-12")].filter((e) => !e.ts.startsWith("2026-10-14"));
    const s = suficiencia({ eventos, horario, ahora: AHORA });
    expect(s.faltan).toEqual([2]);
    expect(textoFalta(s)).toMatch(/faltan los miércoles/);
  });

  // Cuatro semanas sin nadie un miércoles.
  const sinMiercoles = (lunes) => semana(lunes).filter((e) => new Date(e.ts).getUTCDay() !== 3);
  const eventosSinMiercoles = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].flatMap(sinMiercoles);

  it("un día abierto en el que nunca viene nadie no deja la barrera puesta para siempre", () => {
    expect(suficiencia({ eventos: eventosSinMiercoles, horario, ahora: AHORA }).suficiente).toBe(true);
  });

  it("un festivo no cuenta como día visto", () => {
    // Uno de esos miércoles cerró: solo se ha abierto tres, aún no se sabe si es un día muerto.
    const conFestivo = { ...horario, cerrados: ["2026-10-07"] };
    expect(suficiencia({ eventos: eventosSinMiercoles, horario: conFestivo, ahora: AHORA }).faltan).toEqual([2]);
  });

  it("sin datos suficientes, ni patrones ni tendencia: solo lo que falta", () => {
    const s = suficiencia({ eventos: semana("2026-10-05", 10), horario, ahora: Date.parse("2026-10-10T12:00:00Z") });
    const obs = observaciones({ rejilla: rejilla(), horario, suficiencia: s, metricas: { visitas30: 50, visitas30Previas: 20 } });
    expect(obs.map((o) => o.id)).toEqual(["pocos"]);
    expect(obs[0].detalle).toMatch(/^Hace falta/);
  });
});
