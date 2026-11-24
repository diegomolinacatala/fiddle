import { PALETA as P } from "@/app/home/paleta";

// La web de venta, en versión formulario: papel de fondo, espresso para el texto y
// el verde de la marca para el botón. Móvil primero (columna única, sin scroll
// lateral a 320 px); a partir de 860 px la tarjeta se queda a un lado.
export const estilo = `
.alta{min-height:100dvh;background:${P.papel};color:${P.espresso};color-scheme:light;
  font-family:var(--fuente-web),system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.5;
  -webkit-font-smoothing:antialiased;overflow-x:clip}
body:has(.alta){background:${P.papel}}
.alta-dentro{max-width:960px;margin:0 auto;padding:20px 16px 56px}
.alta-marca{display:inline-block;font-weight:700;font-size:20px;letter-spacing:-.02em;color:${P.verde};text-decoration:none;
  min-height:44px;line-height:44px}
.alta h1{font-size:clamp(1.6rem,1.2rem + 2.2vw,2.4rem);line-height:1.1;letter-spacing:-.025em;font-weight:650;margin:8px 0 10px}
.alta-sub{color:${P.vison};margin:0 0 24px;max-width:46ch}
.alta-cols{display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
@media (min-width:860px){
  .alta-cols{grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:48px;align-items:start}
  .alta-tarjeta{position:sticky;top:20px}
}
.alta-tarjeta{display:grid;justify-items:center}
.alta-tarjeta > div{width:100%;max-width:340px}
.alta-form{display:grid;gap:18px;min-width:0}
.alta-campo{display:grid;gap:6px;min-width:0}
.alta-campo label,.alta-campo .alta-etiqueta{font-size:14px;font-weight:600}
.alta-campo input[type=text],.alta-campo input[type=email],.alta-campo input[type=tel]{
  width:100%;min-height:48px;padding:0 14px;border-radius:12px;border:1px solid ${P.vison}55;background:${P.superficie};
  color:${P.espresso};font:inherit;font-size:16px}
.alta-campo input:focus-visible{outline:2px solid ${P.verde};outline-offset:2px}
.alta-campo input[aria-invalid=true]{border-color:#a62b1f}
.alta-ayuda{font-size:13px;color:${P.tintaSuave}}
.alta-error{font-size:13px;color:#a62b1f;font-weight:500}
.alta-mapa{min-width:0}
.alta-mapa .leaflet-container{max-width:100%}
.alta-acepto{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:${P.vison}}
.alta-acepto input{width:22px;height:22px;flex:none;margin:1px 0 0;accent-color:${P.verde}}
.alta-acepto a{color:${P.verde}}
.alta-boton{min-height:52px;border:0;border-radius:14px;background:${P.verde};color:${P.papel};font:inherit;
  font-weight:600;font-size:16px;cursor:pointer;padding:0 20px;touch-action:manipulation}
.alta-boton:hover:not(:disabled){background:${P.verdeEncima}}
.alta-boton:focus-visible{outline:2px solid ${P.espresso};outline-offset:3px}
.alta-boton:disabled{opacity:.6;cursor:default}
.alta-fallo{padding:12px 14px;border-radius:12px;background:#f6dcd7;color:#6b1d14;font-size:14px}
.alta-trampa{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.alta-pie{font-size:13px;color:${P.tintaSuave}}
`;
