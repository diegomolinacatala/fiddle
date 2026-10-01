import { svgLogo, svgMarca, comoDataUri } from "@/lib/apple/dibujo";
import { logoImagenDe, rutaLogoImagen } from "@/lib/logo";

// La marca de la tienda (la misma del logo del pase) donde antes iba su emoji.
// `icono`: sobre su color, con esquinas, como el icono de la app instalada.
// Con logo propio (lib/logo.js), su imagen: a sangre si es opaca, centrada
// sobre el fondo de la tarjeta si tiene transparencias.
export default function MarcaTienda({ tema, tam = 28, icono = false, style }) {
  const logo = logoImagenDe(tema);
  if (logo) {
    const src = rutaLogoImagen(tema, tam * 2);
    if (!icono) return <img src={src} alt="" width={tam} height={tam} style={{ display: "block", flexShrink: 0, objectFit: "contain", ...style }} />;
    return (
      <span style={{
        width: tam, height: tam, borderRadius: tam * 0.24, overflow: "hidden", flexShrink: 0,
        background: tema.cardBg || "#fff", display: "grid", placeItems: "center", ...style,
      }}>
        <img src={src} alt="" style={logo.opaco ? { width: "100%", height: "100%", objectFit: "cover" } : { width: "80%", height: "80%", objectFit: "contain" }} />
      </span>
    );
  }
  const svg = icono ? svgMarca(tema, 96, { escala: 0.74, radio: 96 * 0.24 }) : svgLogo(tema);
  return (
    <img
      src={comoDataUri(svg)}
      alt=""
      width={tam}
      height={tam}
      style={{ display: "block", flexShrink: 0, ...style }}
    />
  );
}
