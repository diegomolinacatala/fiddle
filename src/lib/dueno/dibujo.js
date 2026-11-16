import { LACRE, svgLacre, svgIconoLacre } from "../lacre";
import { PALETA } from "../../app/home/paleta";
import { svgTexto, anchoTexto } from "../apple/texto";
import { WALLET } from "../vistaWallet";
import { textoComparado } from "./informe";

// ============================================================================
// LA TARJETA DEL DUEÑO — dibujo (SVG puro)
// ----------------------------------------------------------------------------
// La banda enseña la semana de un vistazo: el número de visitas a la izquierda y,
// a la derecha, una barra por día. Va DIBUJADA (nada de <text>: en serverless no
// hay fuentes; las letras son contornos, lib/apple/texto.js) y así se ve igual en
// todos los iPhone. Los colores son los de fiddle, no los de la tienda.
// ============================================================================

const ANCHO = 375;
const ALTO = 123;

// Lo que el iPhone enseña de la banda. El PNG es de 375x123, pero Wallet lo pinta a
// WALLET.banda (139) de alto en una tarjeta de WALLET.ancho (360): escala 139/123 y
// recorta los lados. De ancho solo se ven 360/1,13 = 318,6 puntos del lienzo: se
// pierden ~28 por cada lado, y el margen de la tarjeta (16 puntos de Wallet) son otros
// ~14 del lienzo. Por eso el contenido va entre X0 y X1 (~42 y ~333) y no entre 16 y 359:
// así el número y las barras quedan alineados con el logo, la cabecera y los campos.
const ESCALA_WALLET = WALLET.banda / ALTO;
const X0 = (ANCHO - WALLET.ancho / ESCALA_WALLET) / 2 + WALLET.margen / ESCALA_WALLET;
const X1 = ANCHO - X0;

// Fondo de la banda: el verde de la tarjeta, un punto más hondo (mezclado con el
// espresso). Liso: sin degradados ni adornos.
const PARTE_ESPRESSO = 0.3;
const mezclar = (a, b, t) => {
  const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(canal(a, i) * (1 - t) + canal(b, i) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

export const COLORES_DUENO = {
  fondo: PALETA.verde,
  texto: PALETA.papel,
  etiqueta: PALETA.avena,
  barra: PALETA.avena,
  barraMejor: PALETA.papel,
};

const FONDO_BANDA = mezclar(PALETA.verde, PALETA.espresso, PARTE_ESPRESSO);

// Zona de las cifras (izquierda) y de las barras (derecha).
const IZQ = { x: X0, hasta: 160 };
const DER = { x: 178, hasta: X1 };
// Línea base compartida: la del número grande y la de todas las barras.
const BASE = 94;
const BASE_INICIALES = 110;
const ALTO_MAX_BARRA = 62;
const ALTO_MIN_BARRA = 3;
const ANCHO_BARRA = 12;
const OPACIDAD_BARRA = 0.45;
const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];
const TAM_NUMERO = 46;

// Barra con las esquinas de arriba redondeadas, apoyada en la base.
function trazoBarra(x, alto) {
  const r = Math.min(4, alto);
  const y = BASE - alto;
  const f = (n) => +n.toFixed(2);
  return `M${f(x)} ${BASE}L${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}`
    + `L${f(x + ANCHO_BARRA - r)} ${f(y)}Q${f(x + ANCHO_BARRA)} ${f(y)} ${f(x + ANCHO_BARRA)} ${f(y + r)}`
    + `L${f(x + ANCHO_BARRA)} ${BASE}Z`;
}

function barras(informe) {
  const dias = informe.porDia || [];
  const maximo = Math.max(1, ...dias.map((d) => d.n || 0));
  // La primera barra empieza en DER.x y la última acaba en DER.hasta, como los campos de abajo.
  const paso = (DER.hasta - DER.x - ANCHO_BARRA) / 6;
  const mejor = informe.mejorDia?.d;
  const piezas = dias.slice(0, 7).map((dia, i) => {
    const centro = DER.x + ANCHO_BARRA / 2 + paso * i;
    const x = centro - ANCHO_BARRA / 2;
    const inicial = svgTexto(INICIALES[i], {
      x: centro - anchoTexto(INICIALES[i], 8.5) / 2, y: BASE_INICIALES, tam: 8.5, color: COLORES_DUENO.etiqueta,
    });
    // El punto es de un día cerrado SIN visitas: uno cerrado que sí las tuvo lleva su barra.
    if (dia.cerrado && !(dia.n > 0)) {
      return `<circle cx="${+centro.toFixed(2)}" cy="${BASE - 2}" r="1.8" fill="${COLORES_DUENO.barra}" fill-opacity="${OPACIDAD_BARRA}"/>${inicial}`;
    }
    const n = dia.n || 0;
    const alto = Math.max(ALTO_MIN_BARRA, (n / maximo) * ALTO_MAX_BARRA);
    const esMejor = mejor === dia.d;
    const color = esMejor ? COLORES_DUENO.barraMejor : COLORES_DUENO.barra;
    const opacidad = esMejor ? 1 : OPACIDAD_BARRA;
    const cifra = esMejor
      ? svgTexto(String(n), { x: centro - anchoTexto(String(n), 9) / 2, y: BASE - alto - 4, tam: 9, color: COLORES_DUENO.texto })
      : "";
    return `<path d="${trazoBarra(x, alto)}" fill="${color}" fill-opacity="${opacidad}"/>${cifra}${inicial}`;
  });
  return piezas.join("");
}

function cifras(informe) {
  const visitas = String(informe.visitas ?? 0);
  const disponible = IZQ.hasta - IZQ.x;
  const tam = Math.min(TAM_NUMERO, (TAM_NUMERO * disponible) / Math.max(anchoTexto(visitas, TAM_NUMERO), 1));
  const comparado = textoComparado(informe.visitas ?? 0, informe.visitasAntes ?? null);
  return svgTexto("VISITAS", { x: IZQ.x, y: BASE - 44, tam: 9, color: COLORES_DUENO.etiqueta, opacidad: 0.8 })
    + svgTexto(visitas, { x: IZQ.x, y: BASE, tam, color: COLORES_DUENO.texto })
    + (comparado ? svgTexto(comparado, { x: IZQ.x, y: BASE_INICIALES, tam: 9.5, color: COLORES_DUENO.etiqueta }) : "");
}

/** La banda de la tarjeta: { svg, ancho, alto } (375x123; se rasteriza a 2x y 3x). */
export function svgStripDueno(informe) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO}" height="${ALTO}">`
    + `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO_BANDA}"/>`
    + cifras(informe) + barras(informe) + `</svg>`;
  return { svg, ancho: ANCHO, alto: ALTO };
}

/** El icono de los avisos: el lacre en avena sobre el verde de la tarjeta. */
export function svgIconoDueno() {
  return svgIconoLacre({ color: PALETA.avena, fondo: PALETA.verde });
}

/** El logo de la cabecera: solo el lacre, en avena y sin fondo, en 150x150. */
export function svgLogoDueno() {
  const lado = 150;
  const e = LACRE.encuadre;
  const escala = (lado * 0.96) / e.alto;
  const x = lado / 2 - (e.x + e.ancho / 2) * escala;
  const y = lado / 2 - (e.y + e.alto / 2) * escala;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">`
    + `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(4)})">${svgLacre({ color: PALETA.avena, id: "lacre-logo-dueno" })}</g></svg>`;
}
