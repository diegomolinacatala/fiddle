"use client";

import { useMemo, useState } from "react";
import Icono from "@/app/Icono";
import PaseVista from "@/app/PaseVista";
import { Interruptor } from "@/app/Interruptor";
import TextoAviso from "./TextoAviso";
import {
  DISPAROS, LISTA_DISPAROS, fraseRegla, renderTexto, candidatos, elegibles, proximoEnvio, variablesDesconocidas, varsDeEjemplo,
} from "@/lib/automatizaciones";
import { DIAS, DIAS_CORTOS } from "@/lib/horario";
import { C, panel, campo, etiqueta, botonPrimario, botonSecundario, botonPequeno, RADIO } from "@/app/ui";

// ============================================================================
// UNA REGLA: la tarjeta y, al tocar Editar, su formulario
// ----------------------------------------------------------------------------
// Cerrada se lee como una frase ("A quien lleva 21 días sin venir, a las 12:00,
// los días que abre") con su texto debajo. Abierta, cada trozo de la frase es
// un campo: a quién, cuándo, qué. Mientras se escribe, la cuenta de a cuántos
// les llegaría y el pase de muestra cambian solos: se ve lo que se programa.
// ============================================================================

export default function Regla({ regla, negocio, grupos, contextos, envios, topes, abierta, nueva, ocupado, acciones, Formulario = null }) {
  const accent = negocio.tema.accent;
  const { llegan, muestra } = useMemo(() => {
    const lista = elegibles(regla, contextos, envios, { ahora: Date.now(), ...topes });
    return { llegan: lista.length, muestra: lista[0] || candidatos(regla, contextos)[0] || null };
  }, [regla, contextos, envios, topes]);

  if (abierta) {
    // Un programado tiene su propio formulario (Programados.js): menos piezas.
    const F = Formulario || Editor;
    return (
      <F
        inicial={regla} negocio={negocio} grupos={grupos} contextos={contextos} envios={envios}
        topes={topes} nueva={nueva} ocupado={ocupado} acciones={acciones}
      />
    );
  }

  const frase = fraseRegla(regla);
  const proximo = proximoEnvio(regla, negocio.horario);
  return (
    <article style={{ ...panel, padding: 16, opacity: regla.activa ? 1 : 0.72 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Interruptor on={regla.activa} accent={accent} disabled={ocupado} onClick={() => acciones.alternar(regla)} etiqueta={regla.nombre} />
        <span style={{ color: accent, display: "inline-flex" }}><Icono nombre={DISPAROS[regla.disparo]?.icon} tam={18} /></span>
        <h3 style={{ fontSize: 15, fontWeight: 650, margin: 0, flex: 1, minWidth: 0 }}>{regla.nombre}</h3>
        <button type="button" onClick={() => acciones.editar(regla.id)} style={botonPequeno} disabled={ocupado}>Editar</button>
      </div>
      <p style={{ margin: "10px 0 6px", fontSize: 14 }}>
        {frase.quien}, <strong style={{ fontWeight: 600 }}>{frase.cuando}</strong>:
      </p>
      {/* El texto como le llega a alguien, no la plantilla con llaves: eso solo al editar. */}
      <p style={cita}>
        «{renderTexto(regla.texto, muestra ? muestra.vars : varsDeEjemplo(regla, negocio))}»
        {regla.caduca && <span style={{ color: C.tenue }}> · solo ese día</span>}
      </p>
      <p style={{ margin: "10px 0 0", fontSize: 12.5, color: C.suave }}>
        {regla.activa ? (
          <>
            {llegan
              ? <>Ahora mismo le llegaría a <strong style={{ color: C.texto }}>{llegan}</strong></>
              : "Ahora mismo no le llegaría a nadie"}
            {" · "}
            {!negocio.horario
              ? "No sale solo hasta que la tienda tenga horario"
              : proximo ? `Próximo envío: ${proximo.texto}` : "Esos días la tienda está cerrada"}
          </>
        ) : "Apagado: no sale hasta que lo enciendas"}
      </p>
    </article>
  );
}

function Editor({ inicial, negocio, grupos, contextos, envios, topes, nueva, ocupado, acciones }) {
  const [r, setR] = useState(inicial);
  const accent = negocio.tema.accent;
  const d = DISPAROS[r.disparo];
  const set = (k, v) => setR((p) => ({ ...p, [k]: v }));

  // Días que abre: los que no, ni se ofrecen. Sin horario, los siete.
  const abiertos = negocio.horario ? negocio.horario.semana.map((t, i) => (t ? i : null)).filter((i) => i !== null) : [0, 1, 2, 3, 4, 5, 6];
  const marcados = r.dias.length ? r.dias : abiertos;
  function alternarDia(i) {
    const lista = marcados.includes(i) ? marcados.filter((x) => x !== i) : [...marcados, i].sort((a, b) => a - b);
    if (!lista.length) return; // al menos un día
    // Todos los que abre = "los días que abre" (así sigue valiendo si cambia el horario).
    set("dias", abiertos.every((x) => lista.includes(x)) && lista.length === abiertos.length ? [] : lista);
  }

  function cambiarDisparo(key) {
    const nuevo = DISPAROS[key];
    setR((p) => ({
      ...p,
      disparo: key,
      valor: nuevo.valor.def,
      // Si el texto era el de partida del anterior, se cambia por el del nuevo.
      texto: p.texto === DISPAROS[p.disparo]?.sugerencia ? nuevo.sugerencia : p.texto,
      nombre: p.nombre === DISPAROS[p.disparo]?.label ? nuevo.label : p.nombre,
      caduca: Boolean(nuevo.caduca),
    }));
  }

  const encajan = candidatos(r, contextos);
  const llegan = elegibles(r, contextos, envios, { ahora: Date.now(), ...topes });
  const muestra = llegan[0] || encajan[0] || null;
  const vars = muestra ? muestra.vars : varsDeEjemplo(r, negocio);
  const malas = variablesDesconocidas(r.texto);
  const cambiada = nueva || JSON.stringify(r) !== JSON.stringify(inicial);
  const valida = r.texto.trim() && !malas.length && r.hora;

  // El pase de muestra es el del cliente del que salen las variables: si el texto
  // dice "estás a 1 café", la banda tiene que enseñar ese café a falta de uno.
  const clienteVista = {
    serial: "ejemplo-0000-0000-0000-000000000000", codigo: "ABC", nombre: null,
    ...(muestra?.saldo || {
      sellos: Math.max(1, Math.round((negocio.cartillas?.[0]?.meta ?? negocio.meta ?? 1) * 0.6)),
      sellos2: negocio.cartillas ? 2 : 0, premios: 0,
    }),
    mensaje: renderTexto(r.texto, vars) || null,
  };

  return (
    <article style={{ ...panel, borderColor: accent, boxShadow: `0 0 0 3px ${accent}1a` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(290px, 100%), 1fr))", gap: 22, alignItems: "start" }}>
        <div>
          <label style={{ ...etiqueta, marginTop: 0 }} htmlFor={`nombre-${r.id}`}>Nombre del aviso</label>
          <input id={`nombre-${r.id}`} value={r.nombre} maxLength={40} onChange={(e) => set("nombre", e.target.value)} style={campo} />

          <label style={etiqueta} htmlFor={`quien-${r.id}`}>A quién</label>
          <select id={`quien-${r.id}`} value={r.disparo} onChange={(e) => cambiarDisparo(e.target.value)} style={campo}>
            {LISTA_DISPAROS.filter((x) => !x.soloProgramado).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            {d.valor.tipo === "grupo" ? (
              <select aria-label="Grupo" value={r.valor} onChange={(e) => set("valor", e.target.value)} style={campo}>
                {grupos.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            ) : (
              <>
                <input
                  type="number" aria-label={d.valor.unidad} min={d.valor.min} max={d.valor.max} value={r.valor}
                  onChange={(e) => set("valor", e.target.value === "" ? "" : Math.round(Number(e.target.value)))}
                  onBlur={() => set("valor", Math.min(d.valor.max, Math.max(d.valor.min, Number(r.valor) || d.valor.def)))}
                  style={{ ...campo, width: 86 }}
                />
                <span style={{ fontSize: 14, color: C.suave }}>{d.valor.unidad}</span>
              </>
            )}
          </div>
          <p style={ayuda}>{d.descripcion}</p>

          <label style={etiqueta} htmlFor={`hora-${r.id}`}>Cuándo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14 }}>A las</span>
            <input id={`hora-${r.id}`} type="time" step={300} value={r.hora} onChange={(e) => set("hora", e.target.value)} style={{ ...campo, width: 118 }} />
          </div>
          <div role="group" aria-label="Qué días" style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {DIAS_CORTOS.map((letra, i) => {
              const abre = abiertos.includes(i);
              const on = abre && marcados.includes(i);
              return (
                <button
                  key={letra} type="button" disabled={!abre} aria-pressed={on} onClick={() => alternarDia(i)}
                  aria-label={abre ? DIAS[i] : `${DIAS[i]}: cerrado`} style={chipDia(on, abre, accent)}
                >
                  {letra}
                </button>
              );
            })}
          </div>
          <p style={ayuda}>
            Solo con la tienda abierta: si a esa hora aún no ha abierto, sale al abrir; si ya ha cerrado, ese día no sale.
          </p>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={r.caduca} onChange={(e) => set("caduca", e.target.checked)} style={{ marginTop: 3 }} />
            <span>Quitarlo de la tarjeta al cerrar ese día <span style={{ color: C.tenue }}>(para promos de un día)</span></span>
          </label>

          <TextoAviso id={`texto-${r.id}`} valor={r.texto} onChange={(v) => set("texto", v)} vars={vars} ejemplo={varsDeEjemplo(r, negocio)}
            encajan={encajan} quien={muestra?.vars.nombre || null} accent={accent} />
        </div>

        <div>
          <label style={{ ...etiqueta, marginTop: 0 }}>Cómo lo verá</label>
          <PaseVista
            negocio={negocio}
            cliente={clienteVista}
            qrTexto={`/w/${clienteVista.serial}`}
            pie={muestra ? "Con los datos de uno de los clientes a los que les toca." : "Con datos de ejemplo: ahora mismo no le toca a nadie."}
          />
          <div style={{ ...cuenta, borderColor: `${accent}40` }}>
            <strong style={{ fontSize: 22, fontWeight: 650 }}>{llegan.length}</strong>
            <span style={{ fontSize: 13, color: C.suave }}>
              {llegan.length === 1 ? "le llegaría" : "les llegaría"} si saliera ahora.
              {encajan.length > llegan.length && ` Encajan ${encajan.length}: al resto no se le puede avisar (sin la tarjeta en el teléfono) o ya se lo dijimos.`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", alignItems: "center", borderTop: `1px solid ${C.borde}`, paddingTop: 14 }}>
        <button
          type="button" disabled={ocupado || !valida || !cambiada} onClick={() => acciones.guardar(r)}
          style={{ ...botonPrimario(accent), opacity: ocupado || !valida || !cambiada ? 0.45 : 1 }}
        >
          {nueva ? "Crear aviso" : "Guardar"}
        </button>
        <button type="button" onClick={acciones.cancelar} style={botonSecundario} disabled={ocupado}>Cancelar</button>
        {!nueva && (
          <button
            type="button" disabled={ocupado || cambiada || !llegan.length} onClick={() => acciones.enviar(r, llegan.length)}
            style={{ ...botonSecundario, opacity: ocupado || cambiada || !llegan.length ? 0.5 : 1 }}
          >
            Enviar ahora{llegan.length ? ` a ${llegan.length}` : ""}
          </button>
        )}
        {!nueva && cambiada && <span style={{ fontSize: 12.5, color: C.tenue }}>Guarda los cambios para poder enviarlo ya.</span>}
        <span style={{ flex: 1 }} />
        {!nueva && (
          <button type="button" onClick={() => acciones.borrar(r)} disabled={ocupado} style={{ ...botonSecundario, color: C.mal, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Icono nombre="papelera" tam={16} /> Borrar
          </button>
        )}
      </div>
    </article>
  );
}

const cita = { margin: 0, fontSize: 14, color: C.suave, background: C.panelSuave, border: `1px solid ${C.borde}`, borderRadius: RADIO.boton, padding: "9px 12px" };
const ayuda = { fontSize: 12.5, color: C.tenue, margin: "6px 0 0", lineHeight: 1.45 };
const cuenta = { display: "flex", alignItems: "baseline", gap: 10, marginTop: 14, padding: "12px 14px", border: "1px solid", borderRadius: RADIO.fila };
const chipDia = (on, abre, accent) => ({
  width: 36, height: 34, borderRadius: RADIO.boton, fontWeight: 600, fontSize: 13,
  border: `1px solid ${on ? accent : C.borde}`, background: on ? `${accent}14` : abre ? "#fff" : C.panelSuave,
  color: on ? accent : abre ? C.texto : C.tenue, cursor: abre ? "pointer" : "not-allowed",
  textDecoration: abre ? "none" : "line-through",
});
