import { camposDelPase } from "@/lib/apple/pase";
import { stripDelPase, comoDataUri, colorDelPase } from "@/lib/apple/dibujo";
import { LogoApple } from "@/app/LogoTienda";
import { estadoDe } from "@/lib/resumen";
import { describirBanda } from "@/lib/cartillas";
import { WALLET as W, FUENTE_PASE, colocarFila, medirAprox } from "@/lib/vistaWallet";
import AbiertoAhora from "@/app/AbiertoAhora";

// ============================================================================
// LA CARA DE LA TARJETA
// ----------------------------------------------------------------------------
// Cabecera, banda a sangre y campos: la disposición del pase de Apple, con las
// medidas de un pase de verdad (WALLET en lib/vistaWallet.js). La usan la tarjeta
// web (/p/<serial>, que le pone el QR debajo), la página de la tienda al darla de
// alta y la web de fiddle. Todo sale de camposDelPase(), stripDelPase() y svgLogo(),
// los mismos que arman el .pkpass: si se separan, mienten.
//
// `qr` ({ src, codigo }): la tarjeta entera, como en la Cartera: con el alto de
// Wallet y el código en su caja blanca, pegado abajo.
// `ancho`: el ancho para el que se reparte la fila de campos (encoge como en iOS).
// `claseBanda`: la tarjeta web la cambia para animar la banda con cada sello.
// `children`: lo que va dentro de la tarjeta, debajo de los campos.
// `data-parte` (cabecera, banda, campos): lo que encuadra la cámara de /home/tarjeta.
// `horario`: si viene, "Abierto hasta las 18:30" bajo el nombre (AbiertoAhora).
// Solo lo pasa la tarjeta web: el pase de Wallet no puede llevarlo, y en el alta
// el cliente está en la tienda.
// `estado`: la línea "● Abierto hasta las 20:00" DIBUJADA en lo alto de la banda,
// como la lleva el pase de Wallet ({abierta, texto} de estadoParaPase). La pasa
// la web de fiddle (/home) para enseñar el pase tal cual.
// ============================================================================

export default function CaraDelPase({ cliente, negocio, claseBanda = "banda", horario = null, estado = null, qr = null, ancho = W.ancho, children = null }) {
  const t = negocio.tema;
  const e = estadoDe(cliente, negocio);
  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = camposDelPase(cliente, negocio);
  const banda = stripDelPase(negocio, cliente, { estado });
  const campos = [...secondaryFields, ...auxiliaryFields];
  // Una regla de tres y no un canvas: esto también se pinta en el servidor.
  const fila = colocarFila(campos, {
    total: ancho - W.margen * 2, hueco: W.hueco, max: W.valor, min: W.valorMin,
    medir: medirAprox, etiquetas: campos.map((f) => medirAprox(f.label, W.etiqueta)),
  });
  const abajo = children || qr ? 0 : 18;

  return (
    <article className="cara-pase" style={{ ...tarjeta, "--pt": `calc(100cqw / ${ancho})`, ...(qr ? entera : null), background: t.cardBg, color: t.ink }} aria-label={`Tarjeta de ${negocio.nombre}`}>
      <header style={cabecera} data-parte="cabecera">
        <LogoApple tema={t} tam={W.logo} style={{ flexShrink: 0, width: pt(W.logo), height: pt(W.logo) }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={nombreTienda}>{negocio.nombre}</strong>
          {horario && <AbiertoAhora horario={horario} />}
        </div>
        {headerFields.map((f) => (
          <div key={f.key} style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={etiqueta(colorDelPase(t))}>{f.label}</div>
            <div style={{ fontSize: pt(W.valorCabecera), fontWeight: 400, lineHeight: 1.1, marginTop: pt(2) }}>{f.value}</div>
          </div>
        ))}
      </header>

      {/* Alto de Wallet y `cover`: la banda se pinta más alta que su imagen y pierde los lados. */}
      <div style={{ position: "relative", flexShrink: 0, aspectRatio: `${W.ancho} / ${W.banda}` }} data-parte="banda">
        {/* key: cada sello nuevo vuelve a montar la banda y la animación se ve */}
        <img
          key={`${cliente.sellos}-${cliente.sellos2}-${cliente.premios}`}
          className={claseBanda}
          src={comoDataUri(banda.svg)}
          alt={e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio)}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
        {primaryFields.length > 0 && (
          <div style={sobreLaBanda}>
            <div style={{ ...etiqueta("#fff"), opacity: 0.9 }}>{primaryFields[0].label}</div>
            <div style={descuento}>{primaryFields[0].value}</div>
          </div>
        )}
      </div>

      {campos.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: pt(W.hueco), padding: `${pt(W.arribaCampos)} ${pt(W.margen)} ${pt(abajo)}` }} data-parte="campos">
          {campos.map((f, i) => (
            <div key={f.key} style={{ flex: "0 1 auto", minWidth: 0 }}>
              <div style={{ ...etiqueta(colorDelPase(t)), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</div>
              <div style={{ fontSize: pt(fila[i].tam), fontWeight: 400, lineHeight: 1.18, marginTop: pt(3), letterSpacing: "-0.01em" }}>
                {fila[i].lineas.map((l, j) => <div key={j} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {children}

      {qr && (
        <div style={sitioQr}>
          <div style={cajaQr}>
            <img src={qr.src} alt="" width={W.qr} height={W.qr} style={{ display: "block", width: "100%", height: "auto" }} />
            <div style={{ fontSize: pt(W.codigo), lineHeight: 1.2, marginTop: pt(3) }}>{qr.codigo}</div>
          </div>
        </div>
      )}
    </article>
  );
}

// Las medidas son puntos de una tarjeta de `ancho` (las de Wallet) y crecen o
// encogen con lo que mida de verdad: `--pt` es un punto, sacado del ancho del
// artículo (container query). Con px fijos, en una tarjeta más estrecha que
// `ancho` (un móvil de 320) las letras no encogían y se cortaban. Donde no hay
// container queries (iOS 15), app/layout.js deja `--pt` en 1px: como antes.
const pt = (n) => `calc(${n} * var(--pt, 1px))`;

const tarjeta = {
  containerType: "inline-size",
  position: "relative",
  borderRadius: W.radio,
  overflow: "hidden",
  fontFamily: FUENTE_PASE,
  boxShadow: "0 22px 44px -18px rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.1), inset 0 0 0 1px rgba(255,255,255,.06)",
};

// El alto lo pone Wallet: lo que sobra queda entre los campos y el código.
const entera = { aspectRatio: `${W.ancho} / ${W.alto}`, display: "flex", flexDirection: "column" };

// El brillo de arriba es de Wallet: la cabecera sale un pelo más clara que el resto.
const cabecera = {
  display: "flex", alignItems: "center", gap: pt(12), minHeight: pt(W.cabecera), padding: `0 ${pt(W.margen)}`, flexShrink: 0,
  background: "linear-gradient(rgba(255,255,255,.07), rgba(255,255,255,0))",
};
const nombreTienda = { display: "block", fontSize: pt(W.nombre), fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const etiqueta = (color) => ({
  fontSize: pt(W.etiqueta),
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: pt(0.4),
  textTransform: "uppercase",
  color,
});

const sobreLaBanda = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: `0 ${pt(W.margen)}`,
  maxWidth: "64%",
};

const descuento = { fontSize: pt(26), fontWeight: 750, color: "#fff", lineHeight: 1.1, textShadow: "0 1px 3px rgba(0,0,0,.3)" };

const sitioQr = { marginTop: "auto", display: "flex", justifyContent: "center", padding: `${pt(10)} 0 ${pt(W.abajoQr)}` };
const cajaQr = { width: `${(W.cajaQr / W.ancho) * 100}%`, padding: `${pt(8)} ${pt(9)} ${pt(5)}`, borderRadius: pt(7), background: "#fff", color: "#000", textAlign: "center", boxSizing: "border-box" };
