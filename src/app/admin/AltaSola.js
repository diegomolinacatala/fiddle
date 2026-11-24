"use client";

import { C, panel, h2, aviso } from "@/app/ui";
import Icono from "@/app/Icono";
import { metrosEntre, METROS_MISMO_LOCAL } from "@/lib/alta";

// Cómo llegó la tienda si se dio de alta sola desde /alta: quién, dónde y si hay
// otra tienda activa en el mismo local. Sin correo verificado, esto es lo que
// permite fiarse (o no) de un alta: se la llama o se la mira en el mapa.
export default function AltaSola({ alta, ubicaciones, otras = [] }) {
  if (!alta) return null;
  const lugar = alta.lugar;
  const fecha = new Date(alta.fecha).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
  const cerca = lugar
    ? otras.filter((o) => (o.ubicaciones || []).some((u) => metrosEntre(lugar, u) < METROS_MISMO_LOCAL))
    : [];
  const mapa = lugar ? `https://www.openstreetmap.org/?mlat=${lugar.lat}&mlon=${lugar.lng}#map=18/${lugar.lat}/${lugar.lng}` : null;
  const fila = { margin: "4px 0", fontSize: 14 };

  return (
    <div style={panel}>
      <h2 style={h2}><Icono nombre="puerta" tam={16} /> Se dio de alta sola el {fecha}</h2>
      {alta.nombre && <p style={fila}>{alta.nombre}</p>}
      {alta.email && <p style={fila}><a href={`mailto:${alta.email}`}>{alta.email}</a></p>}
      {alta.telefono && <p style={fila}><a href={`tel:${alta.telefono}`}>{alta.telefono}</a></p>}
      {lugar && (
        <p style={fila}>
          {lugar.direccion || "Sin dirección"}{" "}
          <a href={mapa} target="_blank" rel="noopener noreferrer">Ver en el mapa</a>
        </p>
      )}
      {cerca.length > 0 && (
        <div style={{ ...aviso(false), marginTop: 10 }} role="alert">
          A menos de {METROS_MISMO_LOCAL} m hay otra tienda activa: {cerca.map((o) => o.nombre).join(", ")}. Puede ser el mismo local dado de alta dos veces.
        </div>
      )}
      <p style={{ ...fila, color: C.tenue, fontSize: 12 }}>Sin correo verificado: si algo no cuadra, llámala.</p>
    </div>
  );
}
