"use client";

import InterruptorTienda from "@/app/admin/InterruptorTienda";

// La PLANTILLA de una tienda (lib/plantilla.js): quién atiende la caja, con el PIN
// de cada uno, y su pestaña en el manager. Viene apagada: sirve donde cada
// empleado sella desde su móvil, no con un móvil fijo en el mostrador. Apagada,
// la caja no pregunta quién atiende ni pide PIN. No se borra nada: la lista, sus
// PIN y el nombre de cada movimiento vuelven tal cual al encenderla.
export default function PlantillaTienda(props) {
  return (
    <InterruptorTienda
      {...props}
      clave="plantillaActiva"
      seccion="Plantilla de la caja"
      icono="credencial"
      encendido={{
        titulo: "Encendida para esta tienda",
        texto: "Sale la pestaña Plantilla y la caja pregunta quién atiende, con el PIN de cada uno.",
        aviso: "Plantilla encendida",
      }}
      apagado={{
        titulo: "Apagada para esta tienda",
        texto: "Sin pestaña, y la caja ni pregunta quién atiende ni pide PIN. La lista y sus PIN se guardan tal cual.",
        aviso: "Plantilla apagada",
      }}
      nota="Para tiendas donde cada empleado sella desde su móvil. Con un móvil fijo en la caja, mejor apagada."
    />
  );
}
