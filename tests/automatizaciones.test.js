import { describe, it, expect } from "vitest";
import {
  DISPAROS, LISTA_DISPAROS, PLANTILLAS, VARIABLES, renderTexto, variablesDesconocidas, contextoDe, enviosDe, conEnvio,
  elegibles, candidatos, momentoDelDia, tocaAhora, proximoEnvio, porRetirar, validarReglas, normalizarReglas,
  diasTexto, fraseRegla, reglaNueva, idNuevo, grupoDeRegla, reglaDeGrupo, etiquetaEnvio, normalizarPausa, VENTANA_MIN,
} from "@/lib/automatizaciones";
import { componerNegocio, SEMILLAS } from "@/lib/negocios";
import { perfilDe } from "@/lib/crm";
import { relojLocal } from "@/lib/horario";

const DIA = 24 * 60 * 60 * 1000;
const deli = componerNegocio("delicanteria", null);
const nube = componerNegocio("nube", null);
const regla = (id) => deli.automatizaciones.find((r) => r.id === id);

// Jueves 24-09-2026, 12:05 en Valencia.
const AHORA = Date.parse("2026-09-24T10:05:00Z");
const hace = (dias) => new Date(AHORA - dias * DIA).toISOString();

/** Un cliente con su contexto, como lo arma el motor. */
function ctx(datos = {}, negocio = deli, { fechas = new Set(), contactable = true } = {}) {
  const cliente = { serial: datos.serial || "s1", codigo: "K7M", sellos: 0, sellos2: 0, premios: 0, visitas: 0, creado: hace(60), ...datos };
  const perfil = { ...perfilDe({ ...cliente, instalado: cliente.creado }, negocio, AHORA), contactable };
  return contextoDe(cliente, perfil, negocio, { fechas, hoy: relojLocal(AHORA, negocio.horario?.zona).fecha });
}

describe("los avisos de partida de La Delicantería", () => {
  it("todos son válidos: caben en el pase y solo usan variables que existen", () => {
    expect(validarReglas(SEMILLAS.delicanteria.automatizaciones).error).toBeUndefined();
    expect(validarReglas(PLANTILLAS).error).toBeUndefined();
    expect(deli.automatizaciones.map((r) => r.id)).toEqual([
      "racha", "premio-pendiente", "a-un-paso", "te-echamos-de-menos", "segunda-visita", "sin-estrenar",
    ]);
  });

  it("vienen encendidos para que funcionen aunque nadie entre al panel", () => {
    expect(deli.automatizaciones.every((r) => r.activa)).toBe(true);
    // Una tienda cualquiera arranca con los de partida, y la racha (promete un regalo) apagada.
    expect(nube.automatizaciones.find((r) => r.id === "racha").activa).toBe(false);
  });

  it("lo guardado en la base manda sobre la semilla, incluso vacío", () => {
    const sinTocar = componerNegocio("delicanteria", { nombre: "La Delicantería", tipo: "sellos", config: {} });
    expect(sinTocar.horario.semana[6]).toBeNull();
    // Lo que sale en el pase no viene de la semilla si la tienda ya existe en la base:
    // desplegar una semilla nueva no puede cambiar las cartillas de una tienda de verdad.
    expect(sinTocar.cartillas).toBeNull();
    expect(deli.cartillas).toHaveLength(2); // sin fila (modo demo), sí
    const vaciado = componerNegocio("delicanteria", { config: { automatizaciones: [], horario: null } });
    expect(vaciado.automatizaciones).toEqual([]);
    expect(vaciado.horario).toBeNull();
  });
});

describe("el texto de cada uno", () => {
  it("rellena las variables", () => {
    expect(renderTexto("Estás a {faltan} de tu {premio}.", { faltan: "1 cookie", premio: "cookie gratis" }))
      .toBe("Estás a 1 cookie de tu cookie gratis.");
  });

  it("sin nombre la frase sigue bien escrita", () => {
    expect(renderTexto("{nombre}, te falta 1", { nombre: "" })).toBe("Te falta 1");
    expect(renderTexto("¡Hola {nombre}!", { nombre: "" })).toBe("¡Hola!");
    expect(renderTexto("Hola {nombre}, ¿vienes?", { nombre: "" })).toBe("Hola, ¿vienes?");
    expect(renderTexto("Hola {nombre}, ¿vienes?", { nombre: "Marta" })).toBe("Hola Marta, ¿vienes?");
  });

  it("nunca pasa de lo que cabe en el pase", () => {
    const largo = renderTexto("x".repeat(118) + " {tienda}", { tienda: "La Delicantería" });
    expect(largo.length).toBeLessThanOrEqual(120);
    expect(largo.endsWith("…")).toBe(true);
  });

  it("una variable mal escrita se ve (y se avisa al guardar)", () => {
    expect(renderTexto("Tu {premo}", {})).toBe("Tu {premo}");
    expect(variablesDesconocidas("Tu {premo} y {premio}")).toEqual(["premo"]);
  });

  it("con dos cartillas cuenta la que tiene más cerca, con su palabra", () => {
    const x = ctx({ sellos: 5, sellos2: 7, visitas: 12 });
    expect(x.cercana).toMatchObject({ nombre: "Cafés", faltan: 1 });
    expect(x.vars).toMatchObject({ faltan: "1 café", premio: "café gratis" });
    expect(ctx({ sellos: 6, sellos2: 2, visitas: 8 }).vars.faltan).toBe("2 cookies");
    expect(ctx({ sellos: 7, visitas: 7 }, nube).vars.faltan).toBe("1 sello");
  });

  it("con un premio pendiente, {premio} es ese", () => {
    expect(ctx({ sellos: 3, guardados2: 1, visitas: 12 }).vars.premio).toBe("café gratis");
  });
});

describe("a quién le llega", () => {
  const sinVenir = () => regla("te-echamos-de-menos");

  it("lleva 21 días sin venir: sí; 20, no; nunca vino, no", () => {
    const lista = [
      ctx({ serial: "a", visitas: 3, ultima_visita: hace(22) }),
      ctx({ serial: "b", visitas: 3, ultima_visita: hace(20) }),
      ctx({ serial: "c", visitas: 0 }),
    ];
    expect(elegibles(sinVenir(), lista, undefined, { ahora: AHORA }).map((x) => x.serial)).toEqual(["a"]);
  });

  it("sin la tarjeta en el teléfono cuenta, pero no le llega", () => {
    const lista = [ctx({ serial: "a", visitas: 3, ultima_visita: hace(30) }, deli, { contactable: false })];
    expect(candidatos(sinVenir(), lista)).toHaveLength(1);
    expect(elegibles(sinVenir(), lista, undefined, { ahora: AHORA })).toHaveLength(0);
  });

  it("una vez por ausencia: no se repite hasta que vuelva", () => {
    const x = ctx({ serial: "a", visitas: 3, ultima_visita: hace(40) });
    const ya = enviosDe([{ grupo: "auto:te-echamos-de-menos", seriales: ["a"], creado: hace(19) }]);
    expect(elegibles(sinVenir(), [x], ya, { ahora: AHORA })).toHaveLength(0);
    // Se lo dijimos ANTES de su última visita: volvió, y se fue otra vez.
    const antes = enviosDe([{ grupo: "auto:te-echamos-de-menos", seriales: ["a"], creado: hace(45) }]);
    expect(elegibles(sinVenir(), [x], antes, { ahora: AHORA })).toHaveLength(1);
  });

  it("la pausa vale para cualquier aviso, también los mandados a mano", () => {
    const x = ctx({ serial: "a", visitas: 3, ultima_visita: hace(30) });
    const campana = enviosDe([{ grupo: "riesgo", seriales: ["a"], creado: hace(1) }]);
    expect(elegibles(sinVenir(), [x], campana, { ahora: AHORA, pausaDias: 3 })).toHaveLength(0);
    expect(elegibles(sinVenir(), [x], campana, { ahora: AHORA, pausaDias: 0 })).toHaveLength(1);
  });

  it("racha: una vez por racha, y no si ya ha venido hoy", () => {
    const fechas = new Set(["2026-09-19", "2026-09-21", "2026-09-22", "2026-09-23"]); // S, L, M, X
    const x = ctx({ serial: "r", visitas: 4, ultima_visita: hace(1) }, deli, { fechas });
    expect(x.racha).toBe(4);
    expect(elegibles(regla("racha"), [x], undefined, { ahora: AHORA })).toHaveLength(1);
    const yaAyer = enviosDe([{ grupo: "auto:racha", seriales: ["r"], creado: hace(1) }]);
    expect(elegibles(regla("racha"), [x], yaAyer, { ahora: AHORA, pausaDias: 0 })).toHaveLength(0);
    const hoy = ctx({ serial: "r", visitas: 5 }, deli, { fechas: new Set([...fechas, "2026-09-24"]) });
    expect(elegibles(regla("racha"), [hoy], undefined, { ahora: AHORA })).toHaveLength(0);
  });

  it("premio sin recoger y a un paso del premio", () => {
    const lleno = ctx({ serial: "p", sellos: 8, visitas: 8, ultima_visita: hace(4) });
    expect(elegibles(regla("premio-pendiente"), [lleno], undefined, { ahora: AHORA })).toHaveLength(1);
    const casi = ctx({ serial: "c", sellos: 7, visitas: 7, ultima_visita: hace(1) });
    expect(elegibles(regla("a-un-paso"), [casi, lleno], undefined, { ahora: AHORA }).map((x) => x.serial)).toEqual(["c"]);
  });

  it("cualquier grupo del CRM sirve de disparo", () => {
    const r = { ...reglaNueva("grupo", []), valor: "campeones" };
    const x = ctx({ serial: "g", premios: 3, visitas: 30, ultima_visita: hace(2) });
    expect(elegibles(r, [x], undefined, { ahora: AHORA })).toHaveLength(1);
  });

  it("conEnvio no toca el historial de partida", () => {
    const base = enviosDe([]);
    const despues = conEnvio(base, "racha", ["a"], AHORA);
    expect(base.ultimo.size).toBe(0);
    expect(despues.porRegla.get("racha|a")).toBe(AHORA);
  });
});

describe("cuándo sale", () => {
  it("si a esa hora aún no ha abierto, sale al abrir; si ya ha cerrado, ese día no", () => {
    const r = { ...regla("racha"), hora: "08:00" };
    expect(momentoDelDia(r, deli.horario, "2026-09-24")).toBe(480);  // jueves, 8:00
    expect(momentoDelDia(r, deli.horario, "2026-09-26")).toBe(510);  // sábado abre a las 8:30
    expect(momentoDelDia({ ...r, hora: "17:00" }, deli.horario, "2026-09-25")).toBeNull(); // viernes cierra a las 16:30
    expect(momentoDelDia(r, deli.horario, "2026-09-27")).toBeNull(); // domingo
    expect(momentoDelDia(r, deli.horario, "2026-10-09")).toBeNull(); // festivo
  });

  it("solo sus días", () => {
    expect(momentoDelDia(regla("a-un-paso"), deli.horario, "2026-09-24")).toBe(960); // jueves 16:00
    expect(momentoDelDia(regla("a-un-paso"), deli.horario, "2026-09-25")).toBeNull(); // viernes no
  });

  it("toca desde su hora y durante la ventana", () => {
    const r = regla("te-echamos-de-menos"); // 12:00
    const a = (hhmm) => ({ fecha: "2026-09-24", dia: 3, minutos: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) });
    expect(tocaAhora(r, deli.horario, a("11:59"))).toBe(false);
    expect(tocaAhora(r, deli.horario, a("12:00"))).toBe(true);
    expect(tocaAhora(r, deli.horario, a("13:59"))).toBe(true);
    expect(VENTANA_MIN).toBe(120);
    expect(tocaAhora(r, deli.horario, a("14:00"))).toBe(false);
  });

  it("la próxima vez, dicha en castellano", () => {
    expect(proximoEnvio(regla("a-un-paso"), deli.horario, AHORA).texto).toBe("hoy a las 16:00");
    expect(proximoEnvio(regla("te-echamos-de-menos"), deli.horario, AHORA).texto).toBe("hoy desde las 12:00");
    // Viernes a las 17:00: la merienda es de lunes a jueves; el próximo, el lunes.
    expect(proximoEnvio(regla("a-un-paso"), deli.horario, Date.parse("2026-09-25T15:00:00Z")).texto).toBe("el lunes a las 16:00");
    expect(proximoEnvio({ ...regla("racha"), activa: false }, deli.horario, AHORA)).toBeNull();
  });
});

describe("mensajes de un solo día", () => {
  const campanas = [{ grupo: "auto:racha", texto: "Hoy la cookie", seriales: ["a", "b"], creado: "2026-09-24T06:05:00Z" }];
  const mensajes = new Map([["a", "Hoy la cookie"], ["b", "Otro mensaje posterior"]]);

  it("con la tienda abierta sigue puesto", () => {
    expect(porRetirar(campanas, deli.automatizaciones, mensajes, deli.horario, Date.parse("2026-09-24T14:00:00Z"))).toEqual([]);
  });

  it("al cerrar se quita, solo a quien aún lo tiene", () => {
    const cerrada = Date.parse("2026-09-24T16:40:00Z"); // 18:40 en Valencia
    expect(porRetirar(campanas, deli.automatizaciones, mensajes, deli.horario, cerrada)).toEqual([{ texto: "Hoy la cookie", seriales: ["a"] }]);
    expect(porRetirar(campanas, deli.automatizaciones, null, deli.horario, cerrada)[0].seriales).toEqual(["a", "b"]);
  });

  it("mandado a mano con la tienda cerrada, dura hasta el cierre del siguiente día que abre", () => {
    const domingo = [{ ...campanas[0], creado: "2026-09-27T10:00:00Z" }];
    const a = (iso) => porRetirar(domingo, deli.automatizaciones, mensajes, deli.horario, Date.parse(iso));
    expect(a("2026-09-27T21:00:00Z")).toEqual([]);   // domingo por la noche: sigue
    expect(a("2026-09-28T12:00:00Z")).toEqual([]);   // lunes, abierta: sigue
    expect(a("2026-09-28T16:45:00Z")).toHaveLength(1); // lunes, 18:45: fuera
  });

  it("las reglas sin caducidad no se tocan", () => {
    const otra = [{ ...campanas[0], grupo: "auto:te-echamos-de-menos" }];
    expect(porRetirar(otra, deli.automatizaciones, mensajes, deli.horario, Date.parse("2026-09-26T10:00:00Z"))).toEqual([]);
  });
});

describe("validar lo que llega del manager", () => {
  const base = PLANTILLAS[3];

  it("dice qué regla está mal y por qué", () => {
    expect(validarReglas([{ ...base, texto: "Tu {premo}" }]).error).toMatch(/no existe \{premo\}/);
    expect(validarReglas([{ ...base, texto: "x".repeat(121) }]).error).toMatch(/pasa de 120/);
    expect(validarReglas([{ ...base, hora: "25:00" }]).error).toMatch(/hora/);
    expect(validarReglas([{ ...base, disparo: "magia" }]).error).toMatch(/a quién va/);
    expect(validarReglas([base, base]).error).toMatch(/mismo identificador/);
    expect(validarReglas("no").error).toBeTruthy();
  });

  it("recorta los valores a lo razonable", () => {
    const { reglas } = validarReglas([{ ...base, valor: 9999, dias: [0, 0, 9, 3], nombre: "  Te   echo de menos " }]);
    expect(reglas[0]).toMatchObject({ valor: 180, dias: [0, 3], nombre: "Te echo de menos" });
  });

  it("al leer, lo roto se descarta sin tumbar lo demás", () => {
    expect(normalizarReglas([base, { id: "x" }, null]).map((r) => r.id)).toEqual([base.id]);
    expect(normalizarReglas(undefined)).toBeNull();
  });

  it("la pausa va de 0 a 30 días", () => {
    expect([normalizarPausa(-2), normalizarPausa(99), normalizarPausa("x"), normalizarPausa(2)]).toEqual([0, 30, 3, 2]);
  });
});

describe("frases y piezas", () => {
  it("la regla se lee como una frase", () => {
    expect(fraseRegla(regla("a-un-paso"))).toEqual({ quien: "A quien está a 1 sello del premio", cuando: "a las 16:00, de lunes a jueves" });
    expect(fraseRegla(regla("racha")).quien).toBe("A quien ha venido 4 días seguidos");
    expect(diasTexto([])).toBe("los días que abre");
    expect(diasTexto([5])).toBe("los sábados");
    expect(diasTexto([0, 2, 4])).toBe("lunes, miércoles y viernes");
  });

  it("una regla nueva sale con su texto de partida y un id libre", () => {
    expect(idNuevo("sin_venir", [{ id: "sin-venir" }])).toBe("sin-venir-2");
    const r = reglaNueva("racha", []);
    expect(validarReglas([r]).reglas[0]).toMatchObject({ disparo: "racha", caduca: true, valor: 4 });
  });

  it("cada disparo se describe solo (sale en el selector sin tocar nada más)", () => {
    expect(LISTA_DISPAROS.map((d) => d.key)).toEqual(Object.keys(DISPAROS));
    for (const d of LISTA_DISPAROS) expect(variablesDesconocidas(d.sugerencia)).toEqual([]);
    expect(VARIABLES.map((v) => v.clave)).toContain("faltan");
  });

  it("los envíos automáticos se reconocen por su grupo", () => {
    expect(reglaDeGrupo(grupoDeRegla("racha"))).toBe("racha");
    expect(reglaDeGrupo("riesgo")).toBeNull();
    expect(etiquetaEnvio("auto:racha", deli.automatizaciones)).toBe("Premio a la racha");
    expect(etiquetaEnvio("auto:borrada", deli.automatizaciones)).toBe("Aviso automático");
    expect(etiquetaEnvio("riesgo", [])).toBe("En riesgo");
  });
});
