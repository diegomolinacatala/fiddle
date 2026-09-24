import {
  getCliente, getNegocio, registrarPase, borrarRegistro, pasesDeDispositivo,
  marcarInstalacion, addEvento, tarjetaDeDispositivo, apuntarTarjetaDeDispositivo, fusionarClientes,
} from "../store";
import { notificarCliente } from "../wallet";
import { unificarTarjeta } from "../unaTarjeta";
import { configApple, configsDeTienda } from "./config";
import { generarPkpass } from "./firmar";

/**
 * Dependencias reales del web service (store + firma). null si Apple no está
 * configurado: las rutas responden 404 y el iPhone deja de insistir.
 */
export function depsServicio() {
  if (!configApple()) return null;
  return {
    // La config de un Pass Type ID si es uno con que se firman los pases de esa
    // tienda (el suyo o el general); null si no.
    configDe: (passType, slug) => configsDeTienda(slug).find((c) => c.passTypeId === passType) || null,
    getCliente,
    getNegocio,
    registrarPase,
    borrarRegistro,
    pasesDeDispositivo,
    marcarInstalacion,
    addEvento,
    unificarTarjeta: (datos) => unificarTarjeta({
      getCliente, getNegocio, tarjetaDeDispositivo, apuntarTarjetaDeDispositivo,
      fusionarClientes, addEvento, notificarCliente,
    }, datos),
    generarPkpass,
    log: (mensaje) => console.warn(mensaje),
  };
}
