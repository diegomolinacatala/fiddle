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

import { fechaLocal, sumarDias, abreEl, diaDeFecha, relojLocal, tramosDe, ZONA_POR_DEFECTO } from "./horario";
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
  // «Cuánto tardan en volver» (curvaDeVuelta): hasta cuántos días después de
  // estrenarla se mira, y la curva se corta cuando quedan menos clientes
  // seguidos que `vueltaMinBase` o que esta parte de todos: en la cola, con
  // seis personas, una que vuelve la llevaba del 78 % al 100 %.
  vueltaCurvaDias: 28,
  vueltaMinBase: 5,
  vueltaSeguidos: 0.4,
  // El puente de activos: cuántos había hace estos días y cuántos hay hoy.
  puenteDias: 30,
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

  const esCupon = negocio?.tipo === "descuento";
  // Las DOS cartillas si las hay, en todo: lo que la tienda debe, quién está
  // cerca del premio y quién lo tiene listo. Antes «Cerca del premio» y «Premio
  // pendiente» solo miraban la primera (en La Delicantería, las cookies y no los
  // cafés) y no cuadraban ni con «Premios por dar» ni con el aviso automático.
  const cartillas = esCupon ? [] : cartillasDe(cliente, negocio).filter((c) => c.meta > 0);
  const llenas = cartillas.filter((c) => c.completa).length;
  const guardados = esCupon ? 0 : totalGuardados(cliente);
  // La cartilla a medias a la que menos le falta (la misma que el aviso «a punto»,
  // lib/automatizaciones.js). Con todas llenas, no le falta nada: 0.
  const cercana = cartillas.filter((c) => !c.completa).reduce((m, c) => (!m || c.faltan < m.faltan ? c : m), null);

  const perfil = {
    serial: cliente.serial,
    visitas,
    premios: cliente.premios || 0,
    sellos: cliente.sellos || 0,
    faltan: cercana ? cercana.faltan : 0,
    // Alguna cartilla llena y sin canjear.
    completa: llenas > 0,
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
// `label` y `descripcion` hablan de UN cliente (la etiqueta de la lista, la
// ficha); `plural` y `quienes`, de un montón (el Resumen). «A su ritmo» y no
// «Activo»: «Activos» arriba eran los que siguen viniendo (con los nuevos) y en
// el reparto salía otra cifra con el mismo nombre.
//
// Los colores van con los de la app en claro y en oscuro (el mismo hex en los
// dos), comprobados con el validador de dataviz: ninguno se confunde con el de
// al lado, ni con daltonismo, en el orden del Resumen (a su ritmo, nuevo, en
// riesgo, inactivo, perdido). «Sin uso» es gris a propósito: no es un estado
// de la escalera, es que aún no ha empezado.
export const ESTADOS = {
  fantasma: {
    label: "Sin uso", plural: "Sin uso", icon: "cartera", color: "#9aa1ad",
    descripcion: "Tiene la tarjeta, pero nunca la ha usado en caja.", quienes: "Tienen la tarjeta y nunca la han usado en caja",
  },
  nuevo: {
    label: "Nuevo", plural: "Nuevos", icon: "clientes", color: "#3478d4",
    descripcion: "Sacó la tarjeta hace menos de 30 días y lleva menos de 3 visitas.", quienes: "Menos de 30 días con la tarjeta y menos de 3 visitas",
  },
  activo: {
    label: "A su ritmo", plural: "A su ritmo", icon: "check", color: "#18943a",
    descripcion: "Vuelve cuando suele.", quienes: "Vuelven cuando suelen",
  },
  riesgo: {
    label: "En riesgo", plural: "En riesgo", icon: "alerta", color: "#c47f00",
    descripcion: "Tarda en volver más de lo que suele.", quienes: "Tardan en volver más de lo que suelen",
  },
  dormido: {
    label: "Inactivo", plural: "Inactivos", icon: "reloj", color: "#8a63d2",
    descripcion: "Más de 60 días sin venir.", quienes: "Más de 60 días sin venir",
  },
  perdido: {
    label: "Perdido", plural: "Perdidos", icon: "cerrar", color: "#d23f3a",
    descripcion: "Más de 120 días sin venir.", quienes: "Más de 120 días sin venir",
  },
  // Fuera de la escalera: no sale en el reparto ni en las cifras, solo en la lista.
  descartada: {
    label: "Sin guardar", plural: "Sin guardar", icon: "fantasma", color: "#a3a9b3",
    descripcion: "Sacó la tarjeta, pero ni la guardó en el teléfono ni la usó en caja. No cuenta como cliente.",
    quienes: "Sacaron la tarjeta y ni la guardaron ni la usaron",
  },
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
 * definición para la cifra de «Siguen viniendo», el puente y la cartilla: antes
 * la cifra dejaba fuera a los nuevos y la tabla de cohortes (ya no está) no, y
 * en la misma pantalla salían 10 activos y 27 que «siguen activos».
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
    descripcion: "Les faltan 2 puntos o menos para completar una cartilla.",
    idea: "Te falta 1 para tu {premio}",
    incluye: (p) => !p.esCupon && p.visitas > 0 && p.faltan > 0 && p.faltan <= UMBRALES.aPuntoFaltan,
  },
  premio_listo: {
    label: "Premio pendiente",
    icon: "regalo",
    // Lo mismo que «Premios por dar» y que el aviso «Tiene un premio sin recoger».
    descripcion: "Tienen un premio por recoger: una cartilla llena o un premio guardado.",
    idea: "Tu {premio} te está esperando",
    incluye: (p) => p.porDar > 0,
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

/**
 * La idea de partida de un grupo con su premio puesto. Con dos cartillas no se
 * sabe cuál: un mismo texto va a todo el grupo, y «Tu cookie gratis te está
 * esperando» le llegaba a quien tenía lleno el de cafés. Entonces, «tu premio».
 */
export function ideaDeGrupo(idea, negocio) {
  const premio = negocio?.cartillas?.length > 1 ? "premio" : negocio?.premio || "premio";
  return (idea || "").replace("{premio}", premio);
}

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
 * embudo, que empieza justo ahí: su segundo escalón es `total`).
 *
 * `inicio` es la primera tarjeta de la tienda: con menos de 30 días de fiddle,
 * «los últimos 30 días» son en realidad «desde el día X», y la pantalla lo dice.
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
    inicio: Number.isFinite(primeraAlta) ? primeraAlta : null,
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
    // A cuántas personas se les deben esos premios (el grupo «Premio pendiente»).
    conPremio: perfiles.filter((p) => p.porDar > 0).length,
    // De los pases emitidos, cuántos llegaron a un Wallet.
    instalados: perfiles.filter((p) => p.instalado).length,
    contactables: perfiles.filter((p) => p.contactable).length,
    tasaInstalacion: pct(perfiles.filter((p) => p.instalado).length, total),
    // ¿Vuelve la gente? Una tarjeta que nadie usa dos veces no está funcionando.
    // (Para el panel del admin; el Resumen lo dice con el embudo y la curva.)
    repiten: perfiles.filter((p) => p.visitas >= 2).length,
    tasaVuelta: pct(perfiles.filter((p) => p.visitas >= 2).length, total),
    // El ritmo del cliente típico: la mediana, que uno que viene a diario no arrastra.
    cadenciaHabitual: mediana(cadencias),
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
 * ¿Cuánto tardan en volver? De los que estrenaron la tarjeta, qué parte ha
 * vuelto a los 1, 2, 3… días de su primera visita. Es LA cifra de si la
 * tarjeta hace volver, y sustituye a tres que salían a la vez en el Resumen y
 * no cuadraban entre sí («Vuelven en 14 días», «Volvieron» del embudo y las
 * cohortes, cuya semana 1 salía casi siempre al 100 % porque contaba el estreno).
 *
 * El problema de contar «cuántos han vuelto» a secas es que quien la estrenó
 * ayer aún no ha tenido tiempo, y una tienda que crece parece que no hace
 * volver a nadie. Por eso es una curva de Kaplan-Meier: cada cliente cuenta
 * mientras se le ha podido seguir (su edad desde el estreno) y, a partir de
 * ahí, sale del cálculo sin restar. El punto del día 7 es «de cada 100 que la
 * estrenan, cuántos han vuelto a la semana», aunque la mitad la estrenara ayer.
 *
 * Volver es una visita aparte (soloVisitas: a más de `horasVisita` de la
 * anterior). Solo cuenta quien se dio de alta dentro del historial que llega:
 * de los de antes no se sabe cuándo fue su estreno. La curva se corta el día en
 * que quedan pocos seguidos tanto tiempo (menos de `vueltaMinBase` o de la
 * parte `vueltaSeguidos` de todos): la cola de una curva así salta con una
 * sola persona. `listo` cuando llega a la semana. Si no, `faltanDias`: cuándo
 * llegará con los que ya hay (null si aún no hay estrenos bastantes).
 * @returns {{listo:boolean, base:number, faltanDias:number|null, hacenFalta:number, puntos:{dia:number, pct:number, seguidos:number}[]}}
 */
export function curvaDeVuelta(clientes, eventos, { ahora = Date.now(), historialDesde = null, dias = UMBRALES.vueltaCurvaDias } = {}) {
  const desde = historialDesde ?? Math.min(...(eventos || []).map((e) => ms(e.ts)).filter(Boolean));
  const dentro = new Set(clientes.filter((c) => ms(c.creado) >= desde).map((c) => c.serial));
  // Cada estreno: cuándo volvió (días) o, si no ha vuelto, cuánto se le ha seguido.
  const casos = [];
  for (const [serial, visitas] of visitasPorTarjeta(eventos)) {
    const edad = (ahora - visitas[0]) / DIA;
    if (!dentro.has(serial) || edad <= 0) continue;
    casos.push(visitas.length > 1 ? { t: (visitas[1] - visitas[0]) / DIA, volvio: true, edad } : { t: edad, volvio: false, edad });
  }

  const minimo = Math.max(UMBRALES.vueltaMinBase, Math.ceil(casos.length * UMBRALES.vueltaSeguidos));
  const vueltas = [...new Set(casos.filter((c) => c.volvio).map((c) => c.t))].sort((a, b) => a - b);
  const puntos = [];
  let sigue = 1; // la parte que aún no ha vuelto
  let i = 0;
  for (let dia = 0; dia <= dias; dia += 1) {
    const seguidos = casos.filter((c) => c.edad >= dia).length;
    if (seguidos < minimo) break;
    for (; i < vueltas.length && vueltas[i] <= dia; i += 1) {
      const t = vueltas[i];
      const enJuego = casos.filter((c) => c.t >= t).length;
      sigue *= 1 - casos.filter((c) => c.volvio && c.t === t).length / enJuego;
    }
    puntos.push({ dia, pct: Math.round((1 - sigue) * 100), seguidos });
  }

  const SEMANA_DIAS = 7;
  const listo = puntos.length > SEMANA_DIAS;
  // Cuándo tendrán una semana los que hacen falta (el `minimo`-ésimo estreno más antiguo).
  const edades = casos.map((c) => c.edad).sort((a, b) => b - a);
  const ultimoQueCuenta = edades[minimo - 1];
  return {
    listo,
    base: casos.length,
    faltanDias: listo || ultimoQueCuenta === undefined ? null : Math.max(1, Math.ceil(SEMANA_DIAS - ultimoQueCuenta)),
    // A cuántos hay que haber seguido una semana para que salga.
    hacenFalta: minimo,
    puntos,
  };
}

/**
 * El camino de la tarjeta: la sacan, se la quedan, la estrenan en caja,
 * vuelven, llenan una cartilla y canjean. Cada paso sale de los del anterior,
 * así que nunca hay más gente en un escalón que en el de arriba (quien llenó la
 * cartilla de golpe con los sellos de papel, en una sola visita, no cuenta como
 * «llenó»: es raro y el embudo pregunta otra cosa, si la tarjeta hace volver).
 *
 * Empieza en TODAS las tarjetas, descartadas incluidas: la primera caída es
 * justo la de quien escaneó y se fue. El segundo escalón, «Se la quedaron»
 * (guardada en el teléfono o usada en caja), es la cifra de «Clientes»: así las
 * dos cuadran a la vista. Guardar el pase en el teléfono no es un escalón
 * propio: hay quien la usa sin Wallet.
 *
 * En un cupón no hay cartilla que llenar y se usa en la primera visita: el
 * orden es estrenar, usarlo y, después, volver. Con «volver» delante, quien
 * usó el cupón y no volvió se caía del embudo y no cuadraba con la cifra de
 * «Cupones usados».
 *
 * `de` es cómo se dice el escalón como origen del siguiente: «62 % de los que
 * la estrenaron». Así el porcentaje dice de qué es sin pasar el ratón.
 * @returns {{key:string, label:string, de:string, n:number, paso:number|null}[]} `paso` = % del anterior
 */
export function embudo(todos) {
  const esCupon = todos.some((p) => p.esCupon);
  const sacaron = { key: "sacaron", label: "Sacaron la tarjeta", de: "la sacaron", incluye: () => true };
  const quedaron = { key: "quedaron", label: "Se la quedaron", de: "se la quedaron", incluye: (p) => !p.descartada };
  const estrenaron = { key: "estrenaron", label: "La estrenaron en caja", de: "la estrenaron", incluye: (p) => p.visitas >= 1 };
  const volvieron = { key: "volvieron", label: "Volvieron otra vez", de: "volvieron", incluye: (p) => p.visitas >= 2 };
  const canjearon = esCupon
    ? { key: "canjearon", label: "Usaron el cupón", de: "usaron el cupón", incluye: (p) => p.premios >= 1 }
    : { key: "canjearon", label: "Canjearon un premio", de: "canjearon", incluye: (p) => p.premios >= 1 };
  const llenaron = { key: "llenaron", label: "Llenaron una cartilla", de: "llenaron una cartilla", incluye: (p) => p.llenoAlgunaVez };
  const pasos = esCupon
    ? [sacaron, quedaron, estrenaron, canjearon, volvieron]
    : [sacaron, quedaron, estrenaron, volvieron, llenaron, canjearon];
  let quedan = todos;
  let antes = null;
  return pasos.map(({ key, label, de, incluye }) => {
    quedan = quedan.filter(incluye);
    const n = quedan.length;
    const paso = antes === null ? null : pct(n, antes);
    antes = n;
    return { key, label, de, n, paso };
  });
}

/**
 * Dónde se queda la cartilla: cuántos clientes hay con 1, 2, 3… sellos, cartilla
 * a cartilla, separando a los que siguen viniendo de los que se están alejando.
 * Si los que se alejan se amontonan en los primeros sellos, la meta queda lejos.
 * Los que están a cero (empiezan o acaban de canjear) van aparte, en `enCero`:
 * no dicen dónde se para nadie. Sin cartillas (cupón), lista vacía.
 * @returns {{indice:number, nombre:string, meta:number, premio:string, filas:{sellos:number, siguen:number, alejan:number}[],
 *   enCero:number, conPuntos:number, mitad:number|null, alejanMediana:number|null}[]}
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
    const todos = [];
    let enCero = 0;
    for (const c of conVisitas) {
      const { sellos } = cartillasDe(c, negocio)[indice];
      if (!sellos) { enCero += 1; continue; }
      const sigue = esActivo(porSerial.get(c.serial));
      filas[sellos - 1][sigue ? "siguen" : "alejan"] += 1;
      todos.push(sellos);
      if (!sigue) alejados.push(sellos);
    }
    const mitadDe = (xs) => (xs.length >= UMBRALES.vueltaMinBase ? Math.ceil(mediana(xs)) : null);
    return {
      // `indice` hace de clave: dos cartillas pueden llamarse igual.
      indice, nombre: cartilla.nombre, meta: cartilla.meta, premio: cartilla.premio, filas, enCero,
      conPuntos: todos.length,
      // «La mitad lleva N puntos o menos» y lo mismo de los que se alejan: con pocos, nada.
      mitad: mitadDe(todos),
      alejanMediana: mitadDe(alejados),
    };
  });
}

/** Cuándo empezó cada visita de cada tarjeta (soloVisitas), en ms y en orden. */
function visitasPorTarjeta(eventos) {
  const por = new Map();
  for (const e of soloVisitas(eventos)) {
    if (!por.has(e.serial)) por.set(e.serial, []);
    por.get(e.serial).push(ms(e.ts));
  }
  return por;
}

/**
 * La fila de un cliente tal y como estaba en `fecha`, para pasarla por perfilDe:
 * sus visitas de entonces son las de hoy menos las que hizo después, y su última
 * visita, la última de antes. Null si aún no tenía la tarjeta.
 *
 * Si hizo visitas después pero la última de antes queda fuera del historial, se
 * sabe que fue antes de `historialDesde`: se pone esa fecha, que ya lo deja
 * inactivo (por eso puenteActivos pide historial de sobra, `dormidoDias`).
 * Quien se dio de alta dentro del historial y no tiene visitas de antes, no
 * las tenía: un contador de los de antes (que sumaba cada sello) no se las inventa.
 */
function clienteEnFecha(c, visitas, fecha, historialDesde) {
  const alta = ms(c.creado);
  if (!alta || alta > fecha) return null;
  const despues = visitas.filter((t) => t > fecha).length;
  const previa = visitas.filter((t) => t <= fecha).at(-1);
  const cuantas = previa === undefined && alta >= historialDesde ? 0 : Math.max(0, (c.visitas || 0) - despues);
  const guardada = ms(c.ultima_visita);
  // Sin visitas después, la guardada sigue valiendo; con ellas, la última de antes.
  const ultima = !cuantas ? null
    : !despues && guardada ? Math.min(guardada, fecha)
      : previa ?? historialDesde;
  const instalado = ms(c.instalado);
  return {
    ...c,
    visitas: cuantas,
    ultima_visita: ultima ? new Date(ultima).toISOString() : null,
    instalado: instalado && instalado <= fecha ? c.instalado : null,
  };
}

/**
 * De dónde salen los activos de hoy: los que había hace `dias`, más los nuevos
 * (su primera visita fue en estos días), más los que volvieron (venían antes,
 * hace `dias` ya no, y hoy sí), menos los que se enfriaron (activos entonces y
 * hoy no). «Activo» es esActivo, el de la cifra de arriba, y hace `dias` se
 * mide igual: perfilDe con la fila de cada uno como estaba entonces
 * (clienteEnFecha). Así `hoy` es justo la cifra de «Activos».
 *
 * Para reconstruir el pasado hace falta el historial: las visitas posteriores
 * a la fecha y, para saber si alguien estaba ya inactivo, `dormidoDias` más
 * atrás. Si el que llega no lo cubre (el tope de eventos), no sale
 * (`motivo: "historial"`). Si la tienda no tenía aún clientes hace `dias`,
 * tampoco: un puente desde cero es la cifra de altas (`motivo: "joven"`).
 *
 * @param {object[]} clientes filas crudas, con `instalado` ya cruzado con los registros
 * @param {object[]} perfiles los de hoy (perfilDe), en el mismo orden o no
 * @returns {{dias:number, listo:false, motivo:"joven"|"historial", faltanDias?:number}
 *   | {dias:number, listo:true, antes:number, nuevos:number, volvieron:number, enfriados:number, hoy:number, siguen:number,
 *      pasos:{key:string, label:string, descripcion:string, n:number, signo:number, desde:number, hasta:number}[]}}
 */
export function puenteActivos(clientes, perfiles, eventos, negocio, { dias = UMBRALES.puenteDias, ahora = Date.now(), historialDesde = null } = {}) {
  const fecha = ahora - dias * DIA;
  const primera = Math.min(...clientes.map((c) => ms(c.creado)).filter(Boolean));
  if (!(primera <= fecha)) {
    const faltanDias = Number.isFinite(primera) ? Math.ceil((primera - fecha) / DIA) : dias;
    return { dias, listo: false, motivo: "joven", faltanDias };
  }
  if (historialDesde === null || historialDesde > fecha - UMBRALES.dormidoDias * DIA) {
    return { dias, listo: false, motivo: "historial" };
  }

  const visitas = visitasPorTarjeta(eventos);
  const activoHoy = new Map(perfiles.map((p) => [p.serial, esActivo(p)]));
  let antes = 0, nuevos = 0, volvieron = 0, enfriados = 0;
  for (const c of clientes) {
    const hoySi = activoHoy.get(c.serial) ?? false;
    const fila = clienteEnFecha(c, visitas.get(c.serial) || [], fecha, historialDesde);
    const entonces = fila ? perfilDe(fila, negocio, fecha) : null;
    const entoncesSi = esActivo(entonces);
    if (entoncesSi) antes += 1;
    if (entoncesSi && !hoySi) enfriados += 1;
    // Quien tenía la tarjeta sin estrenar también es nuevo: no vuelve, empieza.
    if (!entoncesSi && hoySi) {
      if (entonces?.visitas) volvieron += 1;
      else nuevos += 1;
    }
  }

  const tope = antes + nuevos + volvieron;
  const hoy = tope - enfriados;
  return {
    dias, listo: true, antes, nuevos, volvieron, enfriados, hoy,
    // De los que venían entonces, los que siguen: la frase de debajo del gráfico.
    siguen: antes - enfriados,
    // Las barras: los dos totales desde cero y, entre medias, cada cambio flotando
    // donde lo deja el anterior. Los nombres son los de la pantalla: «Siguen
    // viniendo» es la cifra de arriba; «Recuperados» y no «Volvieron», que en el
    // embudo es otra cosa (la segunda visita); «Se alejaron» como en la cartilla.
    pasos: [
      { key: "antes", label: `Hace ${dias} días`, descripcion: "Seguían viniendo", n: antes, signo: 0, desde: 0, hasta: antes },
      { key: "nuevos", label: "Nuevos", descripcion: `Empezaron a venir en estos ${dias} días`, n: nuevos, signo: 1, desde: antes, hasta: antes + nuevos },
      { key: "volvieron", label: "Recuperados", descripcion: "Habían dejado de venir y han vuelto", n: volvieron, signo: 1, desde: antes + nuevos, hasta: tope },
      { key: "enfriados", label: "Se alejaron", descripcion: "Ya no vienen a su ritmo", n: enfriados, signo: -1, desde: hoy, hasta: tope },
      { key: "hoy", label: "Hoy", descripcion: "Siguen viniendo", n: hoy, signo: 0, desde: 0, hasta: hoy },
    ],
  };
}

/**
 * Visitas por día, de hace `dias` hasta hoy, sin huecos (los días sin nada van
 * a cero: si no, el gráfico miente sobre las rachas malas). El día es el de la
 * TIENDA (`horario.zona`): con el de UTC, lo de pasada la medianoche caía en
 * el día anterior. Con horario, cada día dice si abrió: un cero de un día
 * cerrado no es un día malo.
 *
 * Con `desde` (la primera tarjeta de la tienda), la serie empieza ese día: una
 * tienda con dos semanas de fiddle no tiene «dos semanas muertas» antes, que es
 * lo que parecían los ceros. El último día es hoy, a medias (`hoy`): una barra
 * corta ahí no es una caída.
 * @returns {{dia:string, n:number, cerrado:boolean, hoy:boolean}[]}
 */
export function serieVisitas(eventos, dias = 30, ahora = Date.now(), horario = null, { desde = null } = {}) {
  const zona = horario?.zona || ZONA_POR_DEFECTO;
  const cuenta = new Map();
  for (const e of soloVisitas(eventos)) {
    const t = ms(e.ts);
    if (t < ahora - dias * DIA) continue;
    const dia = fechaLocal(t, zona);
    cuenta.set(dia, (cuenta.get(dia) || 0) + 1);
  }
  const hoy = fechaLocal(ahora, zona);
  const primero = desde ? fechaLocal(desde, zona) : null;
  return Array.from({ length: dias }, (_, i) => sumarDias(hoy, i - (dias - 1)))
    .filter((dia) => !primero || dia >= primero)
    .map((dia) => ({ dia, n: cuenta.get(dia) || 0, cerrado: horario ? !abreEl(horario, dia) : false, hoy: dia === hoy }));
}

/**
 * Cuándo viene la gente: rejilla día de la semana × hora, con la hora de la
 * TIENDA (`horario.zona`), como la serie de días. Antes iba con la del
 * navegador y, mirada desde otro huso, las dos gráficas no cuadraban.
 *
 * `media` es lo que viene UN día normal de esos a esa hora: las visitas entre
 * las veces que ese día de la semana ha abierto (`veces`; un festivo no cuenta).
 * Con la suma a secas, en una tienda de dos semanas y media el día que había
 * salido tres veces pesaba un 50 % más que el que había salido dos, y «lo más
 * tranquilo» salía del calendario, no de la gente. Solo días enteros: hoy aún
 * no ha acabado. `visitas` es la suma, por si hace falta contar.
 * @returns {{media:number[][], visitas:number[][], veces:number[]}} 7 filas (lunes..domingo) × 24 horas
 */
export function rejillaHoraria(eventos, { horario = null, ahora = Date.now() } = {}) {
  const zona = horario?.zona || ZONA_POR_DEFECTO;
  const hoy = fechaLocal(ahora, zona);
  const visitas = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let primera = null;
  for (const e of soloVisitas(eventos)) {
    const { fecha, dia, minutos } = relojLocal(ms(e.ts), zona);
    if (fecha >= hoy) continue;
    primera ??= fecha; // soloVisitas va en orden: la primera es la más vieja
    visitas[dia][Math.floor(minutos / 60)] += 1;
  }
  const veces = new Array(7).fill(0);
  for (let f = primera, n = 0; f && f < hoy && n < 400; f = sumarDias(f, 1), n += 1) {
    if (!horario || abreEl(horario, f)) veces[diaDeFecha(f)] += 1;
  }
  const media = visitas.map((fila, d) => fila.map((n) => n / Math.max(1, veces[d])));
  return { media, visitas, veces };
}

/**
 * Lo que se dice de la serie de días: la media de los días que abrió (enteros:
 * hoy no cuenta, y un día cerrado sin nadie no baja la media) y el mejor.
 * @returns {{media:number|null, mejor:{dia:string, n:number}|null, dias:number}}
 */
export function resumenSerie(serie) {
  const abiertos = serie.filter((d) => !d.hoy && !(d.cerrado && !d.n));
  if (!abiertos.length) return { media: null, mejor: null, dias: 0 };
  const mejor = abiertos.reduce((m, d) => (d.n > m.n ? d : m));
  return { media: abiertos.reduce((a, d) => a + d.n, 0) / abiertos.length, mejor: mejor.n ? mejor : null, dias: abiertos.length };
}

/**
 * Qué enseña la rejilla: de la primera hora que abre a la última que cierra en
 * la semana ([desde, hasta), en horas enteras), los días que nunca abre y, hora
 * a hora, si ese día está abierta (`abierta[dia][hora]`): una casilla vacía de
 * una hora abierta es que no vino nadie; la de una hora cerrada no dice nada, y
 * no deben parecerse. Sin horario, null y ninguno: salen las horas con visitas.
 * @returns {{horas:[number, number]|null, cerrados:number[], abierta:boolean[][]|null}}
 */
export function horarioDeRejilla(horario) {
  if (!horario) return { horas: null, cerrados: [], abierta: null };
  // Una semana cualquiera (el 1 de enero de 2024 fue lunes), sin festivos: solo importa el día.
  const semana = Array.from({ length: 7 }, (_, d) => tramosDe({ ...horario, cerrados: [] }, sumarDias("2024-01-01", d)));
  const tramos = semana.flat();
  return {
    horas: tramos.length
      ? [Math.floor(Math.min(...tramos.map((t) => t.abre)) / 60), Math.ceil(Math.max(...tramos.map((t) => t.cierra)) / 60)]
      : null,
    cerrados: semana.flatMap((t, d) => (t.length ? [] : [d])),
    abierta: semana.map((t) => Array.from({ length: 24 }, (_, h) => t.some((x) => x.abre < (h + 1) * 60 && x.cierra > h * 60))),
  };
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
