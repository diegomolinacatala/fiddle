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

// Los planes (20-11-2026): Gratis y Pro; Esencial y Plus ya no existen. Las frases dicen
// lo que la app hace hoy; nada de promesas que la tienda no vaya a encontrar al entrar.
//
// Lo que la app deja usar a cada plan lo decide el admin en /admin → Planes
// (lib/planes.js) y esta página NO lo lee: si cambia allí, se cambia aquí a mano.
//
// Gratis lo tiene todo (lo que antes era Pro) con tope de tarjetas EN USO: las que nadie
// guardó ni usó no cuentan. Al llegar al tope, los clientes nuevos se apuntan a una lista
// de espera y reciben su tarjeta cuando la tienda pasa a Pro. Se da de alta solo, en /alta.
// Pro se pide por WhatsApp (aún no se paga solo): 49 € al mes, o 468 € al año pagados por
// adelantado, que sale a 39 € al mes.
export const TARJETAS_GRATIS = 50;
export const RUTA_ALTA = "/alta";

export const PLANES = [
  {
    id: "gratis",
    nombre: "Gratis",
    precio: 0,
    periodo: "para siempre",
    lema: `Con todo, hasta ${TARJETAS_GRATIS} tarjetas.`,
    boton: "Empezar gratis",
    enlace: RUTA_ALTA,
    incluye: [
      `Hasta ${TARJETAS_GRATIS} tarjetas en uso, en Apple Wallet y Android`,
      "Con tu logo, tus colores y tu premio",
      "La caja en el móvil de la tienda",
      "Tu QR para el mostrador",
      "Estadísticas, grupos y avisos a cada grupo",
      "Promociones, avisos automáticos y programados",
      "«Abierto hasta…» y aviso al pasar cerca de tu tienda",
      "Tu equipo en la caja, cada uno con su PIN",
      "Lo montas tú, desde tu panel",
    ],
    nota: "Si llegas a las 50, tus clientes nuevos se apuntan a una lista de espera y les llega la tarjeta cuando pases a Pro.",
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: 49,
    anual: 468,
    periodo: "al mes",
    lema: "Sin límite y te la dejamos montada.",
    destacado: true,
    etiqueta: "Sin límite",
    incluye: [
      "Todo lo del plan Gratis",
      "Tarjetas sin límite",
      "Te la dejamos montada",
    ],
  },
];

/** Pro, pagado por adelantado: lo que sale al mes (468 / 12). */
export const mensualDelAnual = (plan) => (plan.anual ? Math.round(plan.anual / 12) : null);

/** El mensaje de WhatsApp con el plan elegido, para que la conversación empiece por ahí. */
export const mensajeDePlan = (plan) =>
  plan.anual
    ? `Hola, me interesa el plan ${plan.nombre} de fiddle (${plan.precio} € al mes, o ${plan.anual} € al año) para mi cafetería.`
    : `Hola, me interesa el plan ${plan.nombre} de fiddle para mi cafetería.`;

// Lo que se enseña de La Delicantería (Valencia), primer cliente. Sacado de su base
// el 09-11-2026 con consultas de solo lectura; Jesús tiene que dar el visto bueno a
// que salga su nombre. Si se actualiza, se vuelven a sacar las dos cosas a la vez.
// - segundos: media del escaneo (evento «alta») a tenerla en el Wallet («instalado»)
//   sin el 5 % de cada punta. Sin recortar sale hora y media: unos pocos la guardan
//   en casa horas después. La mitad tarda 6 s y el 95 %, menos de un minuto.
// - semanas: visitas de cada semana (lunes a domingo, hora de Madrid), contadas como
//   en el panel (sellos a menos de 3 h son una visita). Solo semanas enteras: la del
//   05-10 no (abrieron el martes 06) y la del 12-10 tampoco (el lunes fue festivo y
//   casi no abrieron: con ella de partida, el crecimiento salía de +56 %, inflado).
export const DELICANTERIA = {
  segundos: 9,
  mitad: 6,
  semanas: [
    { semana: "19 oct", visitas: 352 },
    { semana: "26 oct", visitas: 427 },
    { semana: "2 nov", visitas: 455 },
  ],
};
