// ============================================================================
// LO QUE DICE LA WEB DE FIDDLE (/home)
// ----------------------------------------------------------------------------
// Precios y contacto viven aquí y en ningún otro sitio: si cambia una cifra o un
// teléfono, se cambia una vez y sale igual en la cabecera, en cada plan y al pie.
// ============================================================================

export const WHATSAPP = "34652284200"; // sin «+» ni espacios: es lo que pide wa.me
export const TELEFONO_VISIBLE = "652 28 42 00";
export const CORREO = "diegomolinacatala@gmail.com";

/** Abre WhatsApp (app en el móvil, web en el ordenador) con el mensaje ya escrito. */
export const enlaceWhatsApp = (texto = "Hola, me interesa fiddle para mi cafetería.") =>
  `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

/** Abre el correo con el asunto puesto. */
export const enlaceCorreo = (asunto = "fiddle para mi cafetería") =>
  `mailto:${CORREO}?subject=${encodeURIComponent(asunto)}`;

// Lo que lleva cada plan. «Completo» suma a «Tarjetas»: no repite su lista.
// Las frases dicen lo que la app hace hoy (avisos, clientes, resumen): nada de
// promesas que la tienda no vaya a encontrar al entrar.
export const PLANES = [
  {
    id: "tarjetas",
    nombre: "Tarjetas",
    precio: 39,
    lema: "Para empezar a sellar.",
    incluye: [
      "Tu tarjeta en Apple Wallet y en Android",
      "Con tu logo, tus colores y tu premio",
      "La caja en el móvil de la tienda",
      "Tu QR para el mostrador",
      "Premios para hoy o guardados para otro día",
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
      "Avisos en sus móviles, a todos o a un grupo",
      "Avisos programados y automáticos",
      "Tus clientes: quién viene, cada cuánto y quién falta",
      "Tus horas y días fuertes, en números",
    ],
  },
];

/** El mensaje de WhatsApp con el plan elegido, para que la conversación empiece por ahí. */
export const mensajeDePlan = (plan) =>
  `Hola, me interesa el plan ${plan.nombre} de fiddle (${plan.precio} € al mes) para mi cafetería.`;
