import { componerNegocio } from "@/lib/negocios";
import { clienteDeTarjeta, negocioDeTarjeta } from "@/lib/tarjeta";
import { camposDelPase } from "@/lib/apple/pase";
import { estadoParaPase } from "@/lib/horario";
import { PALETA as P } from "./paleta";

// ============================================================================
// LAS TARJETAS DE EJEMPLO DE LA WEB
// ----------------------------------------------------------------------------
// Tiendas inventadas que NO están en la base: se componen igual que una de
// verdad (componerNegocio con un estilo de partida y sus colores) y se pintan con
// CaraDelPase, que usa camposDelPase() y stripDelPase(), lo mismo que arma el
// .pkpass. Así lo que enseña la web es lo que el cliente ve en su móvil, no una
// maqueta. Ningún kit de marca: esos son de su tienda.
// ============================================================================

// Un horario cualquiera, para que «Abierto hasta…» lo escriba estadoParaPase y
// no una frase puesta a mano. Las dos horas son fijas: la página es estática.
const HORARIO = {
  zona: "Europe/Madrid",
  semana: [0, 1, 2, 3, 4, 5, 6].map((d) => (d === 6 ? null : { abre: "08:00", cierra: "20:00" })),
};
const ESTADOS = {
  abierto: estadoParaPase(HORARIO, Date.parse("2026-10-13T09:00:00Z")), // martes, 11:00
  cerrado: estadoParaPase(HORARIO, Date.parse("2026-10-13T04:30:00Z")), // martes, 6:30
};

/**
 * Una tienda de ejemplo y su cliente, ya recortados como los ve el navegador.
 * @param {{ slug: string, nombre: string, premio: string, tema: object, cartillas?: object[] }} tienda
 */
export function ejemplo({ slug, nombre, premio, tema, cartillas }, sellos, { sellos2 = 0, estado = null } = {}) {
  const config = { meta: 8, premio, tema, ...(cartillas ? { cartillas } : {}) };
  const negocio = componerNegocio(slug, { nombre, tipo: "sellos", config });
  const cliente = { serial: `ejemplo-${slug}`, codigo: "K7P", sellos, sellos2, premios: 0 };
  return { negocio: negocioDeTarjeta(negocio), cliente: clienteDeTarjeta(cliente), estado: estado ? ESTADOS[estado] : null };
}

/**
 * Lo que dice la pantalla de bloqueo tras un sello: el primer campo que avisa al
 * cambiar, con su changeMessage, como lo escribe el iPhone.
 */
export function avisoDe({ negocio, cliente }) {
  const campo = camposDelPase(cliente, negocio).secondaryFields.find((f) => f.changeMessage);
  return campo ? campo.changeMessage.replace("%@", campo.value) : "";
}

export const CAFETERIA = {
  slug: "tu-cafeteria",
  nombre: "Tu cafetería",
  premio: "café gratis",
  // camelOscuro y no camel: también pinta las etiquetas pequeñas del pase («PREMIO»).
  tema: { estilo: "coffee", cardBg: P.crema, ink: P.verde, accent: P.camelOscuro },
};

// El móvil de la portada: una tarjeta por cosa que sabe hacer. Todas de «Tu
// cafetería», para que se vea que es la misma tienda con otro aspecto.
const tuya = (id, tema, extra = {}) => ({ ...CAFETERIA, slug: `tu-cafeteria-${id}`, tema: { estilo: "coffee", ...tema }, ...extra });
export const CARRUSEL = [
  { id: "abierto", titulo: "Dice si estás abierto", tienda: CAFETERIA, sellos: 7, estado: "abierto" },
  { id: "vaso", titulo: "Un vaso que se llena", tienda: tuya("vaso", { estilo: "iced" }), sellos: 5 },
  {
    id: "doble",
    titulo: "Dos cartillas en una",
    tienda: tuya("doble", { doble: "filas", cardBg: P.verdeClaro, ink: P.espresso, accent: P.vison }, {
      cartillas: [
        { nombre: "Cafés", marca: "taza", meta: 8, premio: "café gratis" },
        { nombre: "Bollería", marca: "croissant", meta: 6, premio: "croissant gratis" },
      ],
    }),
    sellos: 5,
    sellos2: 2,
  },
  { id: "forma", titulo: "Elige la forma", tienda: tuya("forma", { forma: "rombo", banda: "rayas", cardBg: P.crema, ink: P.verde, accent: P.verde }), sellos: 5 },
  { id: "planta", titulo: "Una planta que crece", tienda: tuya("planta", { modo: "planta", cardBg: P.papel, ink: P.espresso, accent: P.vison }), sellos: 5 },
  {
    id: "cerrado",
    titulo: "Y cuándo vuelves a abrir",
    tienda: tuya("cerrado", { forma: "hexagono", banda: "clara", cardBg: P.espresso, ink: P.papel, accent: P.vison, detalle: P.avena }),
    sellos: 4,
    estado: "cerrado",
  },
];

/** La diapositiva hecha tienda + cliente + línea de estado. */
export const ejemploDe = (d) => ejemplo(d.tienda, d.sellos, { sellos2: d.sellos2, estado: d.estado });
