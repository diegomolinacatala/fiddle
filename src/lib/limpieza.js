import {
  listNegocios, getNegocio, saveNegocio, listClientes, getCliente, borradosPendientes, purgarCliente, clientesSinUso,
  recortarEventos, recortarTarjetasDeDispositivo, marcarBorrado, borrarNegocio, registrarBorrado,
  ultimoIntento, registrarIntento,
} from "./store";
import { borrarCliente } from "./derechos";
import { refrescarPasesApple } from "./wallet";
import { tiendaEnGoogle } from "./googlewallet";
import { auditar } from "./auditoria";
import { limiteSinUso, limiteBajaTienda, limitePurga } from "./legal";

// ============================================================================
// LA PASADA DIARIA: lo que se borra solo (docs/RGPD.md, 3.3, 5.2 y 7.2)
// ----------------------------------------------------------------------------
// Va en el mismo reloj que los avisos (/api/cron/avisos), una vez al día: deja
// su marca en `intentos` y no vuelve a correr hasta que la marca caduca. Es
// idempotente como el resto: si corre dos veces, la segunda no encuentra nada.
//
//   1. Las tarjetas que se pidió borrar hace más de HORAS_HASTA_PURGA: la fila,
//      su historial, sus registros y lo que recordaba qué iPhone la tuvo.
//   2. Las que llevan MESES_SIN_USO sin nada: se vacían y se anulan (mañana caen
//      con el punto 1). Y el historial más viejo que eso.
//   3. Las tiendas archivadas hace DIAS_BAJA_TIENDA: primero se anulan todos sus
//      pases (para que no queden tarjetas "válidas" en los teléfonos) y, cuando
//      ya no queda ninguna tarjeta, la tienda entera.
//
// Nunca lanza hacia fuera: un fallo en una tienda no para a las demás.
// ============================================================================

export const CLAVE_LIMPIEZA = "reloj:limpieza";
const CADA_MS = 20 * 60 * 60 * 1000; // una vez al día, con margen para el reloj de 15 min

/** ¿Toca hoy? La marca vive en `intentos`, que no guarda nada de más de un día. */
export async function tocaLimpieza(ahora = Date.now()) {
  const ultima = await ultimoIntento(CLAVE_LIMPIEZA).catch(() => null);
  return !ultima || ahora - Date.parse(ultima) >= CADA_MS;
}

const registrarFallo = (resultado, donde, e) => {
  console.error(`[limpieza] ${donde}:`, e);
  resultado.errores.push(`${donde}: ${String(e?.message || e)}`);
};

/** Segundo tiempo de los borrados que ya cumplieron su día. */
async function purgar(ahora, resultado) {
  for (const { serial } of await borradosPendientes(limitePurga(ahora))) {
    try {
      resultado.purgados += await purgarCliente(serial);
    } catch (e) {
      registrarFallo(resultado, `purgar ${serial}`, e);
    }
  }
}

/** Plazo de conservación: las tarjetas sin uso se borran como si lo pidieran. */
async function caducar(ahora, resultado) {
  const limite = limiteSinUso(ahora);
  const negocios = new Map();
  for (const { serial, negocio: slug } of await clientesSinUso(limite)) {
    try {
      if (!negocios.has(slug)) negocios.set(slug, await getNegocio(slug, { incluirArchivados: true }));
      const cliente = await getCliente(serial);
      if (cliente && (await borrarCliente(cliente, negocios.get(slug), { motivo: "plazo", rol: "reloj" }))) resultado.caducados++;
    } catch (e) {
      registrarFallo(resultado, `caducar ${serial}`, e);
    }
  }
  await recortarEventos(limite).catch((e) => registrarFallo(resultado, "recortar eventos", e));
  await recortarTarjetasDeDispositivo(limite).catch((e) => registrarFallo(resultado, "recortar tarjetas de dispositivo", e));
}

/** Las tiendas que se fueron: anular sus pases y, al día siguiente, borrarlas. */
async function darDeBaja(ahora, resultado) {
  const limite = limiteBajaTienda(ahora);
  const pendientes = await borradosPendientes(new Date(ahora + 1).toISOString());
  for (const negocio of await listNegocios({ incluirArchivados: true })) {
    if (!negocio.archivado) continue;
    try {
      // Archivada antes de que se apuntara la fecha: el plazo empieza hoy.
      if (!negocio.archivadoEn) {
        await saveNegocio(negocio.slug, { archivadoEn: new Date(ahora).toISOString() });
        continue;
      }
      if (negocio.archivadoEn > limite) continue;
      const vivas = await listClientes(negocio.slug);
      if (vivas.length) {
        // Primer tiempo: todas a la vez, y un solo empujón a sus teléfonos.
        for (const c of vivas) await marcarBorrado(c.serial);
        await refrescarPasesApple(negocio);
        const anuladas = (await Promise.all(vivas.map((c) => getCliente(c.serial)))).filter(Boolean);
        await tiendaEnGoogle(negocio, { clientes: anuladas });
        resultado.tiendasAnuladas.push(negocio.slug);
        continue;
      }
      // Hasta que sus tarjetas no hayan cumplido su día, no se toca la tienda.
      if (pendientes.some((p) => p.negocio === negocio.slug)) continue;
      const { borrados } = await borrarNegocio(negocio.slug);
      await registrarBorrado({ negocio: negocio.slug, tipo: "tienda", motivo: "baja", rol: "reloj", cuantos: borrados });
      await auditar(null, negocio.slug, "borrar_tienda", `baja tras ${Math.round((ahora - Date.parse(negocio.archivadoEn)) / 86400000)} días archivada`);
      resultado.tiendasBorradas.push(negocio.slug);
    } catch (e) {
      registrarFallo(resultado, `baja de ${negocio.slug}`, e);
    }
  }
}

/**
 * La pasada entera. `forzar` la corre aunque hoy ya corriera (tests).
 * @returns {Promise<object|null>} qué hizo, o null si hoy ya tocó
 */
export async function limpiezaDiaria({ ahora = Date.now(), forzar = false } = {}) {
  if (!forzar && !(await tocaLimpieza(ahora))) return null;
  await registrarIntento(CLAVE_LIMPIEZA).catch((e) => console.error("[limpieza] no se pudo apuntar la marca:", e));
  const resultado = { purgados: 0, caducados: 0, tiendasAnuladas: [], tiendasBorradas: [], errores: [] };
  // En este orden: lo que hoy se anula cae mañana, nunca en la misma pasada.
  for (const [nombre, paso] of [["purgar", purgar], ["caducar", caducar], ["dar de baja", darDeBaja]]) {
    await paso(ahora, resultado).catch((e) => registrarFallo(resultado, nombre, e));
  }
  return resultado;
}
