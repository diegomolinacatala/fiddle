import { describe, it, expect } from "vitest";
import {
  perfilDe, estadoDe, GRUPOS, gruposDe, conteoGrupos, esGrupo,
  metricas, cambio, serieVisitas, rejillaHoraria, cohortes, efectoCampana,
  haceTexto, cadenciaTexto, TIPOS_VISITA, UMBRALES, LISTA_GRUPOS, soloVisitas,
  esActivo, mediana, vueltaPronto, embudo, repartoCartillas,
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

  it("diez sellos en unos segundos no son un habitual que viene cada segundo", () => {
    // La tarjeta de prueba del amigo: alta y diez sellos de golpe, hace unas horas.
    const prueba = {
      serial: "amigo", creado: new Date(AHORA - 5 * 60 * 60 * 1000).toISOString(),
      ultima_visita: new Date(AHORA - 5 * 60 * 60 * 1000 + 30_000).toISOString(),
      visitas: 10, sellos: 8, premios: 0, instalado: haceDias(0),
    };
    const p = perfilDe(prueba, NUBE, AHORA);
    expect(p.visitas).toBe(1);
    expect(p.cadencia).toBeNull();
    expect(p.estado).toBe("nuevo");
    expect(gruposDe(p)).not.toContain("fieles_frios");
    expect(gruposDe(p)).not.toContain("riesgo");
  });

  it("el ritmo más rápido es a diario, y nadie está en riesgo por faltar unos días", () => {
    // Doce visitas en tres días (dos al día): ritmo diario, no cada pocas horas.
    const p = perfilDe(cli({ alta: 6, ultima: 3, visitas: 12 }), NUBE, AHORA);
    expect(p.cadencia).toBe(UMBRALES.cadenciaMin);
    expect(p.estado).toBe("activo"); // 3 días sin venir: un puente, no una huida
    expect(perfilDe(cli({ alta: 12, ultima: 8, visitas: 8 }), NUBE, AHORA).estado).toBe("riesgo");
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

  it("quien ni lo guardó ni lo usó no es un cliente: descartada (pasado un día)", () => {
    expect(estado({ visitas: 0, alta: 3, instalado: false })).toBe("descartada");
    expect(estado({ visitas: 0, alta: 0.2, instalado: false })).toBe("fantasma"); // aún puede estar guardándolo
    expect(estado({ visitas: 2, alta: 3, ultima: 1, instalado: false })).not.toBe("descartada"); // la usa sin Wallet (Android)
    const p = perfilDe(cli({ visitas: 0, alta: 3, instalado: false }), NUBE, AHORA);
    expect(GRUPOS.fantasmas.incluye(p)).toBe(false); // no hay a quién escribir
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
    cli({ serial: "d", alta: 200, visitas: 0, instalado: false }), // ni guardada ni usada: no cuenta
    cli({ serial: "e", alta: 40, visitas: 3, ultima: 5, instalado: false }), // la usa sin Wallet
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

  it("las tarjetas descartadas van aparte y no hunden las tasas", () => {
    expect(m.descartadas).toBe(1);
    expect(m.nuevos30).toBe(1); // `a`; `d` es de hace 200 días, pero tampoco contaría
  });

  it("mide el embudo de instalación y la vuelta", () => {
    expect(m.instalados).toBe(3);
    expect(m.tasaInstalacion).toBe(75);
    expect(m.repiten).toBe(3);      // b, c y e: `a` tiene una sola visita
    expect(m.tasaVuelta).toBe(75);
  });

  it("el reparto por estado suma el total, sin las descartadas", () => {
    expect(Object.values(m.porEstado).reduce((a, b) => a + b, 0)).toBe(4);
    expect(m.porEstado.descartada).toBeUndefined();
  });

  it("«Activos» son los que siguen viniendo: a su ritmo y los recién llegados", () => {
    // `a` es nuevo, `b` y `e` van a su ritmo, `c` se enfrió.
    expect(m.activos).toBe(3);
    expect(m.activos).toBe(m.porEstado.activo + m.porEstado.nuevo);
    expect(perfiles.filter((p) => !p.descartada && esActivo(p)).map((p) => p.serial)).toEqual(["a", "b", "e"]);
  });

  it("ritmo y visitas por cliente con la mediana, no con la media", () => {
    expect(mediana([1, 2, 30])).toBe(2);
    expect(mediana([1, 2, 3, 30])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(m.visitasHabituales).toBe(4.5); // 1, 3, 6 y 20
  });

  it("sin dos meses de tienda no hay mes anterior con el que comparar", () => {
    // La primera tarjeta es de hace 200 días: sí se compara.
    expect(m.visitas30Previas).toBe(1); // el canje de hace 45 días
    expect(m.nuevos30Previos).toBe(1);  // `e`, de hace 40
    const jovenes = [cli({ serial: "j", alta: 40, visitas: 3, ultima: 2 })];
    const mj = metricas(jovenes.map((c) => perfilDe(c, NUBE, AHORA)), eventos, jovenes, AHORA);
    expect(mj.visitas30Previas).toBeNull();
    expect(mj.nuevos30Previos).toBeNull();
    // Y si el historial que llega empieza hace un mes (el tope), las visitas tampoco.
    const mt = metricas(perfiles, eventos, clientes, AHORA, { historialDesde: AHORA - 30 * DIA });
    expect(mt.visitas30Previas).toBeNull();
    expect(mt.nuevos30Previos).toBe(1);
  });

  it("la flecha da % solo con base suficiente; si no, unidades", () => {
    expect(cambio(30, 20)).toEqual({ pct: 50 });
    expect(cambio(10, 40)).toEqual({ pct: -75 });
    expect(cambio(4, 2)).toEqual({ unidades: 2 }); // nada de «+100 %»
    expect(cambio(3, 0)).toEqual({ unidades: 3 });
    expect(cambio(5, null)).toBeNull();
  });
});

describe("el camino de la tarjeta", () => {
  const ev = (serial, dias, tipo = "sellar") => ({ serial, tipo, ts: haceDias(dias) });

  it("vueltaPronto: de los que estrenaron hace más de 14 días, cuántos volvieron en 14", () => {
    const clientes = ["a", "b", "c", "d", "e", "f", "g"].map((serial) => cli({ serial, alta: 50 }));
    const eventos = [
      ev("z", 60),                 // el historial empieza aquí
      ev("a", 40), ev("a", 35),    // volvió a los 5 días
      ev("b", 40), ev("b", 20),    // volvió, pero a los 20: no cuenta
      ev("c", 30), ev("c", 29.5),  // a las 12 horas: otra visita
      ev("d", 30),                 // no volvió
      ev("e", 25), ev("e", 25.01), // dos sellos de golpe: una visita, no volvió
      ev("f", 20), ev("f", 10),
      ev("g", 5), ev("g", 2),      // estrenó hace 5 días: aún no se le puede medir
    ];
    expect(vueltaPronto(clientes, eventos, { ahora: AHORA })).toEqual({ base: 6, volvieron: 3, tasa: 50, dias: 14 });
  });

  it("vueltaPronto no cuenta a quien se dio de alta antes del historial que llega", () => {
    const clientes = [cli({ serial: "viejo", alta: 300 }), cli({ serial: "a", alta: 40 })];
    const v = vueltaPronto(clientes, [ev("viejo", 40), ev("viejo", 38), ev("a", 40)], { ahora: AHORA });
    expect(v.base).toBe(1);
    expect(v.tasa).toBeNull(); // menos estrenos que vueltaMinBase
  });

  it("el embudo baja escalón a escalón y empieza en todas las tarjetas", () => {
    const clientes = [
      cli({ serial: "d", alta: 10, visitas: 0, instalado: false }),                   // descartada
      cli({ serial: "f", alta: 10, visitas: 0 }),                                     // sin uso
      cli({ serial: "u", alta: 10, visitas: 1, ultima: 10 }),                         // una visita
      cli({ serial: "r", alta: 30, visitas: 4, ultima: 1 }),                          // volvió
      cli({ serial: "g", alta: 60, visitas: 9, ultima: 1, sellos: 0, guardados: 1 }), // la llenó y lo guardó
      cli({ serial: "p", alta: 90, visitas: 12, ultima: 2, premios: 1 }),             // canjeó
      cli({ serial: "x", alta: 5, visitas: 1, ultima: 5, sellos: 8 }),                // llena de golpe, sin volver
    ];
    const e = embudo(clientes.map((c) => perfilDe(c, NUBE, AHORA)));
    expect(e.map((x) => [x.key, x.n])).toEqual([
      ["sacaron", 7], ["estrenaron", 5], ["volvieron", 3], ["llenaron", 2], ["canjearon", 1],
    ]);
    expect(e[0].paso).toBeNull();
    expect(e[2].paso).toBe(60);
  });

  it("en un cupón no hay cartilla: se estrena, se usa y luego se vuelve", () => {
    // Tres usan el cupón en su primera visita y no vuelven; uno vuelve.
    const clientes = [
      ...["a", "b", "c"].map((serial) => cli({ serial, alta: 10, visitas: 1, ultima: 10, premios: 1 })),
      cli({ serial: "d", alta: 30, visitas: 3, ultima: 2, premios: 1 }),
    ];
    const perfiles = clientes.map((c) => perfilDe(c, CUPON, AHORA));
    const e = embudo(perfiles);
    expect(e.map((x) => [x.key, x.n])).toEqual([["sacaron", 4], ["estrenaron", 4], ["canjearon", 4], ["volvieron", 1]]);
    expect(e[2].label).toBe("Usaron el cupón");
    // Cuadra con la cifra de «Cupones usados».
    expect(metricas(perfiles, [], clientes, AHORA).premios).toBe(e[2].n);
  });

  it("premios por dar: los guardados y las cartillas llenas, de las dos cartillas", () => {
    const DOS = { ...NUBE, cartillas: [{ nombre: "Cafés", meta: 8, premio: "Café" }, { nombre: "Cookies", meta: 5, premio: "Cookie" }] };
    const p = perfilDe(cli({ sellos: 8, sellos2: 5, guardados: 1, guardados2: 2 }), DOS, AHORA);
    expect(p.porDar).toBe(5);
    expect(perfilDe(cli({ sellos: 3 }), NUBE, AHORA).porDar).toBe(0);
    expect(perfilDe(cli({ premios: 1 }), CUPON, AHORA).porDar).toBe(0);
    const m = metricas([p, perfilDe(cli({ serial: "s2", sellos: 8 }), DOS, AHORA)], [], [], AHORA);
    expect(m.porDar).toBe(6);
  });

  it("repartoCartillas cuenta dónde está cada uno, separando a los que se alejan", () => {
    const clientes = [
      cli({ serial: "a", alta: 90, visitas: 6, ultima: 1, sellos: 2 }),  // sigue viniendo
      cli({ serial: "b", alta: 90, visitas: 6, ultima: 80, sellos: 2 }), // se aleja
      cli({ serial: "c", alta: 90, visitas: 6, ultima: 80, sellos: 1 }),
      cli({ serial: "d", alta: 90, visitas: 3, ultima: 1, sellos: 0 }),  // a cero
      cli({ serial: "e", alta: 10, visitas: 0, sellos: 0 }),             // sin visitas: fuera
    ];
    const perfiles = clientes.map((c) => perfilDe(c, NUBE, AHORA));
    const [r] = repartoCartillas(clientes, perfiles, NUBE);
    expect(r.indice).toBe(0);
    expect(r.meta).toBe(8);
    expect(r.filas).toHaveLength(8);
    expect(r.filas[0]).toEqual({ sellos: 1, siguen: 0, alejan: 1 });
    expect(r.filas[1]).toEqual({ sellos: 2, siguen: 1, alejan: 1 });
    expect(r.enCero).toBe(1);
    expect(r.alejanMediana).toBeNull(); // dos que se alejan: pocos para decir nada
    expect(repartoCartillas(clientes, perfiles, CUPON)).toEqual([]);
  });
});

describe("series y rejilla", () => {
  it("la serie no deja huecos: los días sin visitas valen cero", () => {
    const s = serieVisitas([{ serial: "a", tipo: "sellar", ts: haceDias(2) }], 7, AHORA);
    expect(s).toHaveLength(7);
    expect(s.reduce((a, d) => a + d.n, 0)).toBe(1);
    expect(s.at(-1).dia).toBe(new Date(AHORA).toISOString().slice(0, 10));
  });

  it("la serie cuenta el día de la tienda y marca los que cerró", () => {
    // Las 00:30 del 21 en Madrid son las 22:30 UTC del 20: es visita del 21.
    const horario = { zona: "Europe/Madrid", semana: [null, ...Array(6).fill([{ abre: "08:00", cierra: "20:00" }])] };
    const s = serieVisitas([{ serial: "a", tipo: "sellar", ts: "2026-09-20T22:30:00.000Z" }], 7, AHORA, horario);
    expect(s.find((d) => d.dia === "2026-09-21").n).toBe(1);
    expect(s.find((d) => d.dia === "2026-09-20").n).toBe(0);
    // El 21-09-2026 es lunes, y los lunes cierra.
    expect(s.find((d) => d.dia === "2026-09-21").cerrado).toBe(true);
    expect(s.find((d) => d.dia === "2026-09-20").cerrado).toBe(false);
    expect(serieVisitas([], 3, AHORA).every((d) => d.cerrado === false)).toBe(true);
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

describe("el Resumen cuenta visitas, no sellos", () => {
  const ev = (serial, ts, tipo = "sellar") => ({ serial, tipo, ts });
  // Siete cafés de golpe (traía la cartilla de papel) y, al día siguiente, otro.
  const eventos = [
    ...Array.from({ length: 7 }, (_, i) => ev("a", `2026-10-07T08:00:${String(i).padStart(2, "0")}Z`)),
    ev("a", "2026-10-07T08:05:00Z", "canjear"),
    ev("a", "2026-10-08T08:00:00Z"),
    ev("b", "2026-10-07T08:00:30Z"), // otra tarjeta a la vez: otra visita
    ev("a", "2026-10-07T09:00:00Z", "restar"), // una corrección no es visita
  ];
  it("soloVisitas junta lo de la misma tarjeta a menos de horasVisita", () => {
    expect(soloVisitas(eventos).map((e) => `${e.serial} ${e.ts}`)).toEqual([
      "a 2026-10-07T08:00:00Z", "b 2026-10-07T08:00:30Z", "a 2026-10-08T08:00:00Z",
    ]);
  });
  it("la serie de 30 días y la rejilla usan esa cuenta", () => {
    const serie = serieVisitas(eventos, 30, Date.parse("2026-10-08T12:00:00Z"));
    expect(serie.find((d) => d.dia === "2026-10-07").n).toBe(2);
    expect(rejillaHoraria(eventos).flat().reduce((a, b) => a + b, 0)).toBe(3);
  });
});
