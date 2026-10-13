// ============================================================================
// LO QUE DICE LA WEB DE FIDDLE (/home)
// ----------------------------------------------------------------------------
// Precios y contacto viven aquí y en ningún otro sitio: si cambia una cifra o un
// teléfono, se cambia una vez y sale igual en la cabecera, en cada plan y al pie.
// ============================================================================

export const WHATSAPP = "34652284200"; // sin «+» ni espacios: es lo que pide wa.me
export const TELEFONO_VISIBLE = "652 28 42 00";
export const CORREO = "esfiddle@gmail.com"; // el de la empresa (13-10-2026)

const ASUNTO = "fiddle para mi cafetería";
const CUERPO = "Hola, me interesa fiddle para mi cafetería.";

/** Abre WhatsApp (app en el móvil, web en el ordenador) con el mensaje ya escrito. */
export const enlaceWhatsApp = (texto = CUERPO) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

/** Abre la app de correo del teléfono (o la que tenga el ordenador) con el correo empezado. */
export const enlaceCorreo = (asunto = ASUNTO, cuerpo = CUERPO) =>
  `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

/**
 * Lo mismo en Gmail web. En un ordenador sin app de correo configurada, un
 * mailto: no hace nada al pulsarlo; Gmail abre el correo ya escrito.
 */
export const enlaceGmail = (asunto = ASUNTO, cuerpo = CUERPO) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CORREO)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

// Lo que lleva cada plan (decidido el 13-10-2026). «Completo» suma a «Tarjetas»:
// no repite su lista. Las frases dicen lo que la app hace hoy; nada de promesas
// que la tienda no vaya a encontrar al entrar.
export const PLANES = [
  {
    id: "tarjetas",
    nombre: "Tarjetas",
    precio: 39,
    lema: "Para empezar a sellar.",
    incluye: [
      "Tarjetas sin límite, en Apple Wallet y Android",
      "Con tu logo, tus colores y tu premio",
      "La caja en el móvil de la tienda",
      "Tu QR para el mostrador",
      "Promociones al momento, a todos tus clientes a la vez",
    ],
  },
  {
    id: "completo",
    nombre: "Completo",
    precio: 49,
    lema: "Para que vuelvan más.",
    destacado: true,
    incluye: [
      "Todo lo de Tarjetas",
      "Las estadísticas de tus clientes",
      "Tus clientes por grupos, y avisos a cada grupo",
      "Avisos automáticos y programados",
      "«Abierto hasta…» en la tarjeta",
      "Aviso al pasar cerca de tu tienda",
      "Tu equipo en la caja, cada uno con su PIN",
    ],
  },
];

/** El mensaje de WhatsApp con el plan elegido, para que la conversación empiece por ahí. */
export const mensajeDePlan = (plan) =>
  `Hola, me interesa el plan ${plan.nombre} de fiddle (${plan.precio} € al mes) para mi cafetería.`;
