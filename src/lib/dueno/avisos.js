// ============================================================================
// EL AVISO DEL DÍA PARA EL DUEÑO
// ----------------------------------------------------------------------------
// De «lo que dicen los números» (lib/observaciones.js), la primera idea que se
// pueda hacer HOY, sin repetirse ni agobiar. Nada se manda solo a los clientes:
// la tarjeta lleva al dueño a Avisos → Enviar ya relleno y él decide. PURO.
// ============================================================================

import { enlaceDeAccion } from "../observaciones";
import { tiene } from "../planes";
import { funcionDeDestino } from "../envios";
import { relojLocal, sumarDias, inicioDelDia, aMinutos } from "../horario";
import { zonaDe } from "../actividad";

export const PAUSA_MISMO_AVISO_DIAS = 14;
export const MAX_AVISOS_SEMANA = 2;
const MAX_CARACTERES = 110;

const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Una de tipo "enviar" con día solo se puede programar hoy y si su hora aún no ha llegado.
 * Con una hora que no se entiende («24:00») no hay aviso que preparar: no vale.
 */
function valeHoy(accion, reloj) {
  if (accion.tipo !== "enviar") return true;
  const hora = aMinutos(accion.hora);
  if (accion.hora && hora === null) return false;
  if (!Number.isInteger(accion.dia)) return true;
  if (accion.dia !== reloj.dia) return false;
  return hora === null || hora > reloj.minutos;
}

const coletilla = (accion) =>
  accion.tipo === "enviar" && accion.hora
    ? `Te hemos preparado un aviso para hoy a las ${accion.hora}.`
    : "Te hemos preparado un aviso para ellos.";

/** Cabe `n` letras: se corta en el último espacio, sin tirar una palabra entera ni dejar una a medias. */
function cortarEnPalabra(frase, n) {
  const trozo = frase.slice(0, Math.max(0, n));
  const palabraEntera = n >= frase.length || /\s/.test(frase[n]);
  const corte = palabraEntera ? trozo : trozo.replace(/\s*\S*$/, "") || trozo;
  return corte.replace(/[\s,.;:]+$/, "");
}

/** Se acorta la frase de la observación, nunca la coletilla. */
function textoDelAviso(o) {
  const cola = coletilla(o.accion);
  const frase = o.texto.trim();
  const sitio = MAX_CARACTERES - cola.length - 1;
  if (frase.length <= sitio) return `${frase} ${cola}`;
  // Un carácter menos: ahí va la «…».
  return `${cortarEnPalabra(frase, sitio - 1)}… ${cola}`;
}

/** Cuántas cosas se le han dicho en la semana local de `hoy` (lunes a domingo). */
function avisosDeLaSemana(avisados, hoy, dia) {
  const lunes = sumarDias(hoy, -dia);
  const domingo = sumarDias(lunes, 6);
  return Object.values(avisados).filter((f) => f >= lunes && f <= domingo).length;
}

export function avisoDelDia({ observaciones, negocio, ahora = Date.now(), avisados = {}, base = "" }) {
  const zona = zonaDe(negocio);
  const reloj = relojLocal(ahora, zona);
  if (avisosDeLaSemana(avisados, reloj.fecha, reloj.dia) >= MAX_AVISOS_SEMANA) return null;

  const elegida = (observaciones || []).find((o) => {
    const a = o.accion;
    if (!a || (a.tipo !== "enviar" && a.tipo !== "grupo")) return false;
    if (!valeHoy(a, reloj)) return false;
    if (!tiene(negocio, funcionDeDestino(a.grupo))) return false;
    const dicho = avisados[o.id];
    return !dicho || diasEntre(dicho, reloj.fecha) >= PAUSA_MISMO_AVISO_DIAS;
  });
  if (!elegida) return null;

  return {
    id: elegida.id,
    texto: textoDelAviso(elegida),
    enlace: base + enlaceDeAccion(negocio.slug, elegida.accion, elegida.texto),
    hasta: new Date(inicioDelDia(sumarDias(reloj.fecha, 1), zona)).toISOString(),
  };
}
