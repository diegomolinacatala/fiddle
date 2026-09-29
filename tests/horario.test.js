import { describe, it, expect } from "vitest";
import {
  normalizarHorario, relojLocal, fechaLocal, tramoDe, diaDeFecha, sumarDias, diasAbiertosAntes, rachaDe,
  resumenHorario, cuandoTexto, aMinutos, aHora, horaCorta, inicioDelDia, cierreTras, estadoAhora,
} from "@/lib/horario";
import { SEMILLAS } from "@/lib/negocios";

const deli = normalizarHorario(SEMILLAS.delicanteria.horario);

describe("la hora de la tienda, no la del servidor", () => {
  it("en verano Valencia va dos horas por delante de UTC; en invierno, una", () => {
    // Jueves 24 de septiembre de 2026, 10:00 UTC = 12:00 en Valencia.
    expect(relojLocal(Date.parse("2026-09-24T10:00:00Z"), "Europe/Madrid")).toEqual({ fecha: "2026-09-24", dia: 3, minutos: 720 });
    expect(relojLocal(Date.parse("2026-12-01T10:00:00Z"), "Europe/Madrid").minutos).toBe(660);
  });

  it("a las 23:30 UTC en Valencia ya es el día siguiente", () => {
    expect(fechaLocal(Date.parse("2026-09-24T23:30:00Z"), "Europe/Madrid")).toBe("2026-09-25");
  });

  it("una zona que no existe cae a Madrid en vez de romper", () => {
    expect(relojLocal(Date.parse("2026-09-24T10:00:00Z"), "Marte/Olympus").minutos).toBe(720);
  });

  it("días y horas", () => {
    expect(diaDeFecha("2026-09-27")).toBe(6); // domingo
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(aMinutos("07:30")).toBe(450);
    expect(aMinutos("7:30")).toBeNull();
    expect(aHora(990)).toBe("16:30");
    expect(horaCorta("08:00")).toBe("8:00");
  });
});

describe("el horario de La Delicantería", () => {
  it("de lunes a jueves hasta las 18:30, el viernes hasta las 16:30, el sábado por la mañana", () => {
    expect(tramoDe(deli, "2026-09-24")).toEqual({ abre: 450, cierra: 1110 });
    expect(tramoDe(deli, "2026-09-25")).toEqual({ abre: 450, cierra: 990 });
    expect(tramoDe(deli, "2026-09-26")).toEqual({ abre: 510, cierra: 780 });
    expect(tramoDe(deli, "2026-09-27")).toBeNull();
  });

  it("los festivos cierran aunque caigan entre semana", () => {
    expect(tramoDe(deli, "2026-10-09")).toBeNull(); // 9 d'Octubre, viernes
    expect(tramoDe(deli, "2026-10-12")).toBeNull();
  });

  it("se lee en una línea", () => {
    expect(resumenHorario(deli)).toBe("L–J 7:30–18:30 · V 7:30–16:30 · S 8:30–13:00");
    expect(resumenHorario(null)).toBe("Sin horario");
  });

  it("sin horario, abierta siempre: nada se bloquea", () => {
    expect(tramoDe(null, "2026-09-27")).toEqual({ abre: 0, cierra: 1440 });
  });
});

describe("días seguidos", () => {
  it("el domingo cerrado no rompe la racha de sábado a lunes", () => {
    expect(diasAbiertosAntes(deli, "2026-09-28", 2)).toEqual(["2026-09-26", "2026-09-25"]);
  });

  it("cuenta hacia atrás desde el último día abierto, sin contar hoy", () => {
    const vino = new Set(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(rachaDe(vino, deli, "2026-09-28")).toEqual({ racha: 5, inicio: "2026-09-22" });
    expect(rachaDe(new Set(["2026-09-25", "2026-09-26", "2026-09-28"]), deli, "2026-09-28")).toEqual({ racha: 2, inicio: "2026-09-25" });
  });

  it("un hueco rompe la racha", () => {
    expect(rachaDe(new Set(["2026-09-22", "2026-09-24"]), deli, "2026-09-25")).toEqual({ racha: 1, inicio: "2026-09-24" });
    expect(rachaDe(new Set(), deli, "2026-09-25")).toEqual({ racha: 0, inicio: null });
  });
});

describe("normalizarHorario", () => {
  it("un día con el cierre antes de la apertura cuenta como cerrado", () => {
    const h = normalizarHorario({ semana: [{ abre: "18:00", cierra: "09:00" }, null, null, null, null, null, null] });
    expect(h.semana[0]).toBeNull();
    expect(h.zona).toBe("Europe/Madrid");
  });

  it("limpia los días cerrados y rechaza semanas incompletas", () => {
    const h = normalizarHorario({ semana: Array(7).fill(null), cerrados: ["2026-10-09", "mañana", "2026-10-09", "2026-02-30"] });
    expect(h.cerrados).toEqual(["2026-10-09"]);
    expect(normalizarHorario({ semana: [] })).toBeNull();
    expect(normalizarHorario(null)).toBeNull();
  });
});

describe("cuandoTexto", () => {
  it("hoy, mañana, el día de la semana o la fecha", () => {
    expect(cuandoTexto("2026-09-24", "2026-09-24")).toBe("hoy");
    expect(cuandoTexto("2026-09-25", "2026-09-24")).toBe("mañana");
    expect(cuandoTexto("2026-09-28", "2026-09-24")).toBe("el lunes");
    expect(cuandoTexto("2026-10-09", "2026-09-24")).toBe("el 9 de octubre");
  });
});

describe("medianoche y cierre, en la tienda", () => {
  it("el día empieza a las 00:00 de la tienda, no de UTC", () => {
    expect(new Date(inicioDelDia("2026-09-24", "Europe/Madrid")).toISOString()).toBe("2026-09-23T22:00:00.000Z");
    expect(new Date(inicioDelDia("2026-12-01", "Europe/Madrid")).toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(new Date(inicioDelDia("2026-09-24", "America/New_York")).toISOString()).toBe("2026-09-24T04:00:00.000Z");
  });

  it("el primer cierre después de mandar algo", () => {
    const a = (iso) => cierreTras(deli, Date.parse(iso));
    expect(a("2026-09-24T08:00:00Z")).toEqual({ fecha: "2026-09-24", minutos: 1110 }); // jueves: hoy a las 18:30
    expect(a("2026-09-25T15:00:00Z")).toEqual({ fecha: "2026-09-26", minutos: 780 });  // viernes 17:00: sábado a las 13:00
    expect(a("2026-09-27T10:00:00Z")).toEqual({ fecha: "2026-09-28", minutos: 1110 }); // domingo: el lunes
    expect(cierreTras(null, Date.parse("2026-09-27T10:00:00Z"))).toEqual({ fecha: "2026-09-27", minutos: 1440 });
  });
});

describe("¿abierta ahora? (la línea bajo el nombre en la tarjeta)", () => {
  // Septiembre y principios de octubre: Valencia va dos horas por delante de UTC.
  const a = (iso, horario = deli) => estadoAhora(horario, Date.parse(iso));

  it("abierta: hasta qué hora", () => {
    expect(a("2026-09-24T10:00:00Z")).toEqual({ abierta: true, tono: "abierto", corto: "Abierto", texto: "Abierto hasta las 18:30" }); // jueves 12:00
    expect(a("2026-09-24T05:30:00Z").texto).toBe("Abierto hasta las 18:30"); // justo al abrir, 7:30
  });

  it("en la última hora avisa de que cierra pronto", () => {
    expect(a("2026-09-24T15:30:00Z")).toEqual({ abierta: true, tono: "pronto", corto: "Cierra pronto", texto: "Cierra pronto · 18:30" }); // 17:30
    expect(a("2026-09-24T15:29:00Z").tono).toBe("abierto"); // 17:29: aún falta más de una hora
    expect(a("2026-09-26T10:15:00Z").texto).toBe("Cierra pronto · 13:00"); // sábado 12:15
  });

  it("a la hora de cerrar ya está cerrada y dice cuándo vuelve a abrir", () => {
    expect(a("2026-09-24T16:30:00Z")).toEqual({ abierta: false, tono: "cerrado", corto: "Cerrado", texto: "Cerrado hasta mañana" });
  });

  it("de madrugada: hasta qué hora está cerrada y, en la última hora, que abre pronto", () => {
    expect(a("2026-09-25T03:00:00Z")).toEqual({ abierta: false, tono: "cerrado", corto: "Cerrado", texto: "Cerrado hasta las 7:30" }); // viernes 5:00
    expect(a("2026-09-25T05:00:00Z")).toEqual({ abierta: false, tono: "pronto", corto: "Abre pronto", texto: "Abre pronto · 7:30" }); // 7:00
  });

  it("se salta el domingo y los festivos", () => {
    expect(a("2026-09-26T12:00:00Z").texto).toBe("Cerrado hasta el lunes"); // sábado 14:00
    expect(a("2026-09-27T10:00:00Z").texto).toBe("Cerrado hasta mañana"); // domingo
    // Jueves 8 de octubre por la tarde: el 9 es festivo, abre el sábado.
    expect(a("2026-10-08T17:00:00Z").texto).toBe("Cerrado hasta el sábado");
  });

  it("de vacaciones más de una semana: la fecha", () => {
    const cerrados = Array.from({ length: 14 }, (_, i) => sumarDias("2026-09-28", i));
    const vacaciones = normalizarHorario({ ...deli, cerrados });
    expect(a("2026-09-28T10:00:00Z", vacaciones).texto).toBe("Cerrado hasta el 12 de octubre");
  });

  it("«abre pronto» también si abre pasada la medianoche", () => {
    const madrugada = normalizarHorario({ zona: "Europe/Madrid", semana: Array(7).fill({ abre: "00:15", cierra: "08:00" }) });
    expect(a("2026-09-24T21:50:00Z", madrugada)).toEqual({ abierta: false, tono: "pronto", corto: "Abre pronto", texto: "Abre pronto · 0:15" }); // 23:50
    expect(a("2026-09-24T21:00:00Z", madrugada).texto).toBe("Cerrado hasta mañana"); // 23:00: aún falta más de una hora
  });

  it("la 1:00 es «la», no «las»", () => {
    const noche = normalizarHorario({ zona: "Europe/Madrid", semana: Array(7).fill({ abre: "00:00", cierra: "01:45" }) });
    expect(a("2026-09-24T22:00:00Z", noche).texto).toBe("Abierto hasta la 1:45"); // 0:00
  });

  it("sin horario no dice nada: «abierto» sería inventárselo", () => {
    expect(estadoAhora(null, Date.parse("2026-09-24T10:00:00Z"))).toBeNull();
  });

  it("cerrada todos los días: solo «Cerrado»", () => {
    const nunca = normalizarHorario({ zona: "Europe/Madrid", semana: Array(7).fill(null) });
    expect(a("2026-09-24T10:00:00Z", nunca)).toEqual({ abierta: false, tono: "cerrado", corto: "Cerrado", texto: "Cerrado" });
  });

  it("lo corto es siempre el principio del texto (la tarjeta enseña eso si no cabe más)", () => {
    for (let h = 0; h < 24 * 7; h += 1) {
      const e = a(new Date(Date.parse("2026-09-21T00:00:00Z") + h * 3_600_000).toISOString());
      expect(e.texto.startsWith(e.corto)).toBe(true);
    }
  });

  it("en invierno la hora sigue siendo la de la tienda", () => {
    expect(a("2026-12-01T17:00:00Z").texto).toBe("Cierra pronto · 18:30"); // martes 18:00 en Valencia (UTC+1)
  });
});
