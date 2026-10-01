// ============================================================================
// CÓMO SE VE LA CAJA (Tienda → "Editar vista de caja")
// ----------------------------------------------------------------------------
// Qué puede hacer la caja lo dicen las `acciones` de la tienda (lib/acciones.js).
// Cómo se le enseña a quien atiende, esto: opciones de pantalla, sin tocar qué
// se guarda ni cómo. Todo con un valor de partida que es lo que había antes de
// que existiera, para que nada cambie solo en las tiendas que ya funcionan.
//
// LA FILA DE UNA CARTILLA: un solo botón ancho que suma ("Añadir cookie   +").
// Corregir uno de más no es otro botón igual de grande al lado (con prisa se
// pulsa el que no es): es un "−" pequeño en la punta izquierda de la misma fila.
//
// Funciones puras: las usan la caja, la vista previa del manager y los tests.
// ============================================================================

import { ACCIONES } from "./acciones";
import { cartillasDe } from "./cartillas";
import { singular } from "./acciones";

export const OPCIONES_CAJA = {
  sumarDos: {
    label: "Botón «+2»",
    descripcion: "Para quien se lleva dos de golpe: suma dos sellos con un toque.",
    def: false,
  },
  guardarPremios: {
    label: "Preguntar si guarda el premio",
    descripcion: "Con la cartilla llena: «¿lo quiere ahora o se lo guardas?». Apagado, solo se da.",
    def: true,
  },
  volverAlEscaner: {
    label: "Volver al escáner al sumar",
    descripcion: "Tras sumar, a los 3 segundos vuelve a la cámara para el siguiente (se puede cancelar).",
    def: false,
  },
  historial: {
    label: "Ver su actividad reciente",
    descripcion: "Los últimos sellos y canjes de ese cliente, debajo de los botones.",
    def: true,
  },
  nombre: {
    label: "Apuntar el nombre del cliente",
    descripcion: "Un campo para escribir cómo se llama, si no lo dio al sacar la tarjeta.",
    def: true,
  },
  grande: {
    label: "Botones grandes",
    descripcion: "Más altos y con letra más grande, para móviles pequeños o con prisa.",
    def: false,
  },
};

/** Las opciones guardadas, completas: lo que no esté, su valor de partida. */
export function normalizarCaja(entrada) {
  const e = entrada && typeof entrada === "object" ? entrada : {};
  return Object.fromEntries(Object.entries(OPCIONES_CAJA).map(([k, o]) => [k, typeof e[k] === "boolean" ? e[k] : o.def]));
}

const claveDe = (base, i) => (i === 0 ? base : `${base}${i + 1}`);
const puede = (negocio, base) => negocio.acciones?.includes(base);

/**
 * Las filas de la caja para esta tienda, en orden.
 * @returns {{tipo:"cartilla"|"accion", key:string, label:string, icon:string, restar?:string|null, dos?:boolean, cartilla?:number, correccion?:boolean}[]}
 */
export function filasDeCaja(negocio) {
  const caja = normalizarCaja(negocio.caja);
  const filas = [];
  if (negocio.tipo !== "descuento" && puede(negocio, "sellar")) {
    for (const c of cartillasDe({}, negocio)) {
      const palabra = negocio.cartillas ? singular(c.nombre) : "sello";
      filas.push({
        tipo: "cartilla",
        key: claveDe("sellar", c.indice),
        restar: puede(negocio, "restar") ? claveDe("restar", c.indice) : null,
        dos: caja.sumarDos,
        label: `Añadir ${palabra}`,
        icon: ACCIONES.sellar.icon,
        cartilla: c.indice,
      });
    }
  }
  // Una tienda de cupones no suma: canjea. Y "Confirmar visita", si está, va aparte.
  if (negocio.tipo === "descuento" && puede(negocio, "canjear")) {
    filas.push({ tipo: "accion", key: "canjear", label: "Aplicar el descuento", icon: ACCIONES.canjear.icon });
  }
  if (puede(negocio, "confirmar")) {
    filas.push({ tipo: "accion", key: "confirmar", label: ACCIONES.confirmar.label, icon: ACCIONES.confirmar.icon, correccion: true });
  }
  return filas;
}
