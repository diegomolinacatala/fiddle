// La marca de fiddle: la «f» y el sello rosa como punto final, y el nombre al
// lado. Los trazos son los de docs/marca/fiddle-logo.svg (el del Perfil de
// Empresa de Google Wallet), recortados al cuadrado del icono. La usan la web
// (/home) y el login. `claro`: crema con la «f» en tinta, para ponerlo sobre la
// tinta, donde el cuadrado oscuro no se vería. El nombre va del color del texto.
export default function LogoFiddle({ tam = 30, claro = false }) {
  const [fondo, letra] = claro ? ["#fff7ea", "#1d1b2e"] : ["#1d1b2e", "#fff7ea"];
  return (
    <span style={{ ...caja, gap: tam * 0.3, fontSize: tam * 0.67 }}>
      <svg width={tam} height={tam} viewBox="0 0 1024 1024" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
        <rect width="1024" height="1024" rx="230" fill={fondo} />
        <g transform="translate(512 512) scale(1.15) translate(-526 -530)">
          <path d="M452 770 V430 Q452 290 592 290 H640" fill="none" stroke={letra} strokeWidth="118" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M330 475 H560" fill="none" stroke={letra} strokeWidth="118" strokeLinecap="round" />
          <circle cx="672" cy="737" r="92" fill="#ff5c8a" />
        </g>
      </svg>
      <span>fiddle</span>
    </span>
  );
}

const caja = { display: "inline-flex", alignItems: "center", fontWeight: 650, letterSpacing: "-0.035em", lineHeight: 1 };
