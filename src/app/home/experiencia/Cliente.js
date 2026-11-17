import { useRef } from "react";
import { PALETA as P } from "../paleta";

// ============================================================================
// EL CLIENTE
// ----------------------------------------------------------------------------
// Alguien que no está en tu cafetería y lleva tu tarjeta en el móvil. Lo único de
// la web dibujado a mano (la tarjeta y los avisos salen del pase). Ilustración
// plana, sin contornos y con los colores de PALETA; la pantalla del móvil lleva el
// color de la tarjeta (--tono-2): su tarjeta está ahí. Sin <text>.
//
// Cada pieza que se mueve tiene su propio grupo (respirar, parpadear, flotar,
// vibrar, mirar): así los movimientos no se pisan. Los mueve estiloCliente.js.
// `suena` es el contador de avisos (AvisoEnEscena): su paridad elige entre dos animaciones iguales
// con distinto nombre, la forma de reiniciar una animación CSS sin remontar el SVG.
// `movilRef` es el grupo del móvil: de ahí salen los avisos (AvisoEnEscena).
// ============================================================================

export default function Cliente({ presente, suena, movilRef }) {
  // Con avisos de antes (se vuelve a la prueba) no suena nada hasta que llegue uno nuevo.
  const inicial = useRef(suena);
  const sonando = suena !== inicial.current ? ` suena-${suena % 2}` : "";
  return (
    <div className={`exp-cliente${presente ? " presente" : ""}${sonando}`} aria-hidden="true">
      <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMax meet" focusable="false">
        <g className="cli-cuerpo">
          <path d="M6 300C6 246 44 216 120 216S234 246 234 300Z" fill={P.verde} />
          <path d="M84 218C92 236 106 244 120 244S148 236 156 218C146 212 132 210 120 210S94 212 84 218Z" fill={P.verdeEncima} />
          <rect x="102" y="176" width="36" height="48" rx="16" fill={P.avena} />
          <path d="M104 196C114 206 126 206 136 196V190H104Z" fill={P.camel} opacity=".4" />
          <g className="cli-cabeza">
            <circle cx="70" cy="146" r="10" fill={P.avena} />
            <circle cx="170" cy="146" r="10" fill={P.avena} />
            <ellipse cx="120" cy="138" rx="51" ry="56" fill={P.avena} />
            <circle cx="150" cy="70" r="17" fill={P.espresso} />
            <path d="M65 138C56 86 92 74 124 76C162 78 188 100 175 142C170 124 158 110 140 105C124 120 92 118 65 138Z" fill={P.espresso} />
            <circle cx="90" cy="162" r="9" fill={P.camel} opacity=".32" />
            <circle cx="150" cy="162" r="9" fill={P.camel} opacity=".32" />
            <g className="cli-cejas" fill="none" stroke={P.espresso} strokeWidth="4" strokeLinecap="round">
              <path d="M94 128Q104 123 113 127" />
              <path d="M127 127Q136 123 146 128" />
            </g>
            <g className="cli-ojos" fill={P.espresso}>
              <ellipse className="cli-ojo" cx="104" cy="146" rx="5" ry="6.5" />
              <ellipse className="cli-ojo" cx="138" cy="146" rx="5" ry="6.5" />
            </g>
            <path className="cli-boca" d="M107 166Q121 177 135 166" fill="none" stroke={P.espresso} strokeWidth="4.5" strokeLinecap="round" />
          </g>
        </g>
        <g className="cli-brazo">
          <path d="M150 300C146 268 160 244 184 230L210 254C200 268 204 286 218 300Z" fill={P.verdeEncima} />
          <g className="cli-movil" ref={movilRef}>
            <g transform="rotate(-12 186 246)">
              <rect x="164" y="204" width="46" height="80" rx="10" fill={P.espresso} />
              <rect x="168" y="209" width="38" height="70" rx="7" style={{ fill: "var(--tono-2)" }} />
              <rect x="173" y="216" width="28" height="18" rx="3.5" style={{ fill: "var(--tono)" }} />
              <rect x="173" y="240" width="20" height="4" rx="2" fill={P.papel} opacity=".7" />
              <rect x="173" y="249" width="14" height="4" rx="2" fill={P.papel} opacity=".5" />
              <rect className="cli-pantalla" x="168" y="209" width="38" height="70" rx="7" fill={P.papel} opacity="0" />
              <ellipse cx="187" cy="282" rx="15" ry="11" fill={P.avena} />
              <rect x="203" y="252" width="10" height="24" rx="5" fill={P.avena} />
              <rect x="160" y="250" width="11" height="28" rx="5.5" fill={P.avena} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
