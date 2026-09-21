import { svgLogo, svgMarca, comoDataUri } from "@/lib/apple/dibujo";

// La marca de la tienda (la misma del logo del pase) donde antes iba su emoji.
// `icono`: sobre su color, con esquinas, como el icono de la app instalada.
export default function MarcaTienda({ tema, tam = 28, icono = false, style }) {
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
