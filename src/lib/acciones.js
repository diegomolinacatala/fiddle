// ============================================================================
// REGISTRO MODULAR DE ACCIONES
// ----------------------------------------------------------------------------
// aplicar(cliente, negocio) -> { cliente, mensaje, evento? }  ó  { ok:false, mensaje }
// cliente  = { serial, negocio, sellos, premios }
// negocio  = { slug, nombre, tipo, meta, premio, tema, ... }
// No importa nada del servidor, así la UI también lo usa para pintar botones.
// `icon` es el nombre de un icono de app/Icono.js.
// ============================================================================

export const ACCIONES = {
  sellar: {
    label: "Añadir sello",
    icon: "mas",
    descripcion: "Suma un sello a la cartilla.",
    aplicar(c, n) {
      if (c.sellos >= n.meta) return { ok: false, mensaje: "Cartilla llena — toca canjear." };
      const sellos = c.sellos + 1;
      return { cliente: { ...c, sellos }, mensaje: `Sello añadido · ${sellos}/${n.meta}`, evento: `Sello ${sellos}/${n.meta}` };
    },
  },

  restar: {
    label: "Quitar sello",
    icon: "menos",
    correccion: true, // se pinta en segundo plano: arreglar un error no es el gesto habitual
    descripcion: "Corrige un sello de más.",
    aplicar(c, n) {
      const sellos = Math.max(0, c.sellos - 1);
      return { cliente: { ...c, sellos }, mensaje: `Sello quitado · ${sellos}/${n.meta}`, evento: `Corrección → ${sellos}/${n.meta}` };
    },
  },

  canjear: {
    label: "Canjear",
    icon: "regalo",
    descripcion: "Entrega el premio / aplica el descuento.",
    aplicar(c, n) {
      if (n.tipo === "descuento") {
        if ((c.premios || 0) > 0) return { ok: false, mensaje: "Este cupón ya se usó." };
        return { cliente: { ...c, premios: 1 }, mensaje: `Descuento aplicado: ${n.premio}`, evento: `Cupón usado: ${n.premio}` };
      }
      if (c.sellos < n.meta) return { ok: false, mensaje: `Aún no llega · ${c.sellos}/${n.meta}` };
      return { cliente: { ...c, sellos: 0, premios: (c.premios || 0) + 1 }, mensaje: `Premio entregado: ${n.premio}`, evento: `Canjeó: ${n.premio}` };
    },
  },

  confirmar: {
    label: "Confirmar visita",
    icon: "check",
    descripcion: "Registra una visita sin tocar la cartilla.",
    aplicar(c) {
      return { cliente: c, mensaje: "Visita confirmada", evento: "Visita confirmada" };
    },
  },
};

export const LISTA_ACCIONES = Object.entries(ACCIONES).map(([key, v]) => ({
  key, label: v.label, icon: v.icon, descripcion: v.descripcion, correccion: Boolean(v.correccion),
}));
