"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import CabeceraGestion from "./CabeceraGestion";
import { pagina } from "@/app/ui";

// ============================================================================
// EL MARCO DE LAS PANTALLAS DEL DUEÑO (Tienda, Clientes, Avisos, Plantilla, Ajustes)
// ----------------------------------------------------------------------------
// La cabecera (marca, nombre y pestañas) vive en el LAYOUT, no en cada página:
// el layout no se vuelve a pintar al cambiar de pestaña, así que mientras la
// página nueva carga solo sale en gris lo que cambia (loading.js), nunca la
// marca ni las pestañas, que van a seguir ahí.
//
// La cabecera lleva el nombre y el tema GUARDADOS. Lo que cambie el dueño en
// Tienda llega con `actualizar` (useGestion), sin pedir nada al servidor.
//
// `memoria` guarda lo último que pintó cada pestaña mientras dure la visita (en
// memoria y nada más: lleva nombres de clientes, no va a ningún almacén del
// navegador). Al volver a Clientes, su loading.js pinta eso en vez del
// esqueleto y, en cuanto llega lo del servidor, rueda a lo nuevo.
// ============================================================================

const SECCIONES = ["manager", "crm", "avisos", "plantilla", "ajustes"];
const Contexto = createContext(null);

/** {nombre, tema, avisosAvanzados, plantillaActiva, actualizar, memoria} dentro de una pantalla del dueño; null fuera. */
export const useGestion = () => useContext(Contexto);

export default function MarcoGestion({ slug, negocio, children }) {
  const seccion = useSelectedLayoutSegment();
  const [cabecera, setCabecera] = useState(negocio);
  const memoria = useRef(null);
  if (!memoria.current) memoria.current = new Map();
  // Sin permiso (la página manda al login) o fuera de estas, ni marco ni cabecera.
  if (!cabecera || !SECCIONES.includes(seccion)) return children;
  return (
    <Contexto.Provider value={{ ...cabecera, actualizar: setCabecera, memoria: memoria.current }}>
      <main style={pagina}>
        <div style={{ width: "min(1100px, 100%)" }}>
          <CabeceraGestion negocio={cabecera} slug={slug} activa={seccion} ayuda={seccion === "manager"} />
          {children}
        </div>
      </main>
    </Contexto.Provider>
  );
}
