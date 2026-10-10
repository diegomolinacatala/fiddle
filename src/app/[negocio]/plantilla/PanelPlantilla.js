"use client";

import { useMemo, useState } from "react";
import CabeceraGestion from "../CabeceraGestion";
import Equipo from "./Equipo";
import Rendimiento from "./Rendimiento";
import Registro from "./Registro";
import { zonaDe } from "@/lib/actividad";
import {
  ventanaDe, cuentasDePlantilla, observacionesPlantilla, serieDiaria, movimientosDePlantilla, colorDe, DUENO, SIN_NOMBRE,
} from "@/lib/plantilla";
import { C, pagina, solapa } from "@/app/ui";

// ============================================================================
// PLANTILLA DE UNA TIENDA
// ----------------------------------------------------------------------------
// Una pestaña por pregunta:
//   EQUIPO       ¿quién atiende? la lista: alta, renombrar, baja
//   RENDIMIENTO  ¿cómo lo hace cada uno? cifras, conclusiones, tabla y gráficas
//   REGISTRO     ¿qué pasó exactamente? cada movimiento con su hora y su nombre
// El periodo (7, 30 o 90 días) vale para las dos últimas.
//
// Llega con los datos cargados en el servidor (page.js); las cuentas se hacen
// aquí, con la hora de la tienda (lib/plantilla.js). Tocar la lista va a
// /api/plantilla y actualiza solo la lista: los eventos no cambian.
// ============================================================================

const PESTANAS = [["equipo", "Equipo"], ["rendimiento", "Rendimiento"], ["registro", "Registro"]];
const PERIODOS = [[7, "7 días"], [30, "30 días"], [90, "90 días"]];

export default function PanelPlantilla({ slug, inicial }) {
  const n = inicial.negocio;
  const [plantilla, setPlantilla] = useState(n.plantilla);
  const [pestana, setPestana] = useState(n.plantilla.length ? "rendimiento" : "equipo");
  const [dias, setDias] = useState(30);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [ahora] = useState(() => Date.now());
  const accent = n.tema.accent;
  const zona = zonaDe(n);

  const { desde, hasta } = useMemo(() => ventanaDe(dias, ahora, zona), [dias, ahora, zona]);
  const cuentas = useMemo(
    () => cuentasDePlantilla(inicial.eventos, { plantilla, zona, horario: n.horario, desde, hasta, clientes: inicial.clientes }),
    [inicial.eventos, inicial.clientes, plantilla, zona, n.horario, desde, hasta],
  );
  const ideas = useMemo(() => observacionesPlantilla(cuentas, { dias }), [cuentas, dias]);
  const serie = useMemo(() => serieDiaria(inicial.eventos, { zona, dias, ahora }), [inicial.eventos, zona, dias, ahora]);
  const movimientos = useMemo(
    () => movimientosDePlantilla(inicial.eventos, { plantilla, zona, horario: n.horario, desde, hasta }),
    [inicial.eventos, plantilla, zona, n.horario, desde, hasta],
  );
  const codigoDe = useMemo(() => {
    const m = new Map(inicial.clientes.map((c) => [c.serial, c.codigo]));
    return (serial) => m.get(serial) || "—";
  }, [inicial.clientes]);

  // El color de cada uno por su orden de alta: no cambia al dar de baja a otro.
  const indice = useMemo(() => new Map(plantilla.map((e, i) => [e.id, i])), [plantilla]);
  const colorDeClave = (clave) =>
    clave.startsWith("e:") ? colorDe(indice.get(clave.slice(2)) ?? 0)
    : clave === DUENO ? accent
    : clave === SIN_NOMBRE ? C.tenue
    : C.suave;

  const completo = Date.parse(inicial.historialCompletoDesde) <= desde;

  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3500); }

  /** Toca la lista en el servidor y se queda con lo que devuelve. Devuelve si fue bien. */
  async function llamar(metodo, cuerpo) {
    setOcupado(true);
    try {
      const r = await fetch(`/api/plantilla?b=${slug}`, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = await r.json();
      if (!r.ok) { flash(data.error || "No se pudo guardar"); return false; }
      setPlantilla(data.plantilla);
      return true;
    } catch {
      flash("Sin conexión: no se ha guardado");
      return false;
    } finally {
      setOcupado(false);
    }
  }
  const alta = (nombre) => llamar("POST", { nombre });
  const cambiar = (id, cambios) => llamar("PUT", { id, ...cambios });

  return (
    <main style={pagina}>
      <div style={{ width: "min(1100px, 100%)" }}>
        <CabeceraGestion negocio={n} slug={slug} activa="plantilla" />

        <div style={{ display: "flex", gap: 8, margin: "20px 0 16px", flexWrap: "wrap", alignItems: "center", paddingTop: 16, borderTop: `1px solid ${C.borde}` }}>
          {PESTANAS.map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setPestana(id)} style={solapa(pestana === id, accent)}>{texto}</button>
          ))}
          <span style={{ flex: 1 }} />
          {pestana !== "equipo" && (
            <div role="group" aria-label="Periodo" style={{ display: "flex", gap: 6 }}>
              {PERIODOS.map(([d, texto]) => (
                <button key={d} type="button" onClick={() => setDias(d)} style={{ ...solapa(dias === d, accent), padding: "0.4rem 0.75rem", fontSize: 13 }}>{texto}</button>
              ))}
            </div>
          )}
        </div>

        {pestana !== "equipo" && !completo && (
          <p style={{ ...nota, marginBottom: 16 }}>
            Del principio de este periodo ya no están todos los movimientos en el panel: los primeros días salen a medias. Elige uno más corto para cuadrar.
          </p>
        )}

        {pestana === "equipo" && (
          <Equipo plantilla={plantilla} cuentas={cuentas} dias={dias} accent={accent} colorDe={colorDeClave} zona={zona} onAlta={alta} onCambiar={cambiar} ocupado={ocupado} />
        )}
        {pestana === "rendimiento" && (
          <Rendimiento cuentas={cuentas} ideas={ideas} serie={serie} dias={dias} accent={accent} colorDe={colorDeClave} zona={zona} />
        )}
        {pestana === "registro" && (
          <Registro movimientos={movimientos} filas={cuentas.filas} codigoDe={codigoDe} dias={dias} accent={accent} slug={slug} colorDe={colorDeClave} />
        )}

        {msg && <div role="status" style={toast}>{msg}</div>}
      </div>
    </main>
  );
}

const nota = { fontSize: 13, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "12px 14px", margin: 0 };
const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: "#1b1e23", color: "#fff", padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)", zIndex: 60,
};
