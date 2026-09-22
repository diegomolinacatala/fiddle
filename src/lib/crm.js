// ============================================================================
// CRM — QUIÉN ES CADA CLIENTE, SIN MIRAR LA BASE
// ----------------------------------------------------------------------------
// Funciones PURAS (sin imports, como resumen.js): estado guardado -> perfil,
// perfil -> grupo. Las usan la API, el panel del manager y la vista de la
// plataforma, así que la cuenta es LA MISMA en los tres sitios.
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

const DIA = 24 * 60 * 60 * 1000;

/** Qué evento significa "el cliente estuvo en la tienda". `restar` es una corrección, no una visita. */
export const TIPOS_VISITA = ["sellar", "canjear", "confirmar", "sellar2", "canjear2"];

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
};

const dias = (desde, hasta) => (desde && hasta ? Math.max(0, (hasta - desde) / DIA) : null);
const ms = (v) => (v ? Date.parse(v) || null : null);

/**
 * Todo lo que se puede decir de un cliente a partir de lo guardado, sin tocar
 * el historial: las columnas `visitas` / `ultima_visita` ya son ese resumen.
 *
 * La CADENCIA es el hueco medio entre visitas. Sale de (última − alta) ÷ huecos,
 * que es exactamente la media de los huecos si el alta coincidió con la primera
 * visita — y coincide: el pase se emite en el mostrador, con el cliente delante.
 * Con una visita o ninguna no hay ritmo que medir y vale `null`.
 *
 * @param {object} cliente fila de `clientes`
 * @param {object} negocio ficha del negocio (meta, tipo)
 * @param {number} [ahora]
 */
export function perfilDe(cliente, negocio, ahora = Date.now()) {
  const alta = ms(cliente.creado);
  const ultima = ms(cliente.ultima_visita);
  const visitas = cliente.visitas || 0;

  const cadencia = visitas > 1 && ultima && alta ? dias(alta, ultima) / (visitas - 1) : null;
  // Sin visitas, el reloj corre desde el alta: un pase emitido hace un año y
  // nunca usado lleva un año sin usarse, no "cero días".
  const diasSinVenir = dias(ultima || alta, ahora);
  const retraso = cadencia && cadencia > 0 && diasSinVenir !== null ? diasSinVenir / cadencia : null;

  const meta = negocio?.meta ?? 0;
  const esCupon = negocio?.tipo === "descuento";
  const faltan = esCupon ? 0 : Math.max(0, meta - (cliente.sellos || 0));

  const perfil = {
    serial: cliente.serial,
    visitas,
    premios: cliente.premios || 0,
    sellos: cliente.sellos || 0,
    faltan,
    completa: !esCupon && meta > 0 && faltan === 0,
    esCupon,
    diasDesdeAlta: dias(alta, ahora),
    diasSinVenir,
    cadencia,
    retraso,
    // Sin pase instalado no hay a dónde mandar el aviso: es el límite de todo esto.
    contactable: Boolean(cliente.instalado && !cliente.desinstalado),
    instalado: Boolean(cliente.instalado),
  };
  perfil.estado = estadoDe(perfil);
  return perfil;
}

// ------------------------------------------------------ la escalera (excluyentes)
export const ESTADOS = {
  fantasma: { label: "Fantasma", icon: "fantasma", color: "#8b929e", descripcion: "Se llevó el pase y no volvió a usarlo nunca." },
  nuevo:    { label: "Nuevo",    icon: "brote", color: "#2563eb", descripcion: "Llegó hace poco y todavía no tiene costumbre." },
  activo:   { label: "Activo",   icon: "llama", color: "#136f3a", descripcion: "Viene a su ritmo, sin retraso." },
  riesgo:   { label: "Enfriándose", icon: "copo", color: "#c26b04", descripcion: "Ha roto su ritmo: lleva más de lo suyo sin aparecer." },
  dormido:  { label: "Dormido",  icon: "luna", color: "#8a5cf6", descripcion: "Un par de meses sin pasar." },
  perdido:  { label: "Perdido",  icon: "puerta", color: "#b42318", descripcion: "Tanto tiempo fuera que ya no cuenta como cliente." },
};

export const LISTA_ESTADOS = Object.entries(ESTADOS).map(([key, v]) => ({ key, ...v }));

/**
 * En qué escalón está. El orden de las preguntas ES la definición: primero
 * quien nunca usó el pase, luego quien acaba de llegar (a ese no se le puede
 * exigir ritmo todavía), y después el reloj.
 */
export function estadoDe(p) {
  if (!p.visitas) return "fantasma";
  if (p.diasDesdeAlta !== null && p.diasDesdeAlta <= UMBRALES.nuevoDias && p.visitas < UMBRALES.nuevoVisitas) {
    return "nuevo";
  }
  const d = p.diasSinVenir ?? 0;
  if (d > UMBRALES.perdidoDias) return "perdido";
  if (d > UMBRALES.dormidoDias) return "dormido";
  // Con ritmo conocido manda el ritmo; sin él, el mes de gracia de siempre.
  if (p.retraso !== null) return p.retraso > UMBRALES.retraso ? "riesgo" : "activo";
  return d > UMBRALES.nuevoDias ? "riesgo" : "activo";
}

// ------------------------------------------------- los bloques (se solapan)
// Cada grupo es una entrada con `incluye(perfil)`. Añadir uno nuevo = añadir
// una entrada aquí: sale solo en el panel, en el selector de campañas y en la
// exportación, sin tocar nada más.
export const GRUPOS = {
  a_punto: {
    label: "A un paso del premio",
    icon: "diana",
    descripcion: "Les falta poco para completar la cartilla. El empujón que mejor funciona.",
    idea: "Te falta 1 para tu {premio}",
    incluye: (p) => !p.esCupon && p.visitas > 0 && !p.completa && p.faltan <= UMBRALES.aPuntoFaltan,
  },
  premio_listo: {
    label: "Premio sin recoger",
    icon: "regalo",
    descripcion: "Tienen la cartilla llena y no han venido a por el premio.",
    idea: "Tu {premio} te está esperando",
    incluye: (p) => p.completa,
  },
  fieles_frios: {
    label: "Fieles que se enfriaron",
    icon: "corazonRoto",
    descripcion: "Venían seguido y llevan semanas sin aparecer. El grupo que más duele y el que más vale recuperar.",
    idea: "Hace tiempo que no te vemos. Tu próximo café, invita la casa",
    incluye: (p) => p.visitas >= UMBRALES.fielVisitas && ["riesgo", "dormido", "perdido"].includes(p.estado),
  },
  riesgo: {
    label: "Se están enfriando",
    icon: "copo",
    descripcion: "Han roto su propio ritmo: llevan más tiempo del suyo sin venir.",
    idea: "¿Te vienes esta semana? Te guardamos algo",
    incluye: (p) => p.estado === "riesgo",
  },
  habituales: {
    label: "Habituales",
    icon: "llama",
    descripcion: "Vienen a su ritmo y ya llevan unas cuantas. Los de casa.",
    idea: "Gracias por estar siempre. Hoy, algo extra",
    incluye: (p) => p.estado === "activo" && p.visitas >= UMBRALES.nuevoVisitas,
  },
  nuevos: {
    label: "Recién llegados",
    icon: "brote",
    descripcion: "Se dieron de alta hace poco. Aún no son clientes: hay que convertirlos.",
    idea: "Bienvenido. Tu segunda visita lleva regalo",
    incluye: (p) => p.estado === "nuevo",
  },
  dormidos: {
    label: "Dormidos",
    icon: "luna",
    descripcion: "Llevan dos meses o más sin pasar por la tienda.",
    idea: "Te echamos de menos. Vuelve y te invitamos",
    incluye: (p) => ["dormido", "perdido"].includes(p.estado),
  },
  fantasmas: {
    label: "Nunca lo usaron",
    icon: "fantasma",
    descripcion: "Se llevaron el pase y jamás lo enseñaron. O no entendieron para qué era.",
    idea: "Enseña esta tarjeta en caja y empieza a sumar",
    incluye: (p) => p.visitas === 0,
  },
  campeones: {
    label: "Campeones",
    icon: "trofeo",
    descripcion: "Los que más han canjeado. Merecen que se les trate distinto.",
    idea: "Eres de los nuestros. Pásate: tenemos algo para ti",
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
      contactables: dentro.filter((p) => p.contactable).length,
    };
  });
}

// ------------------------------------------------------------------ números
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/**
 * Las cifras de cabecera. `eventos` solo hace falta para contar visitas por
 * ventana de tiempo; todo lo demás sale del resumen que llevan los clientes.
 *
 * @param {object[]} perfiles  de perfilDe()
 * @param {object[]} eventos   [{tipo, ts}] del negocio
 * @param {object[]} clientes  filas crudas (para altas por fecha)
 */
export function metricas(perfiles, eventos, clientes, ahora = Date.now()) {
  const visitas = eventos.filter((e) => TIPOS_VISITA.includes(e.tipo));
  const enVentana = (lista, desdeDias, hastaDias = 0) =>
    lista.filter((e) => {
      const t = ms(e.ts || e.creado);
      return t && t > ahora - desdeDias * DIA && t <= ahora - hastaDias * DIA;
    }).length;

  const total = perfiles.length;
  const porEstado = Object.fromEntries(
    Object.keys(ESTADOS).map((k) => [k, perfiles.filter((p) => p.estado === k).length]),
  );
  const cadencias = perfiles.map((p) => p.cadencia).filter((c) => c !== null && c > 0);

  return {
    total,
    porEstado,
    // Activo = viene a su ritmo. No es "vino en los últimos 30 días": quien pasa
    // una vez al trimestre y está en fecha también es un cliente vivo.
    activos: porEstado.activo,
    enRiesgo: porEstado.riesgo,
    nuevos30: enVentana(clientes, 30),
    nuevos30Previos: enVentana(clientes, 60, 30),
    visitas30: enVentana(visitas, 30),
    visitas30Previas: enVentana(visitas, 60, 30),
    premios: perfiles.reduce((a, p) => a + p.premios, 0),
    // Embudo de instalación: de los pases emitidos, cuántos llegaron a un Wallet.
    instalados: perfiles.filter((p) => p.instalado).length,
    contactables: perfiles.filter((p) => p.contactable).length,
    tasaInstalacion: pct(perfiles.filter((p) => p.instalado).length, total),
    // ¿Vuelve la gente? Una tarjeta que nadie usa dos veces no está funcionando.
    repiten: perfiles.filter((p) => p.visitas >= 2).length,
    tasaVuelta: pct(perfiles.filter((p) => p.visitas >= 2).length, total),
    cadenciaMedia: media(cadencias),
    visitasPorCliente: media(perfiles.map((p) => p.visitas)),
  };
}

/** Variación porcentual entre dos periodos, para las flechitas. `null` si no había con qué comparar. */
export const tendencia = (ahora, antes) => (antes ? Math.round(((ahora - antes) / antes) * 100) : null);

/**
 * Visitas por día, de hace `dias` hasta hoy, sin huecos (los días sin nada van
 * a cero: si no, el gráfico miente sobre las rachas malas).
 * @returns {{dia:string, n:number}[]}
 */
export function serieVisitas(eventos, dias = 30, ahora = Date.now()) {
  const cuenta = new Map();
  for (const e of eventos) {
    if (!TIPOS_VISITA.includes(e.tipo)) continue;
    const t = ms(e.ts);
    if (!t || t < ahora - dias * DIA) continue;
    const dia = new Date(t).toISOString().slice(0, 10);
    cuenta.set(dia, (cuenta.get(dia) || 0) + 1);
  }
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(ahora - (dias - 1 - i) * DIA).toISOString().slice(0, 10);
    return { dia, n: cuenta.get(dia) || 0 };
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
  for (const e of eventos) {
    if (!TIPOS_VISITA.includes(e.tipo)) continue;
    const t = ms(e.ts);
    if (!t) continue;
    const d = new Date(t);
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
    .map(([mes, ps]) => {
      const dentro = ps.filter(Boolean);
      const vivos = dentro.filter((p) => ["activo", "nuevo"].includes(p.estado)).length;
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
