import { describe, it, expect } from "vitest";
import { avisoDelDia, PAUSA_MISMO_AVISO_DIAS, MAX_AVISOS_SEMANA } from "@/lib/dueno/avisos";

const negocio = { slug: "cafe", horario: { zona: "Europe/Madrid", semana: [] } };
// Lunes 16-11-2026, 09:00 en Madrid.
const LUNES = Date.parse("2026-11-16T08:00:00Z");

const enviar = (id, dia, hora, texto = "Las tardes de martes viene menos gente.") => ({
  id, texto,
  accion: { tipo: "enviar", grupo: "momento", label: "Avisar", dia, hora, texto: "Pásate" },
});
const grupo = (id, texto = "Hay clientes que llevan semanas sin venir.") => ({
  id, texto, accion: { tipo: "grupo", grupo: "dormidos", label: "Avisar" },
});

const pedir = (extra) => avisoDelDia({ observaciones: [], negocio, ahora: LUNES, ...extra });

describe("avisoDelDia: el día de la semana y la hora", () => {
  it("una idea de enviar vale en su día, con la hora en la frase", () => {
    const a = pedir({ observaciones: [enviar("tarde", 0, "16:00")] });
    expect(a.id).toBe("tarde");
    expect(a.texto).toBe("Las tardes de martes viene menos gente. Te hemos preparado un aviso para hoy a las 16:00.");
  });

  it("fuera de su día no sale", () => {
    expect(pedir({ observaciones: [enviar("tarde", 1, "16:00")] })).toBeNull();
  });

  it("si su hora ya ha pasado no sale", () => {
    expect(pedir({ observaciones: [enviar("tarde", 0, "08:00")] })).toBeNull();
  });

  it("salta a la siguiente idea que sí vale", () => {
    const a = pedir({ observaciones: [enviar("tarde", 1, "16:00"), grupo("dormidos")] });
    expect(a.id).toBe("dormidos");
  });

  it("una idea de grupo dice que se ha preparado un aviso para ellos", () => {
    expect(pedir({ observaciones: [grupo("dormidos")] }).texto).toMatch(/Te hemos preparado un aviso para ellos\.$/);
  });

  it("ignora las ideas sin acción o de programar", () => {
    const obs = [{ id: "a", texto: "x" }, { id: "b", texto: "y", accion: { tipo: "programar", base: {} } }];
    expect(pedir({ observaciones: obs })).toBeNull();
  });
});

describe("avisoDelDia: enlace y caducidad", () => {
  it("el enlace cuelga de la base y lleva a Avisos con la idea rellena", () => {
    const a = pedir({ observaciones: [enviar("tarde", 0, "16:00")], base: "https://fiddle.test" });
    expect(a.enlace.startsWith("https://fiddle.test/cafe/avisos?grupo=momento")).toBe(true);
    expect(a.enlace).toContain("hora=16%3A00");
  });

  it("caduca al acabar el día local de la tienda", () => {
    const a = pedir({ observaciones: [grupo("dormidos")] });
    expect(a.hasta).toBe("2026-11-16T23:00:00.000Z");
  });
});

describe("avisoDelDia: sin agobiar", () => {
  it("no repite lo dicho hace menos de la pausa", () => {
    const hace = "2026-11-05"; // 11 días
    expect(PAUSA_MISMO_AVISO_DIAS).toBe(14);
    expect(pedir({ observaciones: [grupo("dormidos")], avisados: { dormidos: hace } })).toBeNull();
  });

  it("lo repite cuando pasan 14 días", () => {
    expect(pedir({ observaciones: [grupo("dormidos")], avisados: { dormidos: "2026-11-02" } })?.id).toBe("dormidos");
  });

  it("con dos avisos ya esta semana, ninguno más", () => {
    expect(MAX_AVISOS_SEMANA).toBe(2);
    const avisados = { a: "2026-11-16", b: "2026-11-16" };
    expect(pedir({ observaciones: [grupo("dormidos")], avisados })).toBeNull();
  });

  it("con uno solo esta semana, todavía cabe otro", () => {
    expect(pedir({ observaciones: [grupo("dormidos")], avisados: { a: "2026-11-16" } })?.id).toBe("dormidos");
  });

  it("si el dueño quiere una a la semana, con una ya dicha no hay más", () => {
    expect(pedir({ observaciones: [grupo("dormidos")], avisados: { a: "2026-11-16" }, porSemana: 1 })).toBeNull();
    expect(pedir({ observaciones: [grupo("dormidos")], porSemana: 1 })?.id).toBe("dormidos");
  });

  it("un tope mayor que el de fiddle no lo sube", () => {
    const avisados = { a: "2026-11-16", b: "2026-11-16" };
    expect(pedir({ observaciones: [grupo("dormidos")], avisados, porSemana: 5 })).toBeNull();
  });

  it("los de la semana pasada no cuentan para el tope", () => {
    const avisados = { a: "2026-11-10", b: "2026-11-11" };
    expect(pedir({ observaciones: [grupo("dormidos")], avisados })?.id).toBe("dormidos");
  });

  it("la semana local acaba en domingo: el domingo cuenta con su semana", () => {
    const domingo = Date.parse("2026-11-22T10:00:00Z");
    const avisados = { a: "2026-11-16", b: "2026-11-18" };
    expect(avisoDelDia({ observaciones: [grupo("dormidos")], negocio, ahora: domingo, avisados })).toBeNull();
  });
});

describe("avisoDelDia: el plan de la tienda", () => {
  it("sin promos, no propone un aviso a todos ni de momento", () => {
    const sinPromos = { ...negocio, funciones: { promos: false } };
    expect(pedir({ negocio: sinPromos, observaciones: [enviar("tarde", 0, "16:00")] })).toBeNull();
  });

  it("sin grupos, no propone avisar a un grupo", () => {
    const sinGrupos = { ...negocio, funciones: { grupos: false } };
    expect(pedir({ negocio: sinGrupos, observaciones: [grupo("dormidos")] })).toBeNull();
  });

  it("con grupos pero sin promos, sigue proponiendo el grupo", () => {
    const soloGrupos = { ...negocio, funciones: { promos: false, grupos: true } };
    expect(pedir({ negocio: soloGrupos, observaciones: [enviar("tarde", 0, "16:00"), grupo("dormidos")] })?.id).toBe("dormidos");
  });
});

describe("avisoDelDia: la frase larga", () => {
  it("acorta la observación y conserva la coletilla entera", () => {
    const larga = "Las tardes de martes viene bastante menos gente que el resto de la semana y conviene darles un empujón a tus clientes habituales.";
    const a = pedir({ observaciones: [enviar("tarde", 0, "16:00", larga)] });
    expect(a.texto.length).toBeLessThanOrEqual(110);
    expect(a.texto).toContain("…");
    expect(a.texto.endsWith("Te hemos preparado un aviso para hoy a las 16:00.")).toBe(true);
  });
});

describe("avisoDelDia: texto largo y horas raras", () => {
  const larga = "Las tardes de martes viene bastante menos gente de la que te conviene para cubrir gastos fijos.";

  it("al acortar no tira una palabra que estaba entera ni corta una a medias", () => {
    const a = pedir({ observaciones: [enviar("tarde", 0, "16:00", larga)] });
    const frase = a.texto.split("… Te hemos")[0];
    expect(a.texto.length).toBeLessThanOrEqual(110);
    expect(a.texto).toMatch(/… Te hemos preparado un aviso para hoy a las 16:00\.$/);
    for (const palabra of frase.split(" ")) expect(larga.split(" ")).toContain(palabra);
  });

  it("si la última palabra cabe justo, se queda", () => {
    const cola = " Te hemos preparado un aviso para ellos.";
    const sitio = 110 - cola.length - 1;
    // El hueco es de sitio - 1 letras (ahí va la «…»): «entera» acaba justo en el corte.
    const frase = `${"a".repeat(sitio - 1 - 7)} entera ${"b".repeat(20)}`;
    const a = pedir({ observaciones: [grupo("g", frase)] });
    expect(a.texto.split("…")[0].endsWith("entera")).toBe(true);
  });

  it("una hora que no se entiende («24:00») no vale hoy", () => {
    expect(pedir({ observaciones: [enviar("raro", 0, "24:00")] })).toBeNull();
    expect(pedir({ observaciones: [enviar("raro", undefined, "24:00")] })).toBeNull();
  });
});
