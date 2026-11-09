import { tutorialesVistos } from "./store";
import { usuarioDe } from "./auth";

// El recorrido de bienvenida (app/Recorrido.js): ¿ya lo vio este usuario?
// Va por usuario (`nube`, `nube-caja`), no por navegador. Los admins comparten
// uno: la sesión no dice si es victor o diego.
//
// Lo leen /api/tutorial y las páginas que lo llevan (caja y manager), que lo
// pasan ya sabido: preguntarlo desde el navegador era una función más de Vercel
// cada vez que se abría la caja, y la caja se abre tras cada cliente.
export const RECORRIDOS = ["manager", "caja"];

export const usuarioDelRecorrido = (sesion) => ({
  usuario: sesion.rol === "admin" ? "admin" : usuarioDe(sesion.negocio, sesion.rol),
  negocio: sesion.negocio,
});

/** @returns {Promise<boolean>} Sin base no se sabe: mejor no enseñarlo que enseñarlo en cada visita. */
export async function recorridoVisto(sesion, recorrido) {
  try {
    return (await tutorialesVistos(usuarioDelRecorrido(sesion).usuario)).includes(recorrido);
  } catch (e) {
    console.error("[tutorial] no se pudo leer:", e);
    return true;
  }
}
