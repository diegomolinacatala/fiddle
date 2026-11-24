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
.alta-buscar{display:grid;gap:10px;min-width:0}
.alta-combo{position:relative;min-width:0}
.alta-combo-lupa{position:absolute;left:14px;top:14px;color:${P.tintaSuave};pointer-events:none}
.alta-campo .alta-combo input[type=text]{padding-left:42px}
.alta-lista{position:absolute;z-index:20;left:0;right:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;
  background:${P.superficie};border:1px solid ${P.vison}33;border-radius:14px;box-shadow:0 14px 34px -12px ${P.espresso}55}
.alta-opcion{display:flex;gap:12px;align-items:center;min-height:52px;padding:8px 10px;border-radius:10px;cursor:pointer}
.alta-opcion.activa{background:${P.verdeClaro}}
.alta-opcion-icono{flex:none;width:32px;height:32px;border-radius:9px;background:${P.avenaClara};color:${P.verde};
  display:grid;place-items:center}
.alta-opcion-texto{display:grid;min-width:0;line-height:1.3}
.alta-opcion-texto strong{font-weight:650;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.alta-opcion-texto span{font-size:13px;color:${P.vison};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.alta-opcion-mapa{border-top:1px solid ${P.vison}22;border-radius:0 0 10px 10px;margin-top:4px}
.alta-opcion-mapa .alta-opcion-icono{background:${P.camelClaro};color:${P.camelOscuro}}
.alta-opcion-nada{padding:12px 10px;font-size:14px;color:${P.vison}}
.alta-buscar-pie{display:flex;justify-content:flex-start}
.alta-enlace{display:inline-flex;gap:6px;align-items:center;min-height:44px;padding:0;border:0;background:none;
  font:inherit;font-size:14px;font-weight:600;color:${P.verde};cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.alta-enlace:focus-visible,.alta-chico:focus-visible{outline:2px solid ${P.verde};outline-offset:2px;border-radius:8px}
.alta-aviso{margin:0;font-size:13px;color:${P.camelOscuro}}
.alta-lugar{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:${P.superficie};
  border:1px solid ${P.verde}55;min-width:0}
.alta-lugar-icono{flex:none;width:40px;height:40px;border-radius:12px;background:${P.verdeClaro};color:${P.verde};
  display:grid;place-items:center}
.alta-lugar-texto{display:grid;min-width:0;flex:1;line-height:1.3}
.alta-lugar-texto strong{font-weight:650;overflow-wrap:anywhere}
.alta-lugar-texto span{font-size:13px;color:${P.vison};overflow-wrap:anywhere}
.alta-chico{flex:none;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid ${P.vison}55;background:transparent;
  font:inherit;font-size:14px;font-weight:600;color:${P.espresso};cursor:pointer}
.alta-chico:hover{background:${P.avenaClara}}
.alta-mapa-marco{display:grid;gap:8px;min-width:0}
.alta-mapa-caja{height:240px;width:100%;border-radius:14px;overflow:hidden;background:${P.avenaClara};
  border:1px solid ${P.vison}33}
.alta-mapa-pista{margin:0;font-size:13px;color:${P.tintaSuave}}
.alta-pin{cursor:grab;line-height:0;filter:drop-shadow(0 3px 3px ${P.espresso}55)}
.alta-pin:active{cursor:grabbing}
.alta-mapa-caja .maplibregl-ctrl-attrib{font-size:11px}
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
