// ============================================================================
// ICONOS DE LA INTERFAZ
// ----------------------------------------------------------------------------
// Trazos simples en una rejilla de 24, del color del texto (currentColor). Antes
// cada botón llevaba un emoji: en cada teléfono se ven distintos, en Android
// algunos salen como cuadros y en una herramienta de trabajo parecen de juguete.
//
// Añadir uno = una entrada en TRAZOS con su SVG interior.
// ============================================================================

const TRAZOS = {
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  regalo: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12M12 8c-1.2-2.8-4.8-3.6-5-1.3C6.8 8 9.4 8 12 8c2.6 0 5.2 0 5-1.3C16.8 4.4 13.2 5.2 12 8z" />
    </>
  ),
  campana: <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  campanaNo: <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0M3.5 3.5l17 17" />,
  instalar: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M12 7.5v6.5M9.5 11.5L12 14l2.5-2.5M10.5 18.5h3" />
    </>
  ),
  cartera: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18M15.5 15h2.5M6 6l9-3 1.5 3" />
    </>
  ),
  camara: (
    <>
      <path d="M3 9.5A2.5 2.5 0 0 1 5.5 7H8l1.5-2.5h5L16 7h2.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  linterna: <path d="M8 3h8v4l-2 3v11h-4V10L8 7zM8 7h8M12 13.5v2" />,
  nfc: <path d="M7 8.5a7.5 7.5 0 0 1 0 7M10.5 6.2a11.5 11.5 0 0 1 0 11.6M14 4a15.5 15.5 0 0 1 0 16M4 11.2v1.6" />,
  ubicacion: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  copiar: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </>
  ),
  volver: <path d="M15 5l-7 7 7 7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6a6.2 6.2 0 0 1 3.5 5.4" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  megafono: <path d="M4 10v4h3l7.5 4.5v-13L7 10zM18 9a4.2 4.2 0 0 1 0 6" />,
  nota: <path d="M6 3h9l4 4v14H6zM14.5 3v4.5H19M9.5 12h6M9.5 16h4" />,
  qr: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
    </>
  ),
  estrella: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z" />,
  papelera: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  alerta: <path d="M12 4l9 16H3zM12 10v4.5M12 17.2v.3" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  diana: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  corazonRoto: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20zM12 7.2l-1.6 3.6 3 2-1.4 3.4" />,
  copo: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5" />,
  llama: <path d="M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.4 2.6-5.2 3.6-8.2.9 1.4 1.3 2.6 1.4 3.9 1.3-1.6 2.2-4.3 1.9-7.4 3.8 2.4 6.1 6.4 6.1 10.4 0 4.6-2.8 7.6-6.5 7.6z" />,
  brote: <path d="M12 21v-9M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5zM12 14.5c0-3.6 2.6-6 6.5-6 0 3.6-2.6 6-6.5 6z" />,
  luna: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  fantasma: <path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5zM10 10.5v1M14 10.5v1" />,
  trofeo: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M10 17h4l.5 3h-5z" />,
  puerta: <path d="M6 21V3.5h9V21M15 5l4 1.5V21M11.5 12v1M3.5 21h17" />,
  movil: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
};

export const ICONOS = Object.keys(TRAZOS);

/**
 * @param {{nombre:string, tam?:number, grosor?:number, style?:object, titulo?:string}} props
 *   Sin `titulo` es decorativo (aria-hidden): el texto del botón ya lo dice.
 */
export default function Icono({ nombre, tam = 20, grosor = 1.9, style, titulo }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block", ...style }}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {trazo}
    </svg>
  );
}
