import {
  getCliente, getNegocio, registrarPase, borrarRegistro, pasesDeDispositivo,
} from "../store";
import { configApple } from "./config";
import { generarPkpass } from "./firmar";

/**
 * Dependencias reales del web service (store + firma). null si Apple no está
 * configurado: las rutas responden 404 y el iPhone deja de insistir.
 */
export function depsServicio() {
  const config = configApple();
  if (!config) return null;
  return {
    config,
    getCliente,
    getNegocio,
    registrarPase,
    borrarRegistro,
    pasesDeDispositivo,
    generarPkpass: (cliente, negocio) => generarPkpass(cliente, negocio, config),
    log: (mensaje) => console.warn(mensaje),
  };
}
