import { NOMBRE, svgLogoLacre } from "@/lib/lacre";

// La marca de fiddle: el lacre y el nombre (lib/lacre.js), un solo dibujo. La usan
// la web (/home) y el login.
// - `tam`: alto del sello en px; el nombre va a su escala.
// - `color`: el de la marca. De partida, el del texto (sirve en claro y en oscuro).
// - `id`: el de la máscara que recorta la f. Dos logos en la misma página
//   necesitan ids distintos (la cabecera y el pie).
export default function LogoFiddle({ tam = 30, color = "currentColor", id = "lacre" }) {
  const { x, y, ancho, alto } = NOMBRE.encuadre;
  return (
    <svg
      width={(tam * ancho) / alto}
      height={tam}
      viewBox={`${x} ${y} ${ancho} ${alto}`}
      role="img"
      aria-label="fiddle"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
      // Dibujo propio y fijo (lib/lacre.js), el mismo que sale en los iconos.
      dangerouslySetInnerHTML={{ __html: svgLogoLacre({ color, id }) }}
    />
  );
}
