import { describe, it, expect } from "vitest";
import {
  perfilDe, estadoDe, GRUPOS, gruposDe, conteoGrupos, esGrupo,
  metricas, cambio, serieVisitas, rejillaHoraria, efectoCampana,
  haceTexto, cadenciaTexto, TIPOS_VISITA, UMBRALES, LISTA_GRUPOS, soloVisitas,
  esActivo, mediana, curvaDeVuelta, embudo, repartoCartillas, puenteActivos, resumenSerie, horarioDeRejilla,
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

  it("con dos cartillas, cerca del premio y premio pendiente miran las dos", () => {
    // La Delicantería: cookies y cafés. Antes solo contaba la primera (las cookies).
    const DOS = { ...NUBE, cartillas: [{ nombre: "Cookies", meta: 8, premio: "Cookie" }, { nombre: "Cafés", meta: 8, premio: "Café" }] };
    const cafeCerca = perfilDe(cli({ sellos: 1, sellos2: 7 }), DOS, AHORA);
    expect(cafeCerca.faltan).toBe(1);
    expect(GRUPOS.a_punto.incluye(cafeCerca)).toBe(true);
    // Un café guardado es un premio por recoger, aunque las dos cartillas vayan a medias.
    const guardado = perfilDe(cli({ sellos: 2, sellos2: 3, guardados2: 1 }), DOS, AHORA);
    expect(GRUPOS.premio_listo.incluye(guardado)).toBe(true);
    expect(GRUPOS.a_punto.incluye(guardado)).toBe(false);
    // Una llena y la otra a un punto: las dos cosas a la vez.
    const ambas = perfilDe(cli({ sellos: 8, sellos2: 7 }), DOS, AHORA);
    expect(gruposDe(ambas)).toEqual(expect.arrayContaining(["a_punto", "premio_listo"]));
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

  it("el ritmo del cliente típico va con la mediana, no con la media", () => {
    expect(mediana([1, 2, 30])).toBe(2);
    expect(mediana([1, 2, 3, 30])).toBe(2.5);
    expect(mediana([])).toBeNull();
    // b viene cada ~4,7 días, e cada ~17,5 y c cada ~6: la de en medio.
    expect(m.cadenciaHabitual).toBeCloseTo(30 / 5, 5);
  });

  it("sabe desde cuándo hay tarjetas y a cuántos se les debe un premio", () => {
    expect(m.inicio).toBe(Date.parse(haceDias(200)));
    expect(m.conPremio).toBe(0);
    const conGuardado = [cli({ serial: "g", guardados: 2 }), cli({ serial: "h" })];
    const mg = metricas(conGuardado.map((c) => perfilDe(c, NUBE, AHORA)), [], conGuardado, AHORA);
    expect(mg).toMatchObject({ porDar: 2, conPremio: 1 });
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

  const HISTORIAL = { ahora: AHORA, historialDesde: AHORA - 120 * DIA };
  /** Clientes de alta hace `alta` días que la estrenan ese día y vuelven a los `vuelve` días (o nunca). */
  const estrenos = (prefijo, cuantos, alta, vuelve = null) => Array.from({ length: cuantos }, (_, i) => {
    const serial = `${prefijo}${i}`;
    return { cliente: cli({ serial, alta }), eventos: [ev(serial, alta), ...(vuelve === null ? [] : [ev(serial, alta - vuelve)])] };
  });
  const juntar = (...grupos) => ({ clientes: grupos.flat().map((x) => x.cliente), eventos: grupos.flat().flatMap((x) => x.eventos) });

  it("la curva de vuelta: qué parte ha vuelto a los N días de estrenarla", () => {
    // Diez que la estrenaron hace 20 días: 4 vuelven a los 2 días, 2 a los 10 y 4 nunca.
    const { clientes, eventos } = juntar(estrenos("a", 4, 20, 2), estrenos("b", 2, 20, 10), estrenos("c", 4, 20));
    const v = curvaDeVuelta(clientes, eventos, HISTORIAL);
    expect(v).toMatchObject({ listo: true, base: 10, faltanDias: null });
    expect(v.puntos[0]).toEqual({ dia: 0, pct: 0, seguidos: 10 });
    expect(v.puntos[7].pct).toBe(40);
    expect(v.puntos[14].pct).toBe(60);
    // Se corta cuando ya no queda nadie seguido tanto tiempo: el día 20.
    expect(v.puntos.at(-1).dia).toBe(20);
  });

  it("quien la estrenó ayer no hunde la curva: aún no ha tenido tiempo de volver", () => {
    // Cinco de hace 20 días (3 vuelven a los 2) y cinco de ayer. Contando a secas
    // saldría «han vuelto 3 de 10»; a la semana, de los que se ha podido ver, 3 de 5.
    const { clientes, eventos } = juntar(estrenos("v", 3, 20, 2), estrenos("n", 2, 20), estrenos("j", 5, 1));
    const v = curvaDeVuelta(clientes, eventos, HISTORIAL);
    expect(v.base).toBe(10);
    expect(v.puntos[7].pct).toBe(60);
  });

  it("sin una semana de cinco estrenos no sale, y dice cuándo saldrá", () => {
    const { clientes, eventos } = juntar(estrenos("a", 6, 3, 1));
    const v = curvaDeVuelta(clientes, eventos, HISTORIAL);
    expect(v.listo).toBe(false);
    expect(v.faltanDias).toBe(4);
    const pocos = juntar(estrenos("b", 3, 30, 2));
    expect(curvaDeVuelta(pocos.clientes, pocos.eventos, HISTORIAL)).toMatchObject({ listo: false, faltanDias: null });
  });

  it("la cola se corta cuando quedan pocos seguidos: uno solo no la lleva al 100 %", () => {
    // 20 estrenos: 15 de ayer y 5 de hace 12 días (4 vuelven a los 2). A los 8 días
    // solo se sigue a esos 5, la cuarta parte: menos del 40 %, la curva no llega.
    const { clientes, eventos } = juntar(estrenos("j", 15, 1), estrenos("v", 4, 12, 2), estrenos("n", 1, 12, 9));
    const v = curvaDeVuelta(clientes, eventos, HISTORIAL);
    expect(v.puntos.at(-1).dia).toBe(1);
    expect(v.listo).toBe(false);
    expect(v.faltanDias).toBe(6); // cuando los de ayer (el 8.º más antiguo) lleven una semana
  });

  it("no cuenta a quien se dio de alta antes del historial que llega", () => {
    const viejo = cli({ serial: "viejo", alta: 300 });
    const { clientes, eventos } = juntar(estrenos("a", 5, 20, 3));
    const v = curvaDeVuelta([...clientes, viejo], [...eventos, ev("viejo", 20), ev("viejo", 19)], HISTORIAL);
    expect(v.base).toBe(5);
    expect(v.puntos[7].pct).toBe(100);
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
    const perfiles = clientes.map((c) => perfilDe(c, NUBE, AHORA));
    const e = embudo(perfiles);
    expect(e.map((x) => [x.key, x.n])).toEqual([
      ["sacaron", 7], ["quedaron", 6], ["estrenaron", 5], ["volvieron", 3], ["llenaron", 2], ["canjearon", 1],
    ]);
    expect(e[0].paso).toBeNull();
    expect(e[3].paso).toBe(60);
    // «60 % de los que la estrenaron»: cada escalón dice de quién sale el siguiente.
    expect(e[2].de).toBe("la estrenaron");
    // «Se la quedaron» es la cifra de «Clientes».
    expect(e[1].n).toBe(metricas(perfiles, [], clientes, AHORA).total);
  });

  it("en un cupón no hay cartilla: se estrena, se usa y luego se vuelve", () => {
    // Tres usan el cupón en su primera visita y no vuelven; uno vuelve.
    const clientes = [
      ...["a", "b", "c"].map((serial) => cli({ serial, alta: 10, visitas: 1, ultima: 10, premios: 1 })),
      cli({ serial: "d", alta: 30, visitas: 3, ultima: 2, premios: 1 }),
    ];
    const perfiles = clientes.map((c) => perfilDe(c, CUPON, AHORA));
    const e = embudo(perfiles);
    expect(e.map((x) => [x.key, x.n])).toEqual([["sacaron", 4], ["quedaron", 4], ["estrenaron", 4], ["canjearon", 4], ["volvieron", 1]]);
    expect(e[3].label).toBe("Usaron el cupón");
    // Cuadra con la cifra de «Cupones usados».
    expect(metricas(perfiles, [], clientes, AHORA).premios).toBe(e[3].n);
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
    expect(r.conPuntos).toBe(3);
    expect(r.alejanMediana).toBeNull(); // dos que se alejan: pocos para decir nada
    expect(r.mitad).toBeNull();         // tres con puntos: tampoco
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

  it("la serie empieza el día de la primera tarjeta y marca hoy, que está a medias", () => {
    const s = serieVisitas([], 30, AHORA, null, { desde: Date.parse(haceDias(4)) });
    expect(s).toHaveLength(5);
    expect(s[0].dia).toBe(haceDias(4).slice(0, 10));
    expect(s.map((d) => d.hoy)).toEqual([false, false, false, false, true]);
  });

  it("la rejilla es 7 × 24, solo cuenta visitas y va con la hora de la tienda", () => {
    // Lunes 21-09 a las 09:30 UTC: las 11:30 en Madrid.
    const r = rejillaHoraria([
      { serial: "a", tipo: "sellar", ts: "2026-09-21T09:30:00.000Z" },
      { serial: "a", tipo: "restar", ts: "2026-09-21T09:30:00.000Z" },
    ], { horario: { zona: "Europe/Madrid", semana: Array(7).fill([{ abre: "08:00", cierra: "20:00" }]) }, ahora: AHORA + 2 * DIA });
    expect(r.visitas).toHaveLength(7);
    expect(r.visitas[0]).toHaveLength(24);
    expect(r.visitas.flat().reduce((a, b) => a + b, 0)).toBe(1);
    expect(r.visitas[0][11]).toBe(1);
  });

  it("la rejilla da la media de un día normal: el día que sale más veces no pesa más", () => {
    // Del lunes 07-09 al miércoles 23-09, sin contar hoy (jueves 24): tres lunes y dos viernes.
    // 6 visitas cada lunes y 6 cada viernes a las 10 de Madrid: la media es la misma.
    const madrid = { zona: "Europe/Madrid", semana: Array(7).fill([{ abre: "08:00", cierra: "20:00" }]) };
    const dia = (fecha) => Array.from({ length: 6 }, (_, i) => ({ serial: `${fecha}-${i}`, tipo: "sellar", ts: `${fecha}T08:15:00.000Z` }));
    const eventos = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-11", "2026-09-18"].flatMap(dia);
    const ahora = Date.parse("2026-09-24T12:00:00.000Z");
    const r = rejillaHoraria(eventos, { horario: madrid, ahora });
    expect(r.veces[0]).toBe(3);
    expect(r.veces[4]).toBe(2);
    expect(r.visitas[0][10]).toBe(18);
    expect(r.media[0][10]).toBe(6);
    expect(r.media[4][10]).toBe(6);
    // Un festivo no es un lunes visto.
    expect(rejillaHoraria(eventos, { horario: { ...madrid, cerrados: ["2026-09-14"] }, ahora }).veces[0]).toBe(2);
  });

  it("la media de la serie es la de los días que abrió, sin hoy ni los cerrados", () => {
    const serie = [
      { dia: "2026-09-18", n: 10, cerrado: false, hoy: false },
      { dia: "2026-09-19", n: 0, cerrado: true, hoy: false },   // cerrado: no baja la media
      { dia: "2026-09-20", n: 20, cerrado: false, hoy: false },
      { dia: "2026-09-21", n: 2, cerrado: false, hoy: true },    // a medias
    ];
    expect(resumenSerie(serie)).toEqual({ media: 15, mejor: serie[2], dias: 2 });
    expect(resumenSerie([serie[3]])).toEqual({ media: null, mejor: null, dias: 0 });
  });

  it("la rejilla enseña las horas que abre y sabe cuáles están cerradas", () => {
    // De lunes a viernes de 8 a 14 y de 17 a 20:30; el sábado de 9 a 14; el domingo cierra.
    const partido = [{ abre: "08:00", cierra: "14:00" }, { abre: "17:00", cierra: "20:30" }];
    const h = horarioDeRejilla({ zona: "Europe/Madrid", semana: [...Array(5).fill(partido), [{ abre: "09:00", cierra: "14:00" }], null] });
    expect(h.horas).toEqual([8, 21]);
    expect(h.cerrados).toEqual([6]);
    expect(h.abierta[0][15]).toBe(false); // el descanso
    expect(h.abierta[0][20]).toBe(true);  // de 20 a 20:30 abre
    expect(h.abierta[5][17]).toBe(false); // el sábado por la tarde
    expect(horarioDeRejilla(null)).toEqual({ horas: null, cerrados: [], abierta: null });
  });

  it("hoy no entra en la rejilla: aún no ha acabado", () => {
    const r = rejillaHoraria([{ serial: "a", tipo: "sellar", ts: new Date(AHORA - 60_000).toISOString() }], { ahora: AHORA });
    expect(r.visitas.flat().reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("TIPOS_VISITA deja fuera la corrección a propósito", () => {
    expect(TIPOS_VISITA).toContain("sellar");
    expect(TIPOS_VISITA).not.toContain("restar");
  });
});

describe("el puente de activos", () => {
  const VENTANA = 120 * DIA;
  /** Días atrás de `desde` a `hasta`, de `paso` en `paso`. */
  const cada = (desde, hasta, paso) => Array.from({ length: Math.floor((desde - hasta) / paso) + 1 }, (_, i) => desde - i * paso);
  /** Un cliente con sus visitas (días atrás) y los eventos que dejaron, solo los que caben en la ventana. */
  const con = (serial, alta, dias, resto = {}) => ({
    cliente: cli({ serial, alta, visitas: dias.length, ultima: Math.min(...dias), ...resto }),
    eventos: dias.map((d) => ({ serial, tipo: "sellar", ts: haceDias(d) })).filter((e) => Date.parse(e.ts) >= AHORA - VENTANA),
  });
  const casos = [
    con("sigue", 90, cada(90, 0, 5)),
    con("enfria", 90, cada(90, 35, 5)),                // venía cada 5 días y lleva 35 sin venir
    con("vuelve", 100, [...cada(100, 72, 7), 10, 5]),  // hace 30 días llevaba 42 fuera; ahora ha vuelto
    con("nuevo", 20, [20, 12]),                        // aún no existía
    con("estrena", 50, [8]),                           // la tenía sin estrenar: empieza, no vuelve
    con("dormido", 200, cada(200, 100, 10)),           // fuera entonces y ahora
    con("antiguo", 200, [...cada(200, 130, 10), 25, 20]), // su última de antes queda fuera del historial
    con("descartada", 60, [], { instalado: false }),
    con("sinUso", 10, []),
  ];
  const clientes = casos.map((c) => c.cliente);
  const eventos = casos.flatMap((c) => c.eventos);
  const perfiles = clientes.map((c) => perfilDe(c, NUBE, AHORA));
  const opciones = { ahora: AHORA, historialDesde: AHORA - VENTANA };

  it("los de hace 30 días, más nuevos y vueltos, menos enfriados, dan los de hoy", () => {
    const p = puenteActivos(clientes, perfiles, eventos, NUBE, opciones);
    expect(p).toMatchObject({ listo: true, dias: 30, antes: 2, nuevos: 2, volvieron: 2, enfriados: 1, hoy: 5, siguen: 1 });
    expect(p.antes + p.nuevos + p.volvieron - p.enfriados).toBe(p.hoy);
  });

  it("«hoy» es la cifra de Activos y se mide igual hace 30 días", () => {
    const p = puenteActivos(clientes, perfiles, eventos, NUBE, opciones);
    expect(p.hoy).toBe(metricas(perfiles, eventos, clientes, AHORA).activos);
    expect(perfiles.filter(esActivo).map((x) => x.serial).sort()).toEqual(["antiguo", "estrena", "nuevo", "sigue", "vuelve"]);
  });

  it("las barras flotan donde las deja la anterior", () => {
    const { pasos } = puenteActivos(clientes, perfiles, eventos, NUBE, opciones);
    expect(pasos.map((x) => [x.key, x.desde, x.hasta, x.signo])).toEqual([
      ["antes", 0, 2, 0], ["nuevos", 2, 4, 1], ["volvieron", 4, 6, 1], ["enfriados", 5, 6, -1], ["hoy", 0, 5, 0],
    ]);
  });

  it("sin historial que cubra hace 30 días (y dos meses más), no sale", () => {
    expect(puenteActivos(clientes, perfiles, eventos, NUBE, { ahora: AHORA, historialDesde: AHORA - 60 * DIA }))
      .toEqual({ dias: 30, listo: false, motivo: "historial" });
    expect(puenteActivos(clientes, perfiles, eventos, NUBE, { ahora: AHORA }).motivo).toBe("historial");
  });

  it("una tienda sin clientes de hace 30 días dice cuánto falta", () => {
    const jovenes = [con("a", 20, [20, 3]).cliente, con("b", 5, [5]).cliente];
    const pj = jovenes.map((c) => perfilDe(c, NUBE, AHORA));
    expect(puenteActivos(jovenes, pj, [], NUBE, opciones)).toEqual({ dias: 30, listo: false, motivo: "joven", faltanDias: 10 });
    expect(puenteActivos([], [], [], NUBE, opciones).faltanDias).toBe(30);
  });
});

describe("campañas", () => {

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
    expect(rejillaHoraria(eventos, { ahora: Date.parse("2026-10-09T12:00:00Z") }).visitas.flat().reduce((a, b) => a + b, 0)).toBe(3);
  });
});
