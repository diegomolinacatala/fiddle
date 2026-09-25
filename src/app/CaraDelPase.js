import { camposDelPase } from "@/lib/apple/pase";
import { svgLogo, stripDelPase, comoDataUri } from "@/lib/apple/dibujo";
import { estadoDe } from "@/lib/resumen";
import { describirBanda } from "@/lib/cartillas";

// ============================================================================
// LA CARA DE LA TARJETA
// ----------------------------------------------------------------------------
// Cabecera, banda a sangre y campos: la disposición del pase de Apple con la
// tipografía del sistema. La usan la tarjeta web (/p/<serial>, que le pone el QR
// debajo) y la página de la tienda al darla de alta. Todo sale de
// camposDelPase(), stripDelPase() y svgLogo(), los mismos que arman el .pkpass:
// si se separan, mienten.
//
// `claseBanda`: la tarjeta web la cambia para animar la banda con cada sello.
// `children`: lo que va dentro de la tarjeta, debajo de los campos.
// ============================================================================

export default function CaraDelPase({ cliente, negocio, claseBanda = "banda", children = null }) {
  const t = negocio.tema;
  const e = estadoDe(cliente, negocio);
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const banda = stripDelPase(negocio, cliente);
  const campos = [...secondaryFields, ...auxiliaryFields];

  return (
    <article style={{ ...tarjeta, background: t.cardBg, color: t.ink }} aria-label={`Tarjeta de ${negocio.nombre}`}>
      <header style={cabecera}>
        <img src={comoDataUri(svgLogo(t))} alt="" width={30} height={30} style={{ display: "block", flexShrink: 0 }} />
        <strong style={nombreTienda}>{negocio.nombre}</strong>
        {headerFields.map((f) => (
          <div key={f.key} style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={etiqueta(t.accent)}>{f.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.15 }}>{f.value}</div>
          </div>
        ))}
      </header>

      <div style={{ position: "relative" }}>
        {/* key: cada sello nuevo vuelve a montar la banda y la animación se ve */}
        <img
          key={`${cliente.sellos}-${cliente.sellos2}-${cliente.premios}`}
          className={claseBanda}
          src={comoDataUri(banda.svg)}
          alt={e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio)}
          style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${banda.ancho} / ${banda.alto}` }}
        />
        {primaryFields.length > 0 && (
          <div style={sobreLaBanda}>
            <div style={{ ...etiqueta("#fff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
            <div style={descuento}>{primaryFields[0].value}</div>
          </div>
        )}
      </div>

      {campos.length > 0 && (
        <div style={{ display: "flex", gap: 16, padding: children ? "14px 18px 0" : "14px 18px 18px" }}>
          {campos.map((f) => (
            <div key={f.key} style={{ flex: 1, minWidth: 0 }}>
              <div style={etiqueta(t.accent)}>{f.label}</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2, overflowWrap: "anywhere" }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {children}
    </article>
  );
}

const tarjeta = {
  position: "relative",
  borderRadius: 22,
  overflow: "hidden",
  boxShadow: "0 22px 44px -18px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.1), inset 0 0 0 1px rgba(255,255,255,.06)",
};

const cabecera = { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px" };
const nombreTienda = { flex: 1, minWidth: 0, fontSize: 16, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const etiqueta = (color) => ({
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color,
});

const sobreLaBanda = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "0 18px",
  maxWidth: "64%",
};

const descuento = { fontSize: 26, fontWeight: 750, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 3px rgba(0,0,0,.3)" };
