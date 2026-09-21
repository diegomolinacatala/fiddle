import { describe, it, expect } from "vitest";
import {
  perfilDe, estadoDe, GRUPOS, gruposDe, conteoGrupos, esGrupo,
  metricas, tendencia, serieVisitas, rejillaHoraria, cohortes, efectoCampana,
  haceTexto, cadenciaTexto, TIPOS_VISITA, UMBRALES, LISTA_GRUPOS,
} from "@/lib/crm";

// Un "ahora" fijo: los perfiles se miden en días y un test que dependa del
// reloj real falla solo el día que alguien lo ejecute a las 23:59.
const AHORA = Date.parse("2026-09-21T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const haceDias = (d) => new Date(AHORA - d * DIA).toISOString();

const NUBE = { slug: "nube", tipo: "sellos", meta: 8 };
const CUPON = { slug: "forno", tipo: "descuento", meta: 1 };

/** Cliente de mentira: alta hace `alta` días, `visitas` visitas, la última hace `ultima`. */
const cli = ({ serial = "s1", alta = 60, ultima = 0, visitas = 5, sellos = 3, premios = 0, instalado = true, ...resto } = {}) => ({
  serial,
  creado: haceDias(alta),
  ultima_visita: visitas ? haceDias(ultima) : null,
  visitas,
  sellos,
  premios,
  instalado: instalado ? haceDias(alta) : null,
  desinstalado: null,
  ...resto,
});

describe("perfilDe", () => {
  it("la cadencia es el hueco medio entre visitas", () => {
    // Alta hace 40 días, 5 visitas, la última ayer: 4 huecos en 39 días.
    const p = perfilDe(cli({ alta: 40, ultima: 1, visitas: 5 }), NUBE, AHORA);
    expect(p.cadencia).toBeCloseTo(39 / 4, 5);
    expect(p.diasSinVenir).toBeCloseTo(1, 5);
    expect(p.retraso).toBeCloseTo(1 / (39 / 4), 5);
  });

  it("con una visita o ninguna no hay ritmo que medir", () => {
    expect(perfilDe(cli({ visitas: 1, ultima: 3 }), NUBE, AHORA).cadencia).toBeNull();
    expect(perfilDe(cli({ visitas: 0 }), NUBE, AHORA).cadencia).toBeNull();
  });

  it("sin visitas, el reloj corre desde el alta", () => {
    // Un pase emitido hace un año y nunca usado lleva un año sin usarse.
    const p = perfilDe(cli({ alta: 365, visitas: 0 }), NUBE, AHORA);
    expect(p.diasSinVenir).toBeCloseTo(365, 0);
    expect(p.estado).toBe("fantasma");
  });

  it("cuenta lo que falta para el premio, y en los cupones no aplica", () => {
    expect(perfilDe(cli({ sellos: 6 }), NUBE, AHORA)).toMatchObject({ faltan: 2, completa: false });
    expect(perfilDe(cli({ sellos: 8 }), NUBE, AHORA)).toMatchObject({ faltan: 0, completa: true });
    expect(perfilDe(cli({ sellos: 99 }), NUBE, AHORA).faltan).toBe(0);
    expect(perfilDe(cli({ sellos: 0 }), CUPON, AHORA)).toMatchObject({ esCupon: true, completa: false, faltan: 0 });
  });

  it("solo es contactable quien tiene el pase puesto ahora mismo", () => {
    expect(perfilDe(cli(), NUBE, AHORA).contactable).toBe(true);
    expect(perfilDe(cli({ instalado: false }), NUBE, AHORA).contactable).toBe(false);
    expect(perfilDe(cli({ desinstalado: haceDias(2) }), NUBE, AHORA)).toMatchObject({
      instalado: true,      // lo tuvo
      contactable: false,   // pero lo borró
    });
  });
});

describe("estadoDe: la escalera", () => {
  const estado = (c) => perfilDe(cli(c), NUBE, AHORA).estado;

  it("quien se llevó el pase y no lo usó nunca es un fantasma", () => {
    expect(estado({ visitas: 0, alta: 3 })).toBe("fantasma");
  });

  it("al recién llegado no se le exige ritmo todavía", () => {
    expect(estado({ alta: 5, visitas: 1, ultima: 5 })).toBe("nuevo");
    // Pasados 30 días, o con costumbre ya hecha, deja de ser nuevo.
    expect(estado({ alta: 40, visitas: 1, ultima: 40 })).not.toBe("nuevo");
    expect(estado({ alta: 5, visitas: 4, ultima: 0 })).toBe("activo");
  });

  it("el retraso es contra el ritmo de cada uno, no contra un calendario", () => {
    // Viene cada 2 días y lleva 10 sin aparecer: se está enfriando.
    expect(estado({ alta: 20, visitas: 11, ultima: 10 })).toBe("riesgo");
    // Viene cada 30 días y lleva 10: va en fecha.
    expect(estado({ alta: 90, visitas: 4, ultima: 10 })).toBe("activo");
  });

  it("el tiempo largo manda sobre el ritmo", () => {
    expect(estado({ alta: 400, visitas: 10, ultima: 70 })).toBe("dormido");
    expect(estado({ alta: 400, visitas: 10, ultima: 200 })).toBe("perdido");
  });

  it("sin ritmo conocido vale el mes de gracia", () => {
    expect(estadoDe({ visitas: 1, diasDesdeAlta: 200, diasSinVenir: 10, retraso: null })).toBe("activo");
    expect(estadoDe({ visitas: 1, diasDesdeAlta: 200, diasSinVenir: 45, retraso: null })).toBe("riesgo");
  });
});

describe("grupos", () => {
  it("todos los grupos del catálogo están declarados con su idea", () => {
    for (const g of LISTA_GRUPOS) {
      expect(typeof GRUPOS[g.key].incluye).toBe("function");
      expect(g.idea.length).toBeGreaterThan(0);
    }
    expect(esGrupo("riesgo")).toBe(true);
    expect(esGrupo("inventado")).toBe(false);
    expect(esGrupo("toString")).toBe(false); // nada de heredados del prototipo
  });

  it("a_punto son los que tienen el premio al alcance", () => {
    const dentro = perfilDe(cli({ sellos: 7 }), NUBE, AHORA);   // falta 1
    const lejos = perfilDe(cli({ sellos: 2 }), NUBE, AHORA);    // faltan 6
    const lleno = perfilDe(cli({ sellos: 8 }), NUBE, AHORA);    // ya está
    expect(GRUPOS.a_punto.incluye(dentro)).toBe(true);
    expect(GRUPOS.a_punto.incluye(lejos)).toBe(false);
    expect(GRUPOS.a_punto.incluye(lleno)).toBe(false);
    expect(GRUPOS.premio_listo.incluye(lleno)).toBe(true);
  });

  it("fieles_frios: los que venían mucho y desaparecieron", () => {
    // 8 visitas, ritmo de ~3 días, lleva 40 sin venir.
    const fiel = perfilDe(cli({ alta: 61, visitas: 8, ultima: 40 }), NUBE, AHORA);
    expect(fiel.visitas).toBeGreaterThanOrEqual(UMBRALES.fielVisitas);
    expect(GRUPOS.fieles_frios.incluye(fiel)).toBe(true);

    // Dos visitas sueltas y otros tantos meses fuera: se fue, pero nunca fue de casa.
    const flojo = perfilDe(cli({ alta: 100, visitas: 2, ultima: 80 }), NUBE, AHORA);
    expect(GRUPOS.fieles_frios.incluye(flojo)).toBe(false);
    expect(GRUPOS.dormidos.incluye(flojo)).toBe(true);
  });

  it("un cliente puede estar en varios grupos a la vez", () => {
    // A un sello del premio Y enfriándose: las dos cosas son ciertas.
    const p = perfilDe(cli({ alta: 30, visitas: 11, ultima: 15, sellos: 7 }), NUBE, AHORA);
    const suyos = gruposDe(p);
    expect(suyos).toContain("a_punto");
    expect(suyos).toContain("riesgo");
  });

  it("el conteo separa a quién se le puede avisar de verdad", () => {
    const perfiles = [
      perfilDe(cli({ serial: "a", sellos: 7 }), NUBE, AHORA),
      perfilDe(cli({ serial: "b", sellos: 7, instalado: false }), NUBE, AHORA),
    ];
    const aPunto = conteoGrupos(perfiles).find((g) => g.key === "a_punto");
    expect(aPunto).toMatchObject({ total: 2, contactables: 1, label: GRUPOS.a_punto.label });
  });
});

describe("métricas", () => {
  const clientes = [
    cli({ serial: "a", alta: 3, visitas: 1, ultima: 3 }),          // nuevo
    cli({ serial: "b", alta: 90, visitas: 20, ultima: 1 }),        // activo
    cli({ serial: "c", alta: 90, visitas: 6, ultima: 60, premios: 2 }), // frío
    cli({ serial: "d", alta: 200, visitas: 0, instalado: false }), // fantasma sin instalar
  ];
  const eventos = [
    { serial: "b", tipo: "sellar", ts: haceDias(1) },
    { serial: "b", tipo: "sellar", ts: haceDias(10) },
    { serial: "b", tipo: "restar", ts: haceDias(10) },   // corrección: no es visita
    { serial: "c", tipo: "canjear", ts: haceDias(45) },  // fuera de los 30
  ];
  const perfiles = clientes.map((c) => perfilDe(c, NUBE, AHORA));
  const m = metricas(perfiles, eventos, clientes, AHORA);

  it("cuenta visitas por ventana y no cuela las correcciones", () => {
    expect(m.visitas30).toBe(2);
    expect(m.total).toBe(4);
  });

  it("mide el embudo de instalación y la vuelta", () => {
    expect(m.instalados).toBe(3);
    expect(m.tasaInstalacion).toBe(75);
    expect(m.repiten).toBe(2);      // b y c: `a` tiene una sola visita y `d` ninguna
    expect(m.tasaVuelta).toBe(50);
  });

  it("el reparto por estado suma el total", () => {
    expect(Object.values(m.porEstado).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("la tendencia aguanta el mes sin nada detrás", () => {
    expect(tendencia(10, 5)).toBe(100);
    expect(tendencia(5, 10)).toBe(-50);
    expect(tendencia(5, 0)).toBeNull();
  });
});

describe("series y rejilla", () => {
  it("la serie no deja huecos: los días sin visitas valen cero", () => {
    const s = serieVisitas([{ serial: "a", tipo: "sellar", ts: haceDias(2) }], 7, AHORA);
    expect(s).toHaveLength(7);
    expect(s.reduce((a, d) => a + d.n, 0)).toBe(1);
    expect(s.at(-1).dia).toBe(new Date(AHORA).toISOString().slice(0, 10));
  });

  it("la rejilla es 7 × 24 y solo cuenta visitas", () => {
    const r = rejillaHoraria([
      { tipo: "sellar", ts: "2026-09-21T09:30:00.000Z" },
      { tipo: "restar", ts: "2026-09-21T09:30:00.000Z" },
    ]);
    expect(r).toHaveLength(7);
    expect(r[0]).toHaveLength(24);
    expect(r.flat().reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("TIPOS_VISITA deja fuera la corrección a propósito", () => {
    expect(TIPOS_VISITA).toContain("sellar");
    expect(TIPOS_VISITA).not.toContain("restar");
  });
});

describe("cohortes y campañas", () => {
  it("agrupa por mes de alta y mide cuántos siguen vivos", () => {
    const clientes = [
      cli({ serial: "a", alta: 10, visitas: 4, ultima: 1 }),
      cli({ serial: "b", alta: 12, visitas: 1, ultima: 12 }),
      cli({ serial: "c", alta: 100, visitas: 2, ultima: 95 }),
    ];
    const perfiles = clientes.map((c) => perfilDe(c, NUBE, AHORA));
    const co = cohortes(clientes, perfiles, 6, AHORA);
    expect(co.length).toBeGreaterThanOrEqual(2);
    const ultima = co.at(-1);
    expect(ultima.altas).toBe(2);
    expect(ultima.retencion).toBeGreaterThan(0);
  });

  it("efectoCampana solo cuenta a los avisados que volvieron DESPUÉS", () => {
    const campana = { seriales: ["a", "b"], creado: haceDias(10) };
    const eventos = [
      { serial: "a", tipo: "sellar", ts: haceDias(5) },   // volvió
      { serial: "a", tipo: "sellar", ts: haceDias(2) },   // y otra vez: cuenta una
      { serial: "b", tipo: "sellar", ts: haceDias(20) },  // antes del envío
      { serial: "z", tipo: "sellar", ts: haceDias(1) },   // no iba en la campaña
    ];
    expect(efectoCampana(campana, eventos)).toEqual({ volvieron: 1, tasa: 50 });
    expect(efectoCampana({ seriales: [], creado: haceDias(1) }, eventos)).toEqual({ volvieron: 0, tasa: 0 });
  });
});

describe("textos", () => {
  it("haceTexto habla como una persona", () => {
    expect(haceTexto(null)).toBe("nunca");
    expect(haceTexto(0)).toBe("hoy");
    expect(haceTexto(1)).toBe("ayer");
    expect(haceTexto(5)).toBe("hace 5 días");
    expect(haceTexto(45)).toBe("hace un mes");
    expect(haceTexto(120)).toBe("hace 4 meses");
    expect(haceTexto(500)).toBe("hace más de un año");
  });

  it("cadenciaTexto redondea a la unidad que se entiende", () => {
    expect(cadenciaTexto(null)).toBe("—");
    expect(cadenciaTexto(1)).toBe("a diario");
    expect(cadenciaTexto(4)).toBe("cada 4 días");
    expect(cadenciaTexto(21)).toBe("cada 3 semanas");
    expect(cadenciaTexto(90)).toBe("cada 3 meses");
  });
});
