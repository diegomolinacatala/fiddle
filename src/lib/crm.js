// ============================================================================
// CRM — QUIÉN ES CADA CLIENTE, SIN MIRAR LA BASE
// ----------------------------------------------------------------------------
// Funciones PURAS (solo importan otras puras: el horario y las cartillas):
// estado guardado -> perfil, perfil -> grupo. Las usan la API, el panel del
// manager y la vista de la plataforma, así que la cuenta es LA MISMA en los
// tres sitios.
//
// La idea de todo esto cabe en una frase: **cada cliente tiene su propio ritmo**.
// Quien viene a diario y lleva una semana sin aparecer está tan "perdido" como
// quien viene una vez al mes y lleva cuatro. Por eso casi nada se mide en días
// sueltos, sino en `retraso` = días sin venir ÷ su cadencia habitual.
//
// Dos registros, para dos preguntas distintas:
//   ESTADOS  la escalera de la vida del cliente. EXCLUYENTES: cada cliente está
//            exactamente en uno. Sirven para el reparto del panel.
//   GRUPOS   bloques a los que se le puede mandar una campaña. SE SOLAPAN a
//            propósito: "a un paso del premio" y "se está enfriando" son la
//            misma persona muchas veces, y las dos cosas merecen un aviso.
// ============================================================================

import { fechaLocal, sumarDias, abreEl, ZONA_POR_DEFECTO } from "./horario";
import { cartillasDe, totalGuardados } from "./cartillas";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** Qué evento significa "el cliente estuvo en la tienda". `restar` es una corrección, no una visita. */
export const TIPOS_VISITA = [
  "sellar", "canjear", "confirmar", "sellar2", "canjear2",
  "guardar", "usarGuardado", "guardar2", "usarGuardado2",
];

/**
 * Los números que deciden cuándo alguien se está enfriando. En un sitio aparte
 * para poder discutirlos: son un criterio, no una verdad.
 */
export const UMBRALES = {
  nuevoDias: 30,      // recién llegado: menos de un mes con la tarjeta
  nuevoVisitas: 3,    // ...y todavía sin costumbre
  retraso: 1.5,       // 1.5 veces su ritmo sin aparecer = se está enfriando
  dormidoDias: 60,    // sin ritmo conocido, dos meses callado es dormido
  perdidoDias: 120,   // cuatro meses: dejó de ser cliente
  fielVisitas: 4,     // a partir de aquí ya era de la casa (y duele perderlo)
  aPuntoFaltan: 2,    // a dos sellos o menos del premio
  // Dos sellos con menos de esto entre medias son LA MISMA visita: diez sellos
  // seguidos en el mostrador no son diez visitas "cada pocos segundos".
  horasVisita: 3,
  cadenciaMin: 1,     // el ritmo más rápido que se mide: a diario
  riesgoMinDias: 7,   // nadie está en riesgo por faltar menos de una semana (cierres, puentes)
  // Un pase que nadie guardó ni usó, pasado este rato, no es un cliente: es
  // alguien que escaneó y se fue. Antes del plazo aún puede estar guardándolo.
  descartadaDias: 1,
  // Con menos que esto en el periodo anterior, un porcentaje engaña (de 2 a 4
  // visitas sería «+100 %»): la flecha da la diferencia en unidades.
  tendenciaMin: 20,
  // «Vuelven pronto»: de los que estrenaron la tarjeta, cuántos repiten en estos
  // días. Con menos estrenos que `vueltaMinBase`, el porcentaje aún no dice nada.
  vueltaDias: 14,
  vueltaMinBase: 5,
};

const dias = (desde, hasta) => (desde && hasta ? Math.max(0, (hasta - desde) / DIA) : null);
const ms = (v) => (v ? Date.parse(v) || null : null);

/**
 * Del historial, UNA entrada por visita: la primera de cada rato en el mostrador.
 * Misma regla que store.registrarVisita (lo de la misma tarjeta a menos de
 * `horasVisita` de lo anterior es la misma visita), para que el Resumen cuente
 * igual que la ficha: siete cafés de golpe a quien traía la cartilla de papel,
 * o una ronda para los amigos, son UNA visita, no siete.
 */
export function soloVisitas(eventos) {
  const ultima = new Map();
  return (eventos || [])
    .filter((e) => TIPOS_VISITA.includes(e.tipo) && ms(e.ts))
    .sort((a, b) => ms(a.ts) - ms(b.ts))
    .filter((e) => {
      const t = ms(e.ts);
      const antes = ultima.get(e.serial);
      ultima.set(e.serial, t);
      return !antes || t - antes >= UMBRALES.horasVisita * HORA;
    });
}

/**
 * Todo lo que se puede decir de un cliente a partir de lo guardado, sin tocar
 * el historial: las columnas `visitas` / `ultima_visita` ya son ese resumen.
 *
 * La CADENCIA es el hueco medio entre visitas. Sale de (última − alta) ÷ huecos,
 * que es exactamente la media de los huecos si el alta coincidió con la primera
 * visita — y coincide: el pase se emite en el mostrador, con el cliente delante.
 * Con una visita o ninguna no hay ritmo que medir y vale `null`, y nunca baja de
 * `cadenciaMin`: nadie "viene cada pocos segundos".
 *
 * Las VISITAS no pueden ser más de las que caben en el tiempo que ha pasado
 * (una cada `horasVisita`). La caja ya no cuenta dos veces la misma visita
 * (store.registrarVisita), pero los contadores de antes sí lo hacían: una
 * tarjeta de prueba con diez sellos seguidos cuenta como una visita, no como un
 * habitual que lleva horas sin venir.
 *
 * @param {object} cliente fila de `clientes`
 * @param {object} negocio ficha del negocio (meta, tipo)
 * @param {number} [ahora]
 */
export function perfilDe(cliente, negocio, ahora = Date.now()) {
  const alta = ms(cliente.creado);
  const ultima = ms(cliente.ultima_visita);
  const caben = alta && ultima && ultima >= alta ? Math.floor((ultima - alta) / (UMBRALES.horasVisita * HORA)) + 1 : Infinity;
  const visitas = Math.min(cliente.visitas || 0, caben);

  const cadencia = visitas > 1 && ultima && alta ? Math.max(UMBRALES.cadenciaMin, dias(alta, ultima) / (visitas - 1)) : null;
  // Sin visitas, el reloj corre desde el alta: un pase emitido hace un año y
  // nunca usado lleva un año sin usarse, no "cero días".
  const diasSinVenir = dias(ultima || alta, ahora);
  const retraso = cadencia && cadencia > 0 && diasSinVenir !== null ? diasSinVenir / cadencia : null;

  const meta = negocio?.meta ?? 0;
  const esCupon = negocio?.tipo === "descuento";
  const faltan = esCupon ? 0 : Math.max(0, meta - (cliente.sellos || 0));
  // Las dos cartillas si las hay: lo que la tienda debe sale de las dos.
  const llenas = esCupon ? 0 : cartillasDe(cliente, negocio).filter((c) => c.meta > 0 && c.completa).length;
  const guardados = esCupon ? 0 : totalGuardados(cliente);

  const perfil = {
    serial: cliente.serial,
    visitas,
    premios: cliente.premios || 0,
    sellos: cliente.sellos || 0,
    faltan,
    completa: !esCupon && meta > 0 && faltan === 0,
    // Premios que la tienda ya debe: los guardados y las cartillas llenas sin canjear.
    porDar: guardados + llenas,
    // ¿Llegó alguna vez al premio? Canjear y guardar vacían la cartilla: hay que
    // mirar también lo canjeado y lo guardado, no solo cómo va ahora.
    llenoAlgunaVez: !esCupon && ((cliente.premios || 0) > 0 || guardados > 0 || llenas > 0),
    esCupon,
    diasDesdeAlta: dias(alta, ahora),
    diasSinVenir,
    cadencia,
    retraso,
    // Sin pase instalado no hay a dónde mandar el aviso: es el límite de todo esto.
    contactable: Boolean(cliente.instalado && !cliente.desinstalado),
    instalado: Boolean(cliente.instalado),
    // Dijo que no a las promos (docs/RGPD.md, 2.3): sigue con su tarjeta, pero
    // lo que escribe la tienda (promo, campañas, automáticos) ya no le llega.
    sinPromos: Boolean(cliente.promos_no),
  };
  // A quién le llega un aviso de la tienda: lo que cuentan Clientes y Avisos.
  perfil.avisable = perfil.contactable && !perfil.sinPromos;
  // Ni en el teléfono ni en caja: no cuenta como cliente en las cifras (metricas).
  perfil.descartada = !visitas && !perfil.instalado && (perfil.diasDesdeAlta ?? 0) >= UMBRALES.descartadaDias;
  perfil.estado = estadoDe(perfil);
  return perfil;
}

// ------------------------------------------------------ la escalera (excluyentes)
export const ESTADOS = {
  fantasma: { label: "Sin uso", icon: "cartera", color: "#8b929e", descripcion: "Tiene la tarjeta pero no ha registrado ninguna visita." },
  nuevo:    { label: "Nuevo",    icon: "clientes", color: "#2563eb", descripcion: "Alta en los últimos 30 días, con menos de 3 visitas." },
  activo:   { label: "Activo",   icon: "check", color: "#136f3a", descripcion: "Visita con su frecuencia habitual." },
  riesgo:   { label: "En riesgo", icon: "alerta", color: "#c26b04", descripcion: "Lleva más tiempo del habitual sin venir." },
  dormido:  { label: "Inactivo", icon: "reloj", color: "#6b7280", descripcion: "Más de 60 días sin visitas." },
  perdido:  { label: "Perdido",  icon: "cerrar", color: "#b42318", descripcion: "Más de 120 días sin visitas." },
  // Fuera de la escalera: no sale en el reparto ni en las cifras, solo en la lista.
  descartada: { label: "Sin guardar", icon: "fantasma", color: "#a3a9b3", descripcion: "Sacó la tarjeta, pero ni la guardó en el teléfono ni la usó en caja. No cuenta como cliente." },
};

export const LISTA_ESTADOS = Object.entries(ESTADOS).map(([key, v]) => ({ key, ...v }));

/**
 * En qué escalón está. El orden de las preguntas ES la definición: primero
 * quien nunca usó el pase, luego quien acaba de llegar (a ese no se le puede
 * exigir ritmo todavía), y después el reloj.
 */
export function estadoDe(p) {
  if (p.descartada) return "descartada";
  if (!p.visitas) return "fantasma";
  if (p.diasDesdeAlta !== null && p.diasDesdeAlta <= UMBRALES.nuevoDias && p.visitas < UMBRALES.nuevoVisitas) {
    return "nuevo";
  }
  const d = p.diasSinVenir ?? 0;
  if (d > UMBRALES.perdidoDias) return "perdido";
  if (d > UMBRALES.dormidoDias) return "dormido";
  // Con ritmo conocido manda el ritmo; sin él, el mes de gracia de siempre.
  if (p.retraso !== null) return p.retraso > UMBRALES.retraso && d >= UMBRALES.riesgoMinDias ? "riesgo" : "activo";
  return d > UMBRALES.nuevoDias ? "riesgo" : "activo";
}

/**
 * Quién cuenta como cliente que sigue viniendo: el que viene a su ritmo y el
 * recién llegado (aún no se le puede pedir ritmo, pero está viniendo). UNA sola
 * definición para la cifra de «Activos», las cohortes y la cartilla: antes la
 * cifra dejaba fuera a los nuevos y la tabla de cohortes no, y en la misma
 * pantalla salían 10 activos y 27 que «siguen activos».
 */
export const ESTADOS_ACTIVOS = ["activo", "nuevo"];
export const esActivo = (p) => ESTADOS_ACTIVOS.includes(p?.estado);

// ------------------------------------------------- los bloques (se solapan)
// Cada grupo es una entrada con `incluye(perfil)`. Añadir uno nuevo = añadir
// una entrada aquí: sale solo en el panel, en el selector de campañas y en la
// exportación, sin tocar nada más.
export const GRUPOS = {
  a_punto: {
    label: "Cerca del premio",
    icon: "diana",
    descripcion: "Les faltan 2 sellos o menos para completar la cartilla.",
    idea: "Te falta 1 para tu {premio}",
    incluye: (p) => !p.esCupon && p.visitas > 0 && !p.completa && p.faltan <= UMBRALES.aPuntoFaltan,
  },
  premio_listo: {
    label: "Premio pendiente",
    icon: "regalo",
    descripcion: "Tienen la cartilla completa y no han canjeado el premio.",
    idea: "Tu {premio} te está esperando",
    incluye: (p) => p.completa,
  },
  fieles_frios: {
    label: "Habituales en riesgo",
    icon: "estrella",
    descripcion: "Clientes frecuentes (4 visitas o más) que llevan tiempo sin venir.",
    idea: "Hace tiempo que no te vemos. En tu próxima visita tienes un detalle",
    incluye: (p) => p.visitas >= UMBRALES.fielVisitas && ["riesgo", "dormido", "perdido"].includes(p.estado),
  },
  riesgo: {
    label: "En riesgo",
    icon: "alerta",
    descripcion: "Llevan más tiempo del habitual sin venir.",
    idea: "Esta semana tenemos algo para ti en tu próxima visita",
    incluye: (p) => p.estado === "riesgo",
  },
  habituales: {
    label: "Habituales",
    icon: "check",
    descripcion: "Visitan con regularidad y llevan 3 visitas o más.",
    idea: "Gracias por estar siempre. Hoy, algo extra",
    incluye: (p) => p.estado === "activo" && p.visitas >= UMBRALES.nuevoVisitas,
  },
  nuevos: {
    label: "Nuevos",
    icon: "clientes",
    descripcion: "Alta en los últimos 30 días.",
    idea: "Bienvenido. Tu segunda visita lleva regalo",
    incluye: (p) => p.estado === "nuevo",
  },
  dormidos: {
    label: "Inactivos",
    icon: "reloj",
    descripcion: "Más de 60 días sin visitas.",
    idea: "Hace tiempo que no te vemos. Tu tarjeta sigue activa",
    incluye: (p) => ["dormido", "perdido"].includes(p.estado),
  },
  fantasmas: {
    label: "Sin uso",
    icon: "cartera",
    descripcion: "Tienen la tarjeta pero nunca la han usado en caja.",
    idea: "Enseña esta tarjeta en caja y empieza a sumar",
    // Los que ni la guardaron no son un grupo al que escribir: no les llegaría nada.
    incluye: (p) => p.visitas === 0 && !p.descartada,
  },
  campeones: {
    label: "Mejores clientes",
    icon: "trofeo",
    descripcion: "Han canjeado 2 premios o más.",
    idea: "Gracias por tu fidelidad. En tu próxima visita tienes un detalle",
    incluye: (p) => p.premios >= 2,
  },
};

export const LISTA_GRUPOS = Object.entries(GRUPOS).map(([key, v]) => ({
  key, label: v.label, icon: v.icon, descripcion: v.descripcion, idea: v.idea,
}));

/** ¿Existe ese grupo? (lo pregunta la API antes de fiarse de lo que llega). */
export const esGrupo = (key) => typeof key === "string" && Object.hasOwn(GRUPOS, key);

/** Claves de los grupos a los que pertenece un perfil. */
export const gruposDe = (p) => Object.keys(GRUPOS).filter((k) => GRUPOS[k].incluye(p));

/**
 * Cuántos hay en cada grupo y cuántos de ellos se pueden avisar. Lo segundo
 * importa tanto como lo primero: un grupo de 40 al que solo llegan 6 avisos no
 * es un grupo de 40.
 */
export function conteoGrupos(perfiles) {
  return Object.keys(GRUPOS).map((key) => {
    const dentro = perfiles.filter((p) => GRUPOS[key].incluye(p));
    return {
      key,
      ...LISTA_GRUPOS.find((g) => g.key === key),
      total: dentro.length,
      // Los que de verdad recibirían un aviso: con la tarjeta en el teléfono y sin
      // haber dicho que no a las promos.
      contactables: dentro.filter((p) => p.avisable).length,
    };
  });
}

// ------------------------------------------------------------------ números
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/**
 * El valor del medio. Para ritmos y visitas, mejor que la media: un habitual que
 * viene a diario arrastra la media y la cifra deja de describir a nadie.
 */
export function mediana(xs) {
  if (!xs.length) return null;
  const orden = [...xs].sort((a, b) => a - b);
  const m = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[m] : (orden[m - 1] + orden[m]) / 2;
}

/**
 * Las cifras de cabecera. `eventos` solo hace falta para contar visitas por
 * ventana de tiempo; todo lo demás sale del resumen que llevan los clientes.
 *
 * Las tarjetas descartadas (ni guardadas ni usadas) NO entran en ninguna cifra:
 * quien escaneó y se fue no es un cliente, y contarlo hundía la vuelta, la
 * instalación y el reparto. Se cuentan aparte, en `descartadas` (y en el
 * embudo, que empieza justo ahí).
 *
 * Los 30 días anteriores solo valen para comparar si existieron enteros: la
 * tienda llevaba ya fiddle (su primera tarjeta) y, para las visitas, el
 * historial que llega los cubre (`historialDesde`; con el tope de eventos
 * puede no hacerlo). Si no, van a null y no sale flecha.
 *
 * @param {object[]} todos     de perfilDe(), descartadas incluidas
 * @param {object[]} eventos   [{serial, tipo, ts}] del negocio
 * @param {object[]} clientesTodos filas crudas (para altas por fecha)
 * @param {number} [ahora]
 * @param {{historialDesde?: number|null}} [opciones] desde cuándo está entero el historial (ms)
 */
export function metricas(todos, eventos, clientesTodos, ahora = Date.now(), { historialDesde = null } = {}) {
  const perfiles = todos.filter((p) => !p.descartada);
  const fuera = new Set(todos.filter((p) => p.descartada).map((p) => p.serial));
  const clientes = clientesTodos.filter((c) => !fuera.has(c.serial));
  const visitas = soloVisitas(eventos);
  const enVentana = (lista, desdeDias, hastaDias = 0) =>
    lista.filter((e) => {
      const t = ms(e.ts || e.creado);
      return t && t > ahora - desdeDias * DIA && t <= ahora - hastaDias * DIA;
    }).length;

  const haceDosMeses = ahora - 60 * DIA;
  const primeraAlta = Math.min(...clientesTodos.map((c) => ms(c.creado)).filter(Boolean));
  const altasComparables = primeraAlta <= haceDosMeses;
  const visitasComparables = altasComparables && (historialDesde === null || historialDesde <= haceDosMeses);

  const total = perfiles.length;
  const porEstado = Object.fromEntries(
    Object.keys(ESTADOS).filter((k) => k !== "descartada").map((k) => [k, perfiles.filter((p) => p.estado === k).length]),
  );
  const cadencias = perfiles.map((p) => p.cadencia).filter((c) => c !== null && c > 0);

  return {
    total,
    descartadas: fuera.size,
    porEstado,
    // Activo = sigue viniendo (esActivo). No es "vino en los últimos 30 días":
    // quien pasa una vez al trimestre y está en fecha también es un cliente vivo.
    activos: perfiles.filter(esActivo).length,
    enRiesgo: porEstado.riesgo,
    nuevos30: enVentana(clientes, 30),
    nuevos30Previos: altasComparables ? enVentana(clientes, 60, 30) : null,
    visitas30: enVentana(visitas, 30),
    visitas30Previas: visitasComparables ? enVentana(visitas, 60, 30) : null,
    premios: perfiles.reduce((a, p) => a + p.premios, 0),
    porDar: perfiles.reduce((a, p) => a + p.porDar, 0),
    // De los pases emitidos, cuántos llegaron a un Wallet.
    instalados: perfiles.filter((p) => p.instalado).length,
    contactables: perfiles.filter((p) => p.contactable).length,
    tasaInstalacion: pct(perfiles.filter((p) => p.instalado).length, total),
    // ¿Vuelve la gente? Una tarjeta que nadie usa dos veces no está funcionando.
    repiten: perfiles.filter((p) => p.visitas >= 2).length,
    tasaVuelta: pct(perfiles.filter((p) => p.visitas >= 2).length, total),
    cadenciaHabitual: mediana(cadencias),
    visitasHabituales: mediana(perfiles.map((p) => p.visitas)),
    vuelta: vueltaPronto(clientes, eventos, { ahora }),
    embudo: embudo(todos),
  };
}

/**
 * Cómo cambió una cifra contra el periodo anterior, para la flechita. Con poco
 * detrás, un porcentaje engaña: por debajo de `tendenciaMin` se da la
 * diferencia en unidades («+6»). Sin periodo anterior entero (null), nada.
 * @returns {{pct:number}|{unidades:number}|null}
 */
export function cambio(ahora, antes) {
  if (antes === null || antes === undefined) return null;
  if (antes < UMBRALES.tendenciaMin) return { unidades: ahora - antes };
  return { pct: Math.round(((ahora - antes) / antes) * 100) };
}

/**
 * ¿Vuelven pronto? De los que estrenaron la tarjeta (su primera visita) hace al
 * menos `dias`, cuántos volvieron dentro de esos `dias`. Es la señal temprana
 * de que la tarjeta funciona, y se puede comparar de un mes a otro: «vuelven
 * una segunda vez» sube sola con el tiempo, esta no.
 *
 * Solo cuenta a quien se dio de alta dentro del historial que llega (desde el
 * evento más viejo): de los de antes no se sabe cuándo fue su primera visita.
 * Con menos de `vueltaMinBase` estrenos, `tasa` es null.
 * @returns {{base:number, volvieron:number, tasa:number|null, dias:number}}
 */
export function vueltaPronto(clientes, eventos, { dias = UMBRALES.vueltaDias, ahora = Date.now() } = {}) {
  const desde = Math.min(...(eventos || []).map((e) => ms(e.ts)).filter(Boolean));
  const dentro = new Set(clientes.filter((c) => ms(c.creado) >= desde).map((c) => c.serial));
  const primera = new Map();
  const segunda = new Map();
  for (const e of soloVisitas(eventos)) {
    if (!dentro.has(e.serial)) continue;
    if (!primera.has(e.serial)) primera.set(e.serial, ms(e.ts));
    else if (!segunda.has(e.serial)) segunda.set(e.serial, ms(e.ts));
  }
  const plazo = dias * DIA;
  const estrenos = [...primera].filter(([, t]) => t <= ahora - plazo);
  const volvieron = estrenos.filter(([s, t]) => segunda.has(s) && segunda.get(s) - t <= plazo).length;
  return {
    base: estrenos.length,
    volvieron,
    tasa: estrenos.length >= UMBRALES.vueltaMinBase ? pct(volvieron, estrenos.length) : null,
    dias,
  };
}

/**
 * El camino de la tarjeta: la sacan, la estrenan en caja, vuelven, llenan la
 * cartilla y canjean. Cada paso sale de los del anterior, así que nunca hay más
 * gente en un escalón que en el de arriba (quien llenó la cartilla de golpe con
 * los sellos de papel, en una sola visita, no cuenta como «llenó»: es raro y el
 * embudo pregunta otra cosa, si la tarjeta hace volver).
 *
 * Empieza en TODAS las tarjetas, descartadas incluidas: la primera caída es
 * justo la de quien escaneó y se fue. Guardar el pase en el teléfono no es un
 * escalón: hay quien la usa sin Wallet, y eso ya lo dice «Instalan el pase».
 * En un cupón no hay cartilla que llenar y se usa en la primera visita: el
 * orden es estrenar, usarlo y, después, volver. Con «volver» delante, quien
 * usó el cupón y no volvió se caía del embudo y no cuadraba con la cifra de
 * «Cupones usados».
 * @returns {{key:string, label:string, n:number, paso:number|null}[]} `paso` = % del anterior
 */
export function embudo(todos) {
  const esCupon = todos.some((p) => p.esCupon);
  const sacaron = { key: "sacaron", label: "Sacaron la tarjeta", incluye: () => true };
  const estrenaron = { key: "estrenaron", label: "La estrenaron en caja", incluye: (p) => p.visitas >= 1 };
  const volvieron = { key: "volvieron", label: "Volvieron", incluye: (p) => p.visitas >= 2 };
  const canjearon = { key: "canjearon", label: esCupon ? "Usaron el cupón" : "Canjearon un premio", incluye: (p) => p.premios >= 1 };
  const pasos = esCupon
    ? [sacaron, estrenaron, canjearon, volvieron]
    : [sacaron, estrenaron, volvieron, { key: "llenaron", label: "Llenaron la cartilla", incluye: (p) => p.llenoAlgunaVez }, canjearon];
  let quedan = todos;
  let antes = null;
  return pasos.map(({ key, label, incluye }) => {
    quedan = quedan.filter(incluye);
    const n = quedan.length;
    const paso = antes === null ? null : pct(n, antes);
    antes = n;
    return { key, label, n, paso };
  });
}

/**
 * Dónde se queda la cartilla: cuántos clientes hay con 1, 2, 3… sellos, cartilla
 * a cartilla, separando a los que siguen viniendo de los que se están alejando.
 * Si los que se alejan se amontonan en los primeros sellos, la meta queda lejos.
 * Los que están a cero (empiezan o acaban de canjear) van aparte, en `enCero`:
 * no dicen dónde se para nadie. Sin cartillas (cupón), lista vacía.
 * @returns {{indice:number, nombre:string, meta:number, premio:string, filas:{sellos:number, siguen:number, alejan:number}[], enCero:number, alejanMediana:number|null}[]}
 */
export function repartoCartillas(clientes, perfiles, negocio) {
  if (negocio?.tipo === "descuento") return [];
  const porSerial = new Map(perfiles.map((p) => [p.serial, p]));
  const conVisitas = clientes.filter((c) => {
    const p = porSerial.get(c.serial);
    return p && !p.descartada && p.visitas > 0;
  });
  const modelo = cartillasDe({}, negocio).filter((c) => c.meta > 0);
  return modelo.map((cartilla) => {
    const { indice } = cartilla;
    const filas = Array.from({ length: cartilla.meta }, (_, i) => ({ sellos: i + 1, siguen: 0, alejan: 0 }));
    const alejados = [];
    let enCero = 0;
    for (const c of conVisitas) {
      const { sellos } = cartillasDe(c, negocio)[indice];
      if (!sellos) { enCero += 1; continue; }
      const sigue = esActivo(porSerial.get(c.serial));
      filas[sellos - 1][sigue ? "siguen" : "alejan"] += 1;
      if (!sigue) alejados.push(sellos);
    }
    return {
      // `indice` hace de clave: dos cartillas pueden llamarse igual.
      indice, nombre: cartilla.nombre, meta: cartilla.meta, premio: cartilla.premio, filas, enCero,
      // «La mitad de los que se alejan se quedó con N sellos o menos»: con pocos, nada.
      alejanMediana: alejados.length >= UMBRALES.vueltaMinBase ? Math.ceil(mediana(alejados)) : null,
    };
  });
}

/**
 * Visitas por día, de hace `dias` hasta hoy, sin huecos (los días sin nada van
 * a cero: si no, el gráfico miente sobre las rachas malas). El día es el de la
 * TIENDA (`horario.zona`): con el de UTC, lo de pasada la medianoche caía en
 * el día anterior. Con horario, cada día dice si abrió: un cero de un día
 * cerrado no es un día malo.
 * @returns {{dia:string, n:number, cerrado:boolean}[]}
 */
export function serieVisitas(eventos, dias = 30, ahora = Date.now(), horario = null) {
  const zona = horario?.zona || ZONA_POR_DEFECTO;
  const cuenta = new Map();
  for (const e of soloVisitas(eventos)) {
    const t = ms(e.ts);
    if (t < ahora - dias * DIA) continue;
    const dia = fechaLocal(t, zona);
    cuenta.set(dia, (cuenta.get(dia) || 0) + 1);
  }
  const hoy = fechaLocal(ahora, zona);
  return Array.from({ length: dias }, (_, i) => {
    const dia = sumarDias(hoy, i - (dias - 1));
    return { dia, n: cuenta.get(dia) || 0, cerrado: horario ? !abreEl(horario, dia) : false };
  });
}

/**
 * Cuándo viene la gente: rejilla día de la semana × hora.
 *
 * Usa la hora LOCAL de quien mira la pantalla, así que se calcula en el
 * navegador. En el servidor (Vercel, UTC) el café de las 9 saldría a las 7.
 *
 * @returns {number[][]} 7 filas (lunes..domingo) × 24 horas
 */
export function rejillaHoraria(eventos) {
  const rejilla = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const e of soloVisitas(eventos)) {
    const d = new Date(ms(e.ts));
    rejilla[(d.getDay() + 6) % 7][d.getHours()] += 1; // getDay(): 0 = domingo
  }
  return rejilla;
}

/**
 * Cohortes por mes de alta: de los que entraron en marzo, ¿cuántos siguen vivos?
 * Es la pregunta que dice si la tarjeta sirve para algo, no cuántas se reparten.
 * @returns {{mes:string, altas:number, vivos:number, repiten:number, retencion:number}[]}
 */
export function cohortes(clientes, perfiles, meses = 6, ahora = Date.now()) {
  const porSerial = new Map(perfiles.map((p) => [p.serial, p]));
  const clave = (t) => new Date(t).toISOString().slice(0, 7);
  const desde = clave(ahora - meses * 31 * DIA);

  const grupos = new Map();
  for (const c of clientes) {
    const t = ms(c.creado);
    if (!t) continue;
    const mes = clave(t);
    if (mes < desde) continue;
    if (!grupos.has(mes)) grupos.set(mes, []);
    grupos.get(mes).push(porSerial.get(c.serial));
  }

  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([, ps]) => ps.some((p) => p && !p.descartada))
    .map(([mes, ps]) => {
      const dentro = ps.filter((p) => p && !p.descartada);
      const vivos = dentro.filter(esActivo).length;
      return {
        mes,
        altas: dentro.length,
        vivos,
        repiten: dentro.filter((p) => p.visitas >= 2).length,
        retencion: pct(vivos, dentro.length),
      };
    });
}

/**
 * ¿Sirvió la campaña? Cuenta cuántos de los avisados pasaron por la tienda
 * DESPUÉS del envío. Es la única forma de saber si esto vale la pena.
 *
 * @param {{seriales:string[], creado:string}} campana
 * @param {object[]} eventos  historial del negocio
 */
export function efectoCampana(campana, eventos) {
  const enviada = ms(campana.creado);
  const destino = new Set(campana.seriales || []);
  if (!enviada || !destino.size) return { volvieron: 0, tasa: 0 };
  const volvieron = new Set(
    eventos
      .filter((e) => TIPOS_VISITA.includes(e.tipo) && destino.has(e.serial) && ms(e.ts) > enviada)
      .map((e) => e.serial),
  );
  return { volvieron: volvieron.size, tasa: pct(volvieron.size, destino.size) };
}

/** "hace 3 días", "hace 2 meses". Null-safe: sin fecha, "nunca". */
export function haceTexto(diasSueltos) {
  if (diasSueltos === null || diasSueltos === undefined) return "nunca";
  const d = Math.floor(diasSueltos);
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  if (d < 60) return "hace un mes";
  if (d < 365) return `hace ${Math.round(d / 30)} meses`;
  return "hace más de un año";
}

/** Redondeo amable para la cadencia: "cada 4 días", "cada 3 semanas". */
export function cadenciaTexto(cadencia) {
  if (!cadencia) return "—";
  if (cadencia < 1.5) return "a diario";
  if (cadencia < 14) return `cada ${Math.round(cadencia)} días`;
  if (cadencia < 60) return `cada ${Math.round(cadencia / 7)} semanas`;
  return `cada ${Math.round(cadencia / 30)} meses`;
}
