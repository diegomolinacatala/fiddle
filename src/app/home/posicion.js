// ============================================================================
// DÓNDE ESTÁ CADA FILA DE TARJETAS (/home)
// ----------------------------------------------------------------------------
// Las cuentas, sin React ni DOM, para poder probarlas (tests/home.test.js):
// cuál se ve en el móvil que pasa tarjetas (Carrusel.js) y en qué parada está
// una fila que se desliza (Indicador.js).
// ============================================================================

// sentido: 1 = la nueva entra por la derecha; -1 = por la izquierda (al ir atrás).
// objetivo: la que va a entrar cuando las que esperan ya estén en su lado.
// movido: si ya pasó alguna (el primer aviso llega más tarde, tras la entrada del móvil).
export const INICIO = { actual: 0, anterior: null, sentido: 1, objetivo: null, movido: false };

/**
 * El carrusel tras pedir ir a `destino` (un índice, o una función del actual) en
 * `sentido`. Al cambiar de sentido, primero solo se pasan al otro lado las que
 * esperan (sin animar) y la nueva entra en el fotograma siguiente (`entrar`): si
 * no, vendría del lado de antes. La que se estaba yendo desaparece ya: si cambiara
 * de lado a medio irse, cruzaría la pantalla.
 */
export function pedir(p, destino, sentido, n) {
  const j = (((typeof destino === "function" ? destino(p.actual) : destino) % n) + n) % n;
  if (j === p.actual && p.objetivo === null) return p;
  if (sentido !== p.sentido) return { ...p, anterior: null, sentido, objetivo: j };
  return { actual: j, anterior: p.actual, sentido, objetivo: null, movido: true };
}

/** El segundo tiempo de un cambio de sentido: entra la que esperaba. */
export const entrar = (p) =>
  p.objetivo === null ? p : { actual: p.objetivo, anterior: p.actual, sentido: p.sentido, objetivo: null, movido: true };

/**
 * La parada (dónde queda cada tarjeta alineada a la izquierda) más cerca de
 * donde está la fila; al final del todo, la última, aunque no llegue a alinearse.
 */
export function paradaMasCercana({ paradas, desplazado, maximo }) {
  if (paradas.length === 0 || maximo <= 0) return 0;
  if (desplazado >= maximo - 4) return paradas.length - 1;
  let mejor = 0;
  paradas.forEach((x, i) => {
    if (Math.abs(x - desplazado) < Math.abs(paradas[mejor] - desplazado)) mejor = i;
  });
  return mejor;
}
