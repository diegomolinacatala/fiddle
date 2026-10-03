import { svgLogo, svgLogoGoogle, comoDataUri, temaDelPase } from "@/lib/apple/dibujo";
import { logoImagenDe, rutaLogoImagen } from "@/lib/logo";

// ============================================================================
// EL LOGO, COMO LO PINTA CADA WALLET
// ----------------------------------------------------------------------------
// Dibujo (svgLogo / svgLogoGoogle) o la imagen propia de la tienda
// (lib/logo.js), con las mismas reglas que el servidor al hacer el .pkpass y el
// logo de Google (lib/logoImagen.js): una imagen opaca va a sangre, con
// esquinas; con transparencias, centrada sobre el fondo de la tarjeta.
// ============================================================================

/** El de arriba a la izquierda del pase de Apple (y de la tarjeta web). */
export function LogoApple({ tema, tam = 32, style }) {
  const logo = logoImagenDe(tema);
  if (!logo) return <img src={comoDataUri(svgLogo(temaDelPase(tema)))} alt="" width={tam} height={tam} style={{ display: "block", ...style }} />;
  return (
    <img
      src={rutaLogoImagen(tema, tam * 3)}
      alt=""
      width={tam}
      height={tam}
      style={{ display: "block", objectFit: "contain", borderRadius: logo.opaco ? tam * 0.18 : 0, ...style }}
    />
  );
}

/** El círculo de Google Wallet. */
export function LogoGoogle({ tema, tam = 66, style }) {
  const logo = logoImagenDe(tema);
  if (!logo) {
    return <img src={comoDataUri(svgLogoGoogle(tema, tam * 2))} alt="" width={tam} height={tam} style={{ borderRadius: "50%", display: "block", ...style }} />;
  }
  return (
    <span style={{ width: tam, height: tam, borderRadius: "50%", background: tema.cardBg || "#fff", overflow: "hidden", display: "grid", placeItems: "center", ...style }}>
      <img
        src={rutaLogoImagen(tema, tam * 3)}
        alt=""
        style={logo.opaco ? { width: "100%", height: "100%", objectFit: "cover" } : { width: "62%", height: "62%", objectFit: "contain" }}
      />
    </span>
  );
}
