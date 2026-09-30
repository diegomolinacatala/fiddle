import { ultimoIntento } from "./store";
import { CLAVE_RELOJ, RELOJ_VIVO_MIN } from "./automatizaciones";

// ============================================================================
// ¿ANDA EL RELOJ?
// ----------------------------------------------------------------------------
// El reloj de fuera (/api/cron/avisos, cada 15 min) deja un latido en
// `intentos` a cada pasada. De él dependen los avisos automáticos y el estado
// "ABIERTO / CERRADO" del pase de Wallet: un pase no cambia solo con la hora, lo
// empuja el reloj. Sin reloj, ese estado se quedaría diciendo "ABIERTO" de
// noche; por eso el pase solo lo lleva si el reloj anda.
// ============================================================================

export { CLAVE_RELOJ, RELOJ_VIVO_MIN };

/** ¿Hubo latido hace poco? Nunca lanza: si la base falla, se da por parado. */
export async function relojVivo(ahora = Date.now()) {
  const ultimo = await ultimoIntento(CLAVE_RELOJ).catch(() => null);
  return Boolean(ultimo) && ahora - Date.parse(ultimo) <= RELOJ_VIVO_MIN * 60_000;
}
