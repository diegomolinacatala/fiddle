import { componerNegocio } from "@/lib/negocios";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { camposDelPase } from "@/lib/apple/pase";

// ============================================================================
// LAS TARJETAS DE EJEMPLO DE LA WEB
// ----------------------------------------------------------------------------
// Tiendas inventadas que NO están en la base: se componen igual que una de
// verdad (componerNegocio con un estilo de partida) y se pintan con CaraDelPase,
// que usa camposDelPase() y stripDelPase(), lo mismo que arma el .pkpass. Así lo
// que enseña la web es lo que el cliente ve en su móvil, no una maqueta.
// Ningún kit de marca: esos son de su tienda.
// ============================================================================

/**
 * @param {{ slug: string, nombre: string, estilo: string, premio: string }} datos
 * @param {number} sellos
 */
export function ejemplo({ slug, nombre, estilo, premio }, sellos) {
  const negocio = componerNegocio(slug, { nombre, tipo: "sellos", config: { meta: 8, premio, tema: { estilo } } });
  const cliente = { serial: `ejemplo-${slug}`, codigo: "K7P", sellos, premios: 0 };
  return { negocio: negocioDeTarjeta(negocio), cliente: clienteDeTarjeta(cliente) };
}

export const CAFETERIA = { slug: "tu-cafeteria", nombre: "Tu cafetería", estilo: "coffee", premio: "café gratis" };

// La sección «Con tu marca»: tres estilos de partida que se parecen poco entre sí.
export const MUESTRARIO = [
  { slug: "tu-cafeteria", nombre: "Tu cafetería", estilo: "coffee", premio: "café gratis", sellos: 5 },
  { slug: "para-llevar", nombre: "Para llevar", estilo: "iced", premio: "café gratis", sellos: 5 },
  { slug: "tu-panaderia", nombre: "Tu panadería", estilo: "panaderia", premio: "croissant gratis", sellos: 3 },
];

/** Lo que dice el aviso de la pantalla de bloqueo tras un sello: el campo que cambia (PREMIO). */
export function avisoDeSello({ negocio, cliente }) {
  const { secondaryFields } = camposDelPase(cliente, negocio);
  return secondaryFields.find((f) => f.key === "premio")?.value ?? "";
}
