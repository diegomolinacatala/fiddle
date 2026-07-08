// ============================================================================
// REGISTRO MODULAR DE ACCIONES
// ----------------------------------------------------------------------------
// Cada acción es lo que un scan PUEDE significar. El manager elige cuáles están
// activas; la LÓGICA vive aquí. Para añadir una funcionalidad nueva a toda la
// plataforma basta con añadir una entrada a este objeto — no se toca nada más.
//
// Contrato de `aplicar(cliente, programa)`:
//   cliente  = { serial, sellos, premios }
//   programa = { titulo, meta, premio, ... }
//   devuelve = { cliente: <nuevo estado>, mensaje: <feedback>, evento?: <log> }
//              o bien { ok: false, mensaje } para rechazar sin cambiar nada.
// Este fichero NO importa nada del servidor (fs, next), así que la UI también
// puede importarlo para pintar los botones.
// ============================================================================

export const ACCIONES = {
  sellar: {
    label: "Añadir sello",
    icon: "➕",
    descripcion: "Suma un sello a la cartilla del cliente.",
    aplicar(c, p) {
      if (c.sellos >= p.meta)
        return { ok: false, mensaje: "La cartilla ya está llena — toca canjear." };
      const sellos = c.sellos + 1;
      return {
        cliente: { ...c, sellos },
        mensaje: `Sello añadido · ${sellos}/${p.meta}`,
        evento: `Sello ${sellos}/${p.meta}`,
      };
    },
  },

  restar: {
    label: "Quitar sello",
    icon: "➖",
    descripcion: "Corrige un sello puesto de más.",
    aplicar(c, p) {
      const sellos = Math.max(0, c.sellos - 1);
      return {
        cliente: { ...c, sellos },
        mensaje: `Sello quitado · ${sellos}/${p.meta}`,
        evento: `Corrección → ${sellos}/${p.meta}`,
      };
    },
  },

  canjear: {
    label: "Canjear premio",
    icon: "🎁",
    descripcion: "Entrega el premio y reinicia la cartilla.",
    aplicar(c, p) {
      if (c.sellos < p.meta)
        return { ok: false, mensaje: `Aún no llega · ${c.sellos}/${p.meta}` };
      return {
        cliente: { ...c, sellos: 0, premios: (c.premios || 0) + 1 },
        mensaje: `🎉 Premio entregado: ${p.premio}`,
        evento: `Canjeó: ${p.premio}`,
      };
    },
  },

  confirmar: {
    label: "Confirmar visita",
    icon: "✅",
    descripcion: "Registra una visita sin tocar la cartilla.",
    aplicar(c) {
      return { cliente: c, mensaje: "Visita confirmada", evento: "Visita confirmada" };
    },
  },
};

// Lista estable para pintar en la UI.
export const LISTA_ACCIONES = Object.entries(ACCIONES).map(([key, v]) => ({
  key,
  label: v.label,
  icon: v.icon,
  descripcion: v.descripcion,
}));
