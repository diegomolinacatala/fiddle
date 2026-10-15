// ============================================================================
// LA FILA DE LA CAJA
// ----------------------------------------------------------------------------
// Lo que la ficha manda al servidor sale DE UNO EN UNO: dos sellos seguidos no
// compiten entre sí en el guardado optimista. Y el premio recién dado (dar,
// guardar o usar uno guardado) ESPERA `SEGUNDOS_DESHACER` antes de entrar en la
// fila, por si se deshace (ver TarjetaCaja y lib/acciones.js).
//
// Aquí solo va la cuenta de lo pendiente: qué espera, cuánto queda por
// contestar y cómo se vacía. Sin React ni fetch (`mandar` y `mandarAlSalir` los
// pone la ficha), para poder probar que nada se pierde ni se manda dos veces:
//   - el premio en espera sale UNA vez: al vencer su plazo, con otro toque, al
//     vaciar la fila o al salir de la página. Lo primero que pase lo saca.
//   - `vaciar` lo manda por la fila de siempre y espera la respuesta: es lo que
//     usa la ficha antes de volver sola al escáner. `alSalir` (sendBeacon) es
//     solo para cuando la página se va de verdad, que desde el panel del
//     ordenador ni siquiera llega.
// ============================================================================

const RELOJ = { poner: (f, ms) => setTimeout(f, ms), quitar: (t) => clearTimeout(t) };

/**
 * @param {object} o
 * @param {(key: string) => Promise<unknown>} o.mandar  manda una acción y atiende su respuesta
 * @param {(key: string) => void} o.mandarAlSalir  la página se va: sin fila y sin respuesta
 * @param {(espera: object) => void} [o.alSoltar]  el premio deja de esperar (mandado, deshecho o descartado)
 * @param {() => void} [o.alAcabar]  ha contestado una petición
 * @param {{ poner: Function, quitar: Function }} [o.reloj]  setTimeout/clearTimeout (los tests ponen el suyo)
 */
export function crearFila({ mandar, mandarAlSalir, alSoltar = () => {}, alAcabar = () => {}, reloj = RELOJ }) {
  let cola = Promise.resolve();
  let pendientes = 0;
  let espera = null;

  /** A la cola, detrás de lo que ya haya. */
  function enviar(key) {
    pendientes += 1;
    cola = cola
      .then(() => mandar(key))
      // `mandar` atiende sus propios errores: si aun así lanza, la fila no se puede quedar atascada.
      .catch((e) => console.error("[caja] la petición falló sin respuesta:", e))
      .finally(() => {
        pendientes -= 1;
        alAcabar();
      });
    return cola;
  }

  /** El premio recién dado espera `ms` por si se deshace. Lo que esperaba antes sale ya: deshacer es para el último. */
  function esperar(key, ms, datos = {}) {
    confirmar();
    pendientes += 1;
    espera = { ...datos, key, temporizador: reloj.poner(confirmar, ms) };
    return espera;
  }

  /** Quita el premio en espera sin mandarlo (deshacer, o lo de antes falló). Devuelve lo que esperaba, o null. */
  function soltar() {
    const p = espera;
    if (!p) return null;
    espera = null;
    reloj.quitar(p.temporizador);
    pendientes -= 1;
    alSoltar(p);
    return p;
  }

  /** El premio en espera, a la fila ya. */
  function confirmar() {
    const p = soltar();
    if (p) enviar(p.key);
    return p;
  }

  /** La página se va: lo que esperaba sale sin fila (no hay tiempo de esperar respuesta). */
  function alSalir() {
    const p = soltar();
    if (p) mandarAlSalir(p.key);
    return p;
  }

  /**
   * Manda lo que esperaba y espera a que conteste todo, también lo que entre mientras
   * tanto (la fila es una). Al acabar no queda nada que `alSalir` pudiera mandar otra vez.
   */
  async function vaciar() {
    confirmar();
    for (let vista = null; vista !== cola; ) {
      vista = cola;
      await vista;
    }
  }

  return {
    enviar, esperar, soltar, confirmar, alSalir, vaciar,
    /** Lo que aún no ha contestado el servidor, contando el premio que espera. */
    get pendientes() { return pendientes; },
    get esperando() { return espera; },
  };
}
