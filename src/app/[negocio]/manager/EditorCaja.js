"use client";

import { useEffect, useMemo, useState } from "react";
import TarjetaCaja from "@/app/w/[serial]/TarjetaCaja";
import Icono from "@/app/Icono";
import { FilaInterruptor } from "@/app/Interruptor";
import { LISTA_ACCIONES } from "@/lib/acciones";
import { OPCIONES_CAJA, normalizarCaja } from "@/lib/caja";
import { C, botonPrimario, botonSecundario, chipCodigo } from "@/app/ui";

// ============================================================================
// EDITAR VISTA DE CAJA (manager)
// ----------------------------------------------------------------------------
// Lo que ve quien atiende al escanear una tarjeta. A la izquierda, qué puede
// hacer y cómo se le enseña; a la derecha, LA CAJA DE VERDAD (TarjetaCaja, en
// modo demo): se pulsa y se ve pasar, con un cliente de ejemplo que se puede
// poner a medias o con el premio listo. No guarda nada hasta "Guardar".
// ============================================================================

// Qué puede hacer la caja, dicho para quien no sabe cómo se llama por dentro.
const QUE_HACE = {
  sellar: { label: "Sumar sellos", descripcion: "La fila de cada cartilla: tocarla suma uno." },
  restar: { label: "Quitar uno", descripcion: "El «−» pequeño a la izquierda de la fila, para corregir." },
  canjear: { label: "Dar premios", descripcion: "Con la cartilla llena sale el recuadro del premio. En un cupón, aplicar el descuento." },
  confirmar: { label: "Confirmar visita", descripcion: "Apunta que vino sin tocar la cartilla (cuenta para los avisos)." },
};

const EJEMPLOS = [["medias", "A medias"], ["listo", "Con el premio listo"], ["guardado", "Con un premio guardado"]];

export default function EditorCaja({ negocio, slug, onCerrar, onGuardado }) {
  const [acciones, setAcciones] = useState(negocio.acciones);
  const [caja, setCaja] = useState(() => normalizarCaja(negocio.caja));
  const [ejemplo, setEjemplo] = useState("medias");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0); // para reiniciar la demo al cambiar algo

  const cambiado = JSON.stringify([acciones, caja]) !== JSON.stringify([negocio.acciones, normalizarCaja(negocio.caja)]);
  const esCupon = negocio.tipo === "descuento";

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  const borrador = useMemo(() => ({ ...negocio, acciones, caja }), [negocio, acciones, caja]);
  const cliente = useMemo(() => {
    const metas = (negocio.cartillas || [{ meta: negocio.meta }]).map((c) => c.meta);
    const base = { serial: "ejemplo", codigo: "ABC", nombre: "Marta", premios: 2, sellos: 0, sellos2: 0, guardados: 0, guardados2: 0, mensaje: null };
    if (esCupon) return { ...base, premios: 0 };
    if (ejemplo === "listo") return { ...base, sellos: metas[0], sellos2: metas[1] ? Math.round(metas[1] / 2) : 0 };
    if (ejemplo === "guardado") return { ...base, sellos: 2, sellos2: 1, guardados: 1 };
    return { ...base, sellos: Math.round(metas[0] * 0.6), sellos2: metas[1] ? Math.round(metas[1] * 0.3) : 0 };
  }, [negocio, ejemplo, esCupon]);

  function toggleAccion(key) {
    setAcciones((p) => (p.includes(key) ? p.filter((a) => a !== key) : [...p, key]));
    setVuelta((v) => v + 1);
  }
  function toggleOpcion(key) {
    setCaja((p) => ({ ...p, [key]: !p[key] }));
    setVuelta((v) => v + 1);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acciones, caja }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo guardar");
      onGuardado(data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setGuardando(false);
    }
  }

  function salir() {
    if (cambiado && !window.confirm("¿Salir sin guardar? Los cambios de la caja se pierden.")) return;
    onCerrar();
  }

  const accent = negocio.tema.accent;
  // Las opciones que no tienen sentido en esta tienda no se enseñan.
  const opcionesVisibles = Object.entries(OPCIONES_CAJA).filter(([k]) =>
    !(esCupon && ["sumarDos", "guardarPremios"].includes(k)) && !(k === "sumarDos" && !acciones.includes("sellar")));

  return (
    <div style={capa} role="dialog" aria-modal="true" aria-label="Editar vista de caja">
      <style>{CSS}</style>
      <header style={barra}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>Vista de la caja</strong>
          <div style={{ fontSize: 12, color: C.suave }}>Lo que ve quien atiende al escanear una tarjeta. Pruébala a la derecha.</div>
        </div>
        <button type="button" onClick={salir} style={botonSecundario}>Cancelar</button>
        <button type="button" onClick={guardar} disabled={!cambiado || guardando}
          style={{ ...botonPrimario(accent), opacity: cambiado ? 1 : 0.5, cursor: cambiado ? "pointer" : "default" }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </header>
      {error && <div style={{ background: C.malFondo, color: C.mal, padding: "8px 16px", fontSize: 14 }}>{error}</div>}

      <div className="caja-cuerpo">
        <section className="caja-opciones">
          <h2 style={h2}>Qué puede hacer</h2>
          {LISTA_ACCIONES.filter((a) => QUE_HACE[a.key]).filter((a) => !(esCupon && ["sellar", "restar"].includes(a.key))).map((a) => (
            <FilaInterruptor key={a.key} style={{ marginTop: 8 }} on={acciones.includes(a.key)} onClick={() => toggleAccion(a.key)} accent={accent}
              titulo={esCupon && a.key === "canjear" ? "Aplicar el descuento" : QUE_HACE[a.key].label}
              texto={QUE_HACE[a.key].descripcion} icono={a.icon} />
          ))}

          <h2 style={{ ...h2, marginTop: 22 }}>Cómo se ve</h2>
          {opcionesVisibles.map(([k, o]) => (
            <FilaInterruptor key={k} style={{ marginTop: 8 }} on={caja[k]} onClick={() => toggleOpcion(k)} accent={accent} titulo={o.label} texto={o.descripcion} />
          ))}
        </section>

        <section className="caja-vista">
          {!esCupon && (
            <div style={{ display: "flex", gap: 4, padding: 3, background: "#fff", border: `1px solid ${C.borde}`, borderRadius: 10, marginBottom: 12 }}>
              {EJEMPLOS.map(([id, texto]) => (
                <button key={id} type="button" onClick={() => { setEjemplo(id); setVuelta((v) => v + 1); }} style={{
                  flex: 1, padding: "6px 8px", borderRadius: 8, border: 0, fontSize: 12.5, cursor: "pointer",
                  background: ejemplo === id ? accent : "transparent", color: ejemplo === id ? "#fff" : C.suave, fontWeight: ejemplo === id ? 650 : 500,
                }}>{texto}</button>
              ))}
            </div>
          )}
          <div style={telefono}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
              <span style={{ ...chipCodigo(accent), fontSize: 18, padding: "4px 10px" }}>ABC</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Marta</div>
                <div style={{ fontSize: 13, color: C.suave }}>9 visitas{esCupon ? "" : " · 2 premios canjeados"}</div>
              </div>
            </div>
            {/* La caja de verdad, sin guardar: lo que se pulse aquí no le pasa a nadie. */}
            <TarjetaCaja key={`${vuelta}-${ejemplo}`} serial="ejemplo" inicial={cliente} negocio={borrador} demo />
            <div style={{ ...botonSecundario, marginTop: 10, display: "flex", justifyContent: "center", gap: 8, alignItems: "center", opacity: 0.7 }}>
              <Icono nombre="camara" tam={18} /> Escanear al siguiente
            </div>
            {caja.nombre && <div style={fantasma}>Nombre del cliente · Guardar</div>}
            {caja.historial && <div style={fantasma}>Actividad reciente: Sello 5/8 · Sello 4/8 · …</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

const CSS = `
.caja-cuerpo { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 430px); gap: 28px; padding: 22px 20px 40px; justify-content: center; align-items: start; }
.caja-vista { position: sticky; top: 0; }
@media (max-width: 860px) {
  .caja-cuerpo { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .caja-vista { position: static; }
}
`;

const capa = { position: "fixed", inset: 0, zIndex: 1200, background: C.fondo, display: "flex", flexDirection: "column", color: C.texto };
const barra = { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#fff", borderBottom: `1px solid ${C.borde}`, flexWrap: "wrap" };
const h2 = { fontSize: 13, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.6, color: C.suave };
const telefono = { background: C.fondo, border: `8px solid #1b1e23`, borderRadius: 28, padding: "18px 14px", boxShadow: "0 14px 34px rgba(16,20,28,.18)" };
const fantasma = { marginTop: 12, padding: "10px 12px", border: `1px dashed ${C.bordeFuerte}`, borderRadius: 10, fontSize: 13, color: C.tenue };
