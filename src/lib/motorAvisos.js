import {
  getNegocio, listNegocios, listClientes, serialesRegistrados, listEventosDeNegocio, listCampanas,
  guardarMensajes, crearCampana, addEventos, registrarIntento, ultimoIntento,
} from "./store";
import { avisarSeriales } from "./wallet";
import { perfilDe, conteoGrupos, efectoCampana, TIPOS_VISITA, LISTA_GRUPOS } from "./crm";
import { relojLocal } from "./horario";
import {
  contextoDe, fechasDeVisita, enviosDe, conEnvio, elegibles, candidatos, tocaAhora, porRetirar,
  renderTexto, grupoDeRegla, etiquetaEnvio, MAX_POR_REGLA,
} from "./automatizaciones";

// ============================================================================
// EL MOTOR DE LOS AVISOS AUTOMÁTICOS
// ----------------------------------------------------------------------------
// Lo llama un reloj de fuera (/api/cron/avisos) cada pocos minutos. En cada
// pasada, por tienda: quita los mensajes de un día que ya caducaron y manda
// las reglas a las que les toca (lib/automatizaciones.js decide quién).
//
// Es IDEMPOTENTE: da igual si el reloj pasa cada 5 minutos o cada 15, o si pasa
// dos veces seguidas. Lo que ya se mandó queda en `campanas` (grupo
// `auto:<regla>`) y eso es lo que impide repetirlo. Por eso no hace falta
// guardar "la regla X ya corrió hoy".
//
// El envío es el de una campaña: el texto se escribe en el pase de cada uno y
// se avisa por todos los canales (lib/wallet.js). Nunca lanza hacia fuera: una
// tienda o una regla que falle no para a las demás.
// ============================================================================

const DIA = 24 * 60 * 60 * 1000;
/** Lo que deja el reloj en `intentos` a cada pasada: la pantalla lo mira para saber si anda. */
export const CLAVE_RELOJ = "reloj:avisos";
const HISTORIAL_DIAS = 365;   // "¿ya se lo dijimos?" mira un año atrás
const LIMITE_CAMPANAS = 1000; // lo que devuelve Supabase de una vez
const EVENTOS_DIAS = 120;     // como el CRM: rachas y "¿volvió?"

/** Campañas del último año de una tienda, manuales y automáticas. */
const historial = (slug, ahora) =>
  listCampanas(slug, { desde: new Date(ahora - HISTORIAL_DIAS * DIA).toISOString(), limite: LIMITE_CAMPANAS });

/**
 * Clientes de la tienda con todo lo que preguntan las reglas. `contactable`
 * es "tiene la tarjeta en un teléfono AHORA" (un registro vivo), igual que
 * el filtro de una campaña: no basta con que la instalara alguna vez.
 */
async function cargarClientes(negocio, ahora) {
  const slug = negocio.slug;
  const zona = negocio.horario?.zona;
  const [clientes, registrados, eventos] = await Promise.all([
    listClientes(slug),
    serialesRegistrados(slug),
    listEventosDeNegocio(slug, { dias: EVENTOS_DIAS }),
  ]);
  const hoy = relojLocal(ahora, zona).fecha;
  const fechas = fechasDeVisita(eventos, TIPOS_VISITA, zona);
  const contextos = clientes.map((c) => {
    const vivo = registrados.has(c.serial);
    const conRegistro = { ...c, instalado: c.instalado || (vivo ? c.creado : null), desinstalado: vivo ? null : c.desinstalado };
    const perfil = { ...perfilDe(conRegistro, negocio, ahora), contactable: vivo };
    return contextoDe(c, perfil, negocio, { fechas: fechas.get(c.serial), hoy });
  });
  return { clientes, contextos, eventos };
}

/** Escribe un texto en el pase de varios clientes, avisa y lo deja apuntado. */
async function mandar(negocio, regla, texto, seriales) {
  await guardarMensajes(seriales, texto);
  const aviso = await avisarSeriales(seriales, { negocio, texto });
  await crearCampana({ negocio: negocio.slug, grupo: grupoDeRegla(regla.id), texto, seriales, avisados: aviso.avisados });
  await addEventos(seriales.map((serial) => ({
    serial, tipo: "campana", mensaje: `Aviso automático «${texto}»`, negocio: negocio.slug, actor: "automatico",
  })));
  return aviso;
}

/** Manda UNA regla a quien le toque. Cada cliente recibe su texto (con su premio, sus días…). */
async function mandarRegla(negocio, regla, contextos, envios, ahora) {
  const lista = elegibles(regla, contextos, envios, { ahora, pausaDias: negocio.pausaAvisos }).slice(0, MAX_POR_REGLA);
  const porTexto = new Map();
  for (const x of lista) {
    const texto = renderTexto(regla.texto, x.vars);
    porTexto.set(texto, [...(porTexto.get(texto) || []), x.serial]);
  }
  const total = { regla: regla.id, destinatarios: lista.length, avisados: 0, web: 0, google: 0 };
  for (const [texto, seriales] of porTexto) {
    const aviso = await mandar(negocio, regla, texto, seriales);
    total.avisados += aviso.avisados || 0;
    total.web += aviso.web || 0;
    total.google += aviso.google || 0;
  }
  return { total, seriales: lista.map((x) => x.serial) };
}

/** Quita de los pases los mensajes de un solo día que ya pasaron (la racha de hoy, mañana no). */
async function retirarCaducados(negocio, campanas, clientes, ahora) {
  const mensajes = new Map(clientes.map((c) => [c.serial, c.mensaje]));
  let retirados = 0;
  for (const { seriales } of porRetirar(campanas, negocio.automatizaciones, mensajes, negocio.horario, ahora)) {
    retirados += await guardarMensajes(seriales, null);
    // Sin texto: el pase se pone al día en silencio (Android no suena).
    await avisarSeriales(seriales, { negocio, texto: null });
  }
  return retirados;
}

/**
 * Una pasada por UNA tienda. `soloRegla`: manda esa regla ya, sin mirar la hora
 * (el botón "Enviar ahora" del manager); lo demás (a quién, no repetir, la
 * pausa) se respeta igual.
 * @returns {Promise<{negocio:string, retirados:number, envios:object[]}>}
 */
export async function repasarNegocio(negocio, { ahora = Date.now(), soloRegla = null } = {}) {
  const reglas = negocio.automatizaciones || [];
  const reloj = relojLocal(ahora, negocio.horario?.zona);
  // Sin horario no sale nada solo: una tienda que nadie ha configurado (o una de
  // prueba) no puede empezar a avisar a sus clientes a cualquier hora. A mano
  // ("Enviar ahora") sí, porque lo pide el manager.
  const tocan = soloRegla
    ? reglas.filter((r) => r.id === soloRegla)
    : negocio.horario ? reglas.filter((r) => r.activa && tocaAhora(r, negocio.horario, reloj)) : [];
  const resultado = { negocio: negocio.slug, retirados: 0, envios: [] };

  const campanas = await historial(negocio.slug, ahora);
  const hayQueRetirar = porRetirar(campanas, reglas, null, negocio.horario, ahora).length > 0;
  if (!tocan.length && !hayQueRetirar) return resultado;

  const { clientes, contextos } = await cargarClientes(negocio, ahora);
  if (hayQueRetirar) resultado.retirados = await retirarCaducados(negocio, campanas, clientes, ahora);

  let envios = enviosDe(campanas);
  // En el pase cabe UN mensaje: en la misma pasada, a quien ya le llegó una
  // regla no le llega otra (taparía la primera), aunque la pausa sea 0.
  const tocados = new Set();
  for (const regla of tocan) {
    try {
      const libres = contextos.filter((x) => !tocados.has(x.serial));
      const { total, seriales } = await mandarRegla(negocio, regla, libres, envios, ahora);
      envios = conEnvio(envios, regla.id, seriales, ahora);
      seriales.forEach((s) => tocados.add(s));
      resultado.envios.push(total);
    } catch (e) {
      console.error(`[avisos] ${negocio.slug}/${regla.id} falló:`, e);
      resultado.envios.push({ regla: regla.id, error: String(e?.message || e) });
    }
  }
  return resultado;
}

/**
 * Pasada completa: todas las tiendas. Deja el latido primero, así la pantalla
 * sabe que el reloj anda aunque hoy no toque nada.
 */
export async function repasarTodas({ ahora = Date.now() } = {}) {
  await registrarIntento(CLAVE_RELOJ).catch((e) => console.error("[avisos] no se pudo apuntar el latido:", e));
  const resultados = [];
  for (const negocio of await listNegocios()) {
    try {
      resultados.push(await repasarNegocio(negocio, { ahora }));
    } catch (e) {
      console.error(`[avisos] ${negocio.slug} falló:`, e);
      resultados.push({ negocio: negocio.slug, error: String(e?.message || e) });
    }
  }
  return resultados;
}

// --------------------------------------------------------- para la pantalla
/**
 * Todo lo que pinta la pestaña Avisos, o null si la tienda no existe. Lo usan
 * la página (en el servidor) y /api/automatizaciones (tras guardar o enviar).
 *
 * Los contextos van al navegador para que, al cambiar "21 días" por "14", la
 * pantalla diga al momento a cuántos les llegaría. Es lo mismo que ya ve el
 * manager en Clientes; nada de tokens ni de notas.
 */
export async function datosAvisos(slug, ahora = Date.now()) {
  const negocio = await getNegocio(slug);
  if (!negocio) return null;
  const [{ contextos, eventos }, campanas, ultimo] = await Promise.all([
    cargarClientes(negocio, ahora),
    historial(slug, ahora),
    ultimoIntento(CLAVE_RELOJ).catch(() => null),
  ]);
  const envios = enviosDe(campanas);
  const reglas = negocio.automatizaciones;
  return {
    negocio: {
      slug: negocio.slug, nombre: negocio.nombre, tipo: negocio.tipo, meta: negocio.meta, premio: negocio.premio,
      cartillas: negocio.cartillas ?? null, tema: negocio.tema, promo: negocio.promo,
      horario: negocio.horario, automatizaciones: reglas, pausaAvisos: negocio.pausaAvisos,
    },
    contextos,
    envios: { porRegla: [...envios.porRegla], ultimo: [...envios.ultimo] },
    conteos: Object.fromEntries(reglas.map((r) => [r.id, {
      encajan: candidatos(r, contextos).length,
      llegaria: elegibles(r, contextos, envios, { ahora, pausaDias: negocio.pausaAvisos }).length,
    }])),
    grupos: conteoGrupos(contextos.map((x) => x.perfil)),
    catalogoGrupos: LISTA_GRUPOS,
    total: contextos.length,
    contactables: contextos.filter((x) => x.perfil.contactable).length,
    historial: campanas.slice(0, 40).map((c) => ({
      id: c.id, grupo: c.grupo, etiqueta: etiquetaEnvio(c.grupo, reglas), automatico: c.grupo.startsWith("auto:"),
      texto: c.texto, creado: c.creado, destinatarios: c.destinatarios, avisados: c.avisados,
      ...efectoCampana(c, eventos),
    })),
    reloj: { ultimo },
  };
}
