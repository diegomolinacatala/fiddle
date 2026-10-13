import { VIOLIN, svgViolin } from "@/lib/violin";

// La marca de fiddle: el violín (lib/violin.js) y el nombre al lado. La usan la
// web (/home) y el login.
// - `tam`: alto del violín en px; el nombre se ajusta a él.
// - `color`: el del violín. De partida, el del texto (sirve en claro y en oscuro).
// - `id`: el de la máscara que recorta la efe. Dos logos en la misma página
//   necesitan ids distintos (la cabecera y el pie).
export default function LogoFiddle({ tam = 30, color = "currentColor", id = "efe" }) {
  const { x, y, ancho, alto } = VIOLIN.encuadre;
  return (
    <span style={{ ...caja, gap: tam * 0.24, fontSize: tam * 0.72 }}>
      <svg
        width={(tam * ancho) / alto}
        height={tam}
        viewBox={`${x} ${y} ${ancho} ${alto}`}
        aria-hidden="true"
        style={{ display: "block", flexShrink: 0, overflow: "visible" }}
        // Dibujo propio y fijo (lib/violin.js), el mismo que sale en los iconos.
        dangerouslySetInnerHTML={{ __html: svgViolin({ color, id }) }}
      />
      <span>fiddle</span>
    </span>
  );
}

const caja = { display: "inline-flex", alignItems: "center", fontWeight: 650, letterSpacing: "-0.035em", lineHeight: 1 };
