"use client";

import Icono from "@/app/Icono";
import { C, aviso, legible } from "@/app/ui";
import { svgMarca, comoDataUri } from "@/lib/apple/dibujo";

// ============================================================================
// LOS BOTONES DE LA CAJA. Solo pintan: qué pasa al pulsar (al instante, y la
// petición detrás) lo decide TarjetaCaja.
//
// Una FILA por cartilla, de lado a lado: toda ella suma ("Añadir cookie  +").
// El "−" de la izquierda quita uno: está en la misma fila, pequeño, porque
// corregir es la excepción y no merece un botón igual de grande al lado (con
// prisa se pulsa el que no es). Las filas salen de filasDeCaja (lib/caja.js).
//
// «Deshacer cambios» va al final, debajo de lo que acaba de pasar: con algo
// hecho en la ficha, la deja como al escanearla (lib/deshacer.js). No es una
// fila de la caja: no suma ni quita nada que no se acabe de hacer aquí.
// ============================================================================

export default function WorkerActions({ filas, premios = [], tema = null, accent = C.texto, ejecutar, toast, grande = false, onCancelarVuelta, onDeshacer, deshacerCambios = null }) {
  if (!filas.length && !premios.length) {
    return <p style={{ color: C.suave, fontSize: 14, marginTop: 18 }}>El manager no ha activado ninguna acción.</p>;
  }
  const alto = grande ? 76 : 62;

  return (
    <div style={{ marginTop: 16 }}>
      {premios.map((p) => (
        <Premio key={p.indice} p={p} tema={tema} accent={accent} ejecutar={ejecutar} />
      ))}
      <div style={{ display: "grid", gap: 10 }}>
        {filas.map((f) => (f.tipo === "cartilla"
          ? <FilaCartilla key={f.key} f={f} accent={accent} ejecutar={ejecutar} alto={alto} grande={grande} />
          : (
            <button key={f.key} type="button" onClick={() => ejecutar(f.key)} style={botonFila(accent, f.correccion, alto, grande)}>
              <Icono nombre={f.icon} tam={grande ? 24 : 21} grosor={2.2} />
              <span>{f.label}</span>
            </button>
          )))}
      </div>
      {toast && (
        <div role="status" style={{ ...aviso(toast.ok), marginTop: 12, position: "relative", overflow: "hidden" }}>
          {toast.msg}
          {toast.detalle && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{toast.detalle}</div>}
          {toast.deshacer && <Deshacer key={toast.id} segundos={toast.deshacer} onDeshacer={onDeshacer} />}
          {toast.vuelta && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 13 }}>
              <span style={{ flex: 1 }}>Volviendo al escáner en {toast.vuelta} s…</span>
              <button type="button" onClick={onCancelarVuelta} style={{ border: 0, background: "transparent", color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
                Quedarme aquí
              </button>
            </div>
          )}
        </div>
      )}
      {deshacerCambios && (
        <button type="button" onClick={deshacerCambios.onClick} style={botonDeshacerCambios}>
          <Icono nombre="deshacer" tam={19} grosor={2.2} />
          <span style={{ display: "grid", gap: 1, textAlign: "left" }}>
            <span style={{ fontSize: 15, fontWeight: 650, color: C.texto }}>Deshacer cambios</span>
            <span style={{ fontSize: 12.5 }}>
              Deja la tarjeta como al escanearla{deshacerCambios.como ? ` (${deshacerCambios.como})` : ""}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * El dibujo del premio de una cartilla (la cookie, la taza): el mismo de sus
 * casillas en la tarjeta. Con una sola cartilla, la marca de la tienda.
 */
function DibujoPremio({ tema, marca, tam }) {
  if (!tema) return <Icono nombre="cartera" tam={tam * 0.7} grosor={2.2} />;
  const svg = svgMarca(marca ? { ...tema, marca } : tema, 96, { fondo: null, color: "#ffffff", escala: 0.86 });
  return <img src={comoDataUri(svg)} alt="" width={tam} height={tam} style={{ display: "block" }} />;
}

// DESHACER, dentro del mismo aviso que confirma el premio: donde ya está mirando
// quien lo dio. Un botón de verdad (no un enlace) y, bajo el aviso, una barra que
// se vacía en `segundos`: se ve que el plazo corre sin una cuenta atrás que meta
// prisa. Al acabar, TarjetaCaja quita esto y el aviso se queda como siempre.
// Con «reducir movimiento», la barra no se mueve: el aviso cambia igual al acabar.
// Va con `key` del premio en espera: un segundo premio seguido estrena su barra.
const CSS_DESHACER = `
@keyframes caja-deshacer { from { transform: scaleX(1) } to { transform: scaleX(0) } }
.caja-deshacer { transform-origin: left; animation: caja-deshacer linear forwards; }
@media (prefers-reduced-motion: reduce) { .caja-deshacer { animation: none } }
`;
function Deshacer({ segundos, onDeshacer }) {
  return (
    <>
      <style>{CSS_DESHACER}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <span style={{ flex: 1, fontSize: 13 }}>¿Ha sido sin querer?</span>
        <button type="button" onClick={onDeshacer} style={botonDeshacer}>Deshacer</button>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "currentColor", opacity: 0.15 }} />
      <div aria-hidden="true" className="caja-deshacer" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "currentColor", animationDuration: `${segundos}s` }} />
    </>
  );
}

/** [ − | Añadir cookie  + | +2 ]: toda la fila suma; el − quita; el +2 suma dos. */
function FilaCartilla({ f, accent, ejecutar, alto, grande }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {f.restar && (
        <button type="button" onClick={() => ejecutar(f.restar)} aria-label={`Quitar uno (${f.label.replace(/^Añadir /, "")})`} title="Quitar uno: corrige un punto de más"
          style={{ ...menos(accent), minHeight: alto, width: grande ? 60 : 52 }}>
          <Icono nombre="menos" tam={grande ? 24 : 20} grosor={2.4} />
        </button>
      )}
      <button type="button" onClick={() => ejecutar(f.key)} style={{ ...sumar(accent), minHeight: alto, fontSize: grande ? 18 : 16 }}>
        <span style={{ flex: 1, textAlign: "left" }}>{f.label}</span>
        <Icono nombre="mas" tam={grande ? 28 : 24} grosor={2.4} />
      </button>
      {f.dos && (
        <button type="button" onClick={() => ejecutar(f.key, 2)} aria-label={`Sumar dos (${f.label.replace(/^Añadir /, "")})`}
          style={{ ...menos(accent), minHeight: alto, width: grande ? 64 : 56, fontWeight: 750, fontSize: grande ? 18 : 16 }}>
          +2
        </button>
      )}
    </div>
  );
}

// EL PREMIO. Solo aparece cuando hay algo que dar, y pregunta lo que hay que
// preguntarle al cliente con las mismas palabras: "¿lo quieres ahora o te lo
// guardo?". Cada botón dice debajo qué pasa con la tarjeta, para que nadie
// tenga que saberse las reglas. Si la tienda no guarda premios, solo se da.
function Premio({ p, tema, accent, ejecutar }) {
  const de = p.nombre ? ` de ${p.nombre.toLowerCase()}` : "";
  const boton = (key, texto, detalle, principal) => (
    <button
      type="button"
      onClick={() => ejecutar(key)}
      style={botonPremio(principal, accent)}
    >
      <span style={{ fontSize: 16, fontWeight: 700 }}>{texto}</span>
      <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>{detalle}</span>
    </button>
  );

  return (
    <section style={cajaPremio(accent)} aria-label={`Premio${de}`}>
      {p.completa && (
        <>
          <div style={cabeceraPremio}>
            <span style={insignia(accent)}><Icono nombre="regalo" tam={22} grosor={2.2} /></span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Cartilla{de} completa</div>
              <div style={{ fontSize: 14, color: C.suave }}>
                Premio: {p.premio}.{p.acciones.guardar ? " ¿Lo quiere ahora o se lo guardas?" : ""}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {boton(p.acciones.dar, "Dárselo ahora", "La cartilla vuelve a empezar", true)}
            {p.acciones.guardar && boton(p.acciones.guardar, "Guardarlo para otro día", "Queda en su tarjeta y sigue sumando puntos", false)}
          </div>
        </>
      )}
      {p.guardados > 0 && (
        <div style={p.completa ? { borderTop: `1px solid ${accent}33`, marginTop: 12, paddingTop: 12 } : null}>
          {/* Lo guardado se reconoce de un vistazo: el dibujo de SU premio (la cookie, el café)
              y su nombre en grande. Con dos cartillas, «premio guardado» a secas no dice cuál. */}
          <div style={cabeceraPremio}>
            <span style={{ ...insignia(accent), width: 52, height: 52, borderRadius: 14 }}>
              <DibujoPremio tema={tema} marca={p.marca} tam={40} />
            </span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{p.premio.charAt(0).toUpperCase() + p.premio.slice(1)}</div>
              <div style={{ fontSize: 14, color: C.suave }}>
                {p.guardados === 1 ? "Tiene 1 premio guardado" : `Tiene ${p.guardados} premios guardados`}
              </div>
            </div>
          </div>
          {boton(
            p.acciones.usar,
            "Usar un premio guardado",
            p.guardados > 1 ? `Le quedarán ${p.guardados - 1}` : "Sus puntos no se tocan",
            !p.completa,
          )}
        </div>
      )}
    </section>
  );
}

const cajaPremio = (accent) => ({
  border: `2px solid ${accent}`, background: `${accent}12`, borderRadius: 14,
  padding: 14, marginBottom: 12,
});
const cabeceraPremio = { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 };
const insignia = (accent) => ({
  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
  display: "grid", placeItems: "center", background: accent, color: "#fff",
});
const botonPremio = (principal, accent) => ({
  width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  minHeight: 60, padding: "10px 12px", borderRadius: 12, cursor: "pointer",
  border: principal ? 0 : `1.5px solid ${accent}`,
  background: principal ? accent : C.panel, color: principal ? "#fff" : legible(accent),
});

const botonDeshacerCambios = {
  width: "100%", display: "flex", alignItems: "center", gap: 12, marginTop: 12,
  minHeight: 52, padding: "8px 16px", borderRadius: 14, cursor: "pointer",
  border: `1px solid ${C.bordeFuerte}`, background: C.panel, color: C.suave,
};

const botonDeshacer = {
  minHeight: 40, padding: "0 16px", borderRadius: 10, cursor: "pointer",
  border: "1.5px solid currentColor", background: C.panel, color: "inherit", fontWeight: 650, fontSize: 14,
};

const sumar = (accent) => ({
  flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 18px",
  borderRadius: 14, border: 0, background: accent, color: "#fff", fontWeight: 650, cursor: "pointer",
  boxShadow: `0 2px 0 ${accent}55`,
});
const menos = (accent) => ({
  flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 14, cursor: "pointer",
  border: `1.5px solid ${accent}55`, background: C.panel, color: legible(accent),
});
const botonFila = (accent, correccion, alto, grande) => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  minHeight: alto, padding: "0 16px", borderRadius: 14,
  border: correccion ? `1.5px solid ${accent}` : 0,
  background: correccion ? C.panel : accent, color: correccion ? legible(accent) : "#fff",
  fontWeight: 650, fontSize: grande ? 18 : 16, cursor: "pointer",
});
