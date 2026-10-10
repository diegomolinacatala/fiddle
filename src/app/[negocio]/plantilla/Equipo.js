"use client";

import { useState } from "react";
import Icono from "@/app/Icono";
import { MAX_NOMBRE, MAX_EMPLEADOS } from "@/lib/plantilla";
import { C, panel, campo, h2, botonPrimario, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// EQUIPO: la lista de quien atiende la caja
// ----------------------------------------------------------------------------
// Alta con un nombre o apodo, renombrar, baja y vuelta. Al lado de cada uno, lo
// que hizo en el periodo elegido, para que la lista no sea muda. Dar de baja no
// borra nada: deja de salir en la caja y sus movimientos siguen con su nombre.
// ============================================================================

// La fecha del alta o la baja, en el día de la TIENDA (quien mira desde otro país ve el mismo día).
const fechaCorta = (iso, zona) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: zona }) : null);

export default function Equipo({ plantilla, cuentas, dias, accent, colorDe, zona, onAlta, onCambiar, ocupado }) {
  const [nombre, setNombre] = useState("");
  const [editando, setEditando] = useState(null); // id de quien se está renombrando
  const [nuevo, setNuevo] = useState("");
  const [verBajas, setVerBajas] = useState(false);

  const activos = plantilla.filter((e) => !e.baja);
  const bajas = plantilla.filter((e) => e.baja);
  const filaDe = (id) => cuentas.filas.find((f) => f.clave === `e:${id}`);

  async function alta(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (await onAlta(nombre)) setNombre("");
  }
  async function renombrar(e, id) {
    e.preventDefault();
    if (await onCambiar(id, { nombre: nuevo })) setEditando(null);
  }
  function baja(p) {
    if (!window.confirm(`¿Dar de baja a ${p.nombre}?\n\nDejará de salir en la caja. Lo que hizo se queda con su nombre.`)) return;
    onCambiar(p.id, { activo: false });
  }
  // Se le olvidó: nadie puede leerlo, así que se quita y elige otro en la caja.
  function quitarPin(p) {
    if (!window.confirm(`¿Quitar el PIN de ${p.nombre}?\n\nLa próxima vez que se elija en la caja pondrá uno nuevo. Sus móviles volverán a pedírselo.`)) return;
    onCambiar(p.id, { quitarPin: true });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
      <section style={{ ...panel, maxWidth: 680 }}>
        <h2 style={h2}>Quién atiende la caja</h2>
        <p style={parrafo}>
          Añade a cada persona con su nombre o apodo. Desde ese momento, la primera vez que alguien abra la caja cada día
          en su móvil se le preguntará quién es, y cada sello quedará apuntado a quien lo dio. Tú, desde tu cuenta, no eliges: sales como «Dueño».
        </p>
        <form onSubmit={alta} style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <input
            value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={MAX_NOMBRE}
            placeholder="Nombre o apodo" aria-label="Nombre o apodo" autoComplete="off"
            disabled={ocupado || activos.length >= MAX_EMPLEADOS}
            style={{ ...campo, flex: "1 1 180px", width: "auto" }}
          />
          <button type="submit" disabled={ocupado || !nombre.trim() || activos.length >= MAX_EMPLEADOS} style={{ ...botonPrimario(accent), display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="mas" tam={16} grosor={2.4} /> Añadir
          </button>
        </form>
        {activos.length >= MAX_EMPLEADOS && <p style={{ ...parrafo, color: C.mal }}>Como mucho {MAX_EMPLEADOS} personas a la vez.</p>}
      </section>

      <section style={{ ...panel, maxWidth: 680, paddingTop: 6, paddingBottom: 6 }}>
        {activos.length === 0 && (
          <p style={{ ...parrafo, padding: "14px 0" }}>Todavía no hay nadie. Mientras la lista esté vacía, la caja funciona como siempre, sin preguntar.</p>
        )}
        {activos.map((p, i) => {
          const f = filaDe(p.id);
          return (
            <div key={p.id} style={{ ...fila, borderTop: i ? `1px solid ${C.borde}` : "none" }}>
              <span aria-hidden style={{ ...avatar, background: `${colorDe(`e:${p.id}`)}22`, color: colorDe(`e:${p.id}`) }}>
                {p.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editando === p.id ? (
                  <form onSubmit={(e) => renombrar(e, p.id)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={MAX_NOMBRE} autoFocus aria-label="Nuevo nombre" style={{ ...campo, flex: "1 1 160px", width: "auto", padding: "0.4rem 0.6rem" }} />
                    <button type="submit" disabled={ocupado} style={{ ...botonPrimario(accent), padding: "0.4rem 0.8rem" }}>Guardar</button>
                    <button type="button" onClick={() => setEditando(null)} style={botonPequeno}>Cancelar</button>
                  </form>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 650 }}>{p.nombre}</div>
                    <div style={{ fontSize: 13, color: C.suave, marginTop: 2 }}>
                      {p.alta ? `Desde el ${fechaCorta(p.alta, zona)}. ` : ""}
                      {f?.movimientos
                        ? `${f.sellos} ${f.sellos === 1 ? "sello" : "sellos"} y ${f.clientes} ${f.clientes === 1 ? "cliente" : "clientes"} en ${f.dias} ${f.dias === 1 ? "día" : "días"} de estos ${dias}.`
                        : `Sin movimientos en estos ${dias} días.`}
                      {" "}
                      {p.tienePin ? "Con PIN." : <span style={{ color: C.tenue }}>Sin PIN todavía: lo elige la primera vez en la caja.</span>}
                    </div>
                  </>
                )}
              </div>
              {editando !== p.id && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => { setEditando(p.id); setNuevo(p.nombre); }} aria-label={`Renombrar a ${p.nombre}`} title="Renombrar" style={botonIcono}>
                    <Icono nombre="editar" tam={16} />
                  </button>
                  {p.tienePin && <button type="button" onClick={() => quitarPin(p)} disabled={ocupado} style={botonPequeno}>Quitar el PIN</button>}
                  <button type="button" onClick={() => baja(p)} disabled={ocupado} style={botonPequeno}>Dar de baja</button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {bajas.length > 0 && (
        <section style={{ ...panel, maxWidth: 680 }}>
          <button type="button" onClick={() => setVerBajas((v) => !v)} aria-expanded={verBajas} style={{ ...botonPequeno, border: 0, background: "transparent", padding: 0, color: C.suave, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icono nombre="volver" tam={14} style={{ transform: verBajas ? "rotate(-90deg)" : "rotate(180deg)" }} />
            {bajas.length === 1 ? "Una persona dada de baja" : `${bajas.length} personas dadas de baja`}
          </button>
          {verBajas && bajas.map((p) => (
            <div key={p.id} style={{ ...fila, borderTop: `1px solid ${C.borde}`, marginTop: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.suave }}>{p.nombre}</div>
                <div style={{ fontSize: 13, color: C.tenue, marginTop: 2 }}>Baja el {fechaCorta(p.baja, zona)}. Sus movimientos siguen en el registro con su nombre.</div>
              </div>
              <button type="button" onClick={() => onCambiar(p.id, { activo: true })} disabled={ocupado} style={botonPequeno}>Volver a dar de alta</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const parrafo = { fontSize: 13.5, color: C.suave, margin: 0, lineHeight: 1.45 };
const fila = { display: "flex", alignItems: "center", gap: 12, padding: "13px 0", flexWrap: "wrap" };
const avatar = { width: 38, height: 38, borderRadius: RADIO.boton, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16, flexShrink: 0 };
const botonIcono = { ...botonPequeno, padding: "0.4rem 0.55rem", display: "inline-flex", alignItems: "center" };
