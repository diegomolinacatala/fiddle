"use client";

import { useMemo } from "react";
import Icono from "@/app/Icono";
import { serieVisitas, resumenSerie, rejillaHoraria, horarioDeRejilla, cambio, cadenciaTexto } from "@/lib/crm";
import { ZONA_POR_DEFECTO } from "@/lib/horario";
import { observaciones, enlaceDeAccion, suficiencia, textoFalta } from "@/lib/observaciones";
import { Cifra, Tarjeta, Rejilla, contar, numero } from "./piezas";
import { Embudo, CurvaVuelta, VisitasPorDia, Estados, Puente, Cartilla, LeyendaCartilla, Telefonos } from "./graficas";
import { C, panel, legible, tinte } from "@/app/ui";

// ============================================================================
// RESUMEN: ¿CÓMO VA LA TIENDA?
// ----------------------------------------------------------------------------
// Una gráfica perfecta no necesita que nadie la explique. Por eso cada bloque
// es una PREGUNTA (pequeña), su RESPUESTA en una frase con la cifra (grande) y
// la gráfica que lo demuestra debajo. De arriba abajo:
//   cuatro cifras       clientes, cuántos siguen viniendo, visitas, premios
//   lo que dicen…       qué hacer, con su botón a Avisos
//   ¿vuelven?           el camino de la tarjeta y cuánto tardan en volver
//   ¿cuándo?            las visitas de cada día y la semana hora a hora
//   ¿quién?             en qué estado está cada uno y si se gana o se pierde
//   ¿en qué móviles?    iPhone o Android, y cuántos la quitaron
//   ¿cuántos puntos?    dónde va cada uno en su cartilla
//   lo que verás…       lo que aún no se puede decir, y cuándo se podrá
//
// Las cifras CUADRAN entre sí a la vista: «Clientes» es el segundo escalón del
// camino y la suma de los estados; «Siguen viniendo» es el «Hoy» del puente;
// «Premios por dar» y «Premio pendiente» miran lo mismo; «con la tarjeta en el
// móvil» de Clientes es iPhone + Android + los dos. Una cifra nueva tiene
// que cuadrar igual. Lo que aún no tiene datos no ocupa un panel vacío: va a
// «Lo que verás con más días», con cuándo saldrá.
//
// Las cuentas son de lib/crm.js; aquí solo se dicen. Las etiquetas de las
// cifras las copia la web (home/Panel.js): si cambian aquí, también allí.
// ============================================================================

const DIA = 864e5;
const fecha = (ms, zona) => new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: zona });
const fechaLarga = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.toLocaleDateString("es-ES", { weekday: "long" })} ${d.getDate()}`;
};

export default function Resumen({ d, slug, accent, onVerDescartadas }) {
  const { negocio: n, metricas: m } = d;
  const esCupon = n.tipo === "descuento";
  const zona = n.horario?.zona || ZONA_POR_DEFECTO;

  const serie = useMemo(() => serieVisitas(d.eventos, 30, Date.now(), n.horario, { desde: m.inicio }), [d.eventos, n.horario, m.inicio]);
  const dia = useMemo(() => resumenSerie(serie), [serie]);
  const rejilla = useMemo(() => rejillaHoraria(d.eventos, { horario: n.horario }), [d.eventos, n.horario]);
  const hay = useMemo(() => suficiencia({ eventos: d.eventos, horario: n.horario }), [d.eventos, n.horario]);
  const ideas = useMemo(
    () => observaciones({ rejilla: rejilla.media, horario: n.horario, metricas: m, grupos: d.grupos, suficiencia: hay }),
    [rejilla, n.horario, m, d.grupos, hay],
  );

  if (!m.embudo[0]?.n) {
    return (
      <Tarjeta id="r-vacio" pregunta="¿Cómo va la tienda?" titular="Aún no ha sacado nadie la tarjeta."
        detalle="Cuando la empiecen a usar en caja, aquí verás cuántos vuelven, cuándo vienen y a quién conviene escribir." />
    );
  }

  // «Lo más fuerte» es la frase de la rejilla; el resto, lo que se puede hacer.
  const fuerte = ideas.find((o) => o.id.startsWith("fuerte"));
  const quehacer = ideas.filter((o) => o !== fuerte);
  const conPuntos = (d.cartillas || []).filter((c) => c.conPuntos > 0 || c.enCero > 0);
  const pendientes = pendientesDe({ d, m, hay });

  return (
    <div className="resumen" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
      <style>{CSS}</style>
      <Cifras m={m} enMovil={d.telefonos?.enMovil ?? m.instalados} esCupon={esCupon} accent={accent} dia={dia} zona={zona} />

      {quehacer.length > 0 && <LoQueDicen ideas={quehacer} slug={slug} accent={accent} />}

      <Fila>
        <Tarjeta id="r-camino" pregunta="¿Vuelven?" titular={titularCamino(m.embudo, esCupon)}
          pie={m.descartadas > 0 && (
            <button type="button" className="enlace" onClick={onVerDescartadas} style={enlaceSuave}>
              {m.descartadas === 1 ? "Ver la tarjeta que nadie guardó ni usó" : `Ver las ${m.descartadas} tarjetas que nadie guardó ni usó`}
            </button>
          )}>
          <Embudo pasos={m.embudo} accent={accent} />
        </Tarjeta>
        {d.vuelta?.listo && (
          <Tarjeta id="r-curva" pregunta="¿Cuánto tardan en volver?" {...titularCurva(d.vuelta)}>
            <CurvaVuelta v={d.vuelta} accent={accent} />
          </Tarjeta>
        )}
      </Fila>

      <Fila>
        <Tarjeta id="r-dias" pregunta="¿Cuántos vienen cada día?" {...titularDias(dia, serie)}>
          <VisitasPorDia serie={serie} resumen={dia} accent={accent} />
        </Tarjeta>
        {hay.suficiente && (
          <Tarjeta id="r-horas" pregunta="¿A qué hora viene la gente?"
            titular={fuerte?.texto || "Así es una semana normal, hora a hora."}
            detalle="Cada casilla es lo que viene un día normal a esa hora.">
            <Rejilla rejilla={rejilla.media} media accent={accent} {...horarioDeRejilla(n.horario)} />
          </Tarjeta>
        )}
      </Fila>

      <Fila>
        <Tarjeta id="r-quien" pregunta="¿Quién sigue viniendo?"
          titular={`${numero(m.activos)} de tus ${contar(m.total, ["cliente", "clientes"])} siguen viniendo.`}
          detalle={m.cadenciaHabitual ? `El cliente típico vuelve ${cadenciaTexto(m.cadenciaHabitual)}.` : null}>
          <Estados porEstado={m.porEstado} total={m.total} />
        </Tarjeta>
        {d.puente?.listo && (
          <Tarjeta id="r-puente" pregunta="¿Ganas o pierdes clientes?" {...titularPuente(d.puente)}>
            <Puente p={d.puente} accent={accent} />
          </Tarjeta>
        )}
      </Fila>

      {d.telefonos?.guardaron > 0 && (
        <Fila>
          <Tarjeta id="r-moviles" pregunta="¿En qué móviles la llevan?" {...titularTelefonos(d.telefonos)}>
            <Telefonos t={d.telefonos} accent={accent} />
          </Tarjeta>
        </Fila>
      )}

      {!esCupon && conPuntos.length > 0 && (
        <Tarjeta id="r-puntos" pregunta="¿Cuántos puntos llevan?" pie={<LeyendaCartilla />}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 24 }}>
            {conPuntos.map((c) => <Cartilla key={c.indice} c={c} conNombre={d.cartillas.length > 1} />)}
          </div>
        </Tarjeta>
      )}

      {pendientes.length > 0 && <Pendientes items={pendientes} accent={accent} />}
    </div>
  );
}

/** Dos tarjetas lado a lado si caben; en el móvil, una debajo de otra. */
const Fila = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 18 }}>{children}</div>
);

// --------------------------------------------------------------- titulares
// La frase de cada bloque: lo que hay que ver en la gráfica, con su cifra.

function titularCamino(pasos, esCupon) {
  const de = (k) => pasos.find((p) => p.key === k)?.n || 0;
  const base = esCupon ? de("canjearon") : de("estrenaron");
  if (base < 5) return `Tienes ${contar(de("quedaron"), ["cliente", "clientes"])} y ${numero(de("estrenaron"))} ya la ${de("estrenaron") === 1 ? "ha" : "han"} usado en caja.`;
  const deCada10 = Math.round((de("volvieron") / base) * 10);
  const quien = esCupon ? "usan el cupón" : "la estrenan";
  if (!deCada10) return `De los que ${quien}, aún no ha vuelto casi nadie.`;
  return `De cada 10 que ${quien}, ${deCada10} ya ${deCada10 === 1 ? "ha" : "han"} vuelto.`;
}

function titularCurva(v) {
  const en = (d) => v.puntos[d]?.pct;
  const semanas = [[14, "dos"], [21, "tres"], [28, "cuatro"]].filter(([d]) => en(d) !== undefined);
  const [ultima, cuantas] = semanas.at(-1) || [];
  let detalle = null;
  if (semanas.length === 1) detalle = `A las dos semanas, el ${en(14)}%.`;
  // Si después de las dos semanas ya casi no sube, se dice así y no «83 %, 83 %, 83 %».
  else if (semanas.length > 1 && en(ultima) - en(14) <= 2) detalle = `A las dos semanas, el ${en(14)}%, y después ya casi no sube.`;
  else if (semanas.length > 1) detalle = `A las dos semanas, el ${en(14)}%; a las ${cuantas}, el ${en(ultima)}%.`;
  return { titular: `A la semana ha vuelto el ${en(7)}% de los que la estrenan.`, detalle };
}

function titularDias(dia, serie) {
  if (dia.media === null) {
    return { titular: `Hoy, hasta ahora, ${contar(serie.at(-1)?.n || 0, ["visita", "visitas"])}.` };
  }
  return {
    titular: `Una media de ${contar(Math.round(dia.media), ["visita", "visitas"])} al día que abres.`,
    detalle: dia.mejor && dia.dias > 1 ? `El mejor, el ${fechaLarga(dia.mejor.dia)}, con ${dia.mejor.n}.` : null,
  };
}

function titularTelefonos(t) {
  const detalle = `Los porcentajes son de los ${numero(t.guardaron)} que la han guardado alguna vez.`;
  if (!t.enMovil) return { titular: `Ahora no la tiene nadie en el móvil: ${contar(t.quitaron, ["la quitó", "la quitaron"])}.` };
  const donde = [`${numero(t.iphone)} en iPhone`, `${numero(t.android)} en Android`, t.ambos > 0 && `${numero(t.ambos)} en los dos`].filter(Boolean);
  return {
    titular: `${contar(t.enMovil, ["cliente la lleva", "clientes la llevan"])} en el móvil: ${donde.slice(0, -1).join(", ")} y ${donde.at(-1)}.`,
    detalle,
  };
}

function titularPuente(p) {
  const diferencia = p.hoy - p.antes;
  return {
    titular: diferencia === 0
      ? `Siguen viniendo ${numero(p.hoy)}, los mismos que hace ${p.dias} días.`
      : `Siguen viniendo ${numero(p.hoy)}: ${numero(Math.abs(diferencia))} ${diferencia > 0 ? "más" : "menos"} que hace ${p.dias} días.`,
    detalle: `Se han sumado ${numero(p.nuevos + p.volvieron)} y se han alejado ${numero(p.enfriados)}.`,
  };
}

// --------------------------------------------------------------- cifras
/**
 * Las cuatro cifras de cabecera. Con menos de un mes de fiddle, «los últimos 30
 * días» son en realidad «desde el primer día», y la etiqueta lo dice.
 */
function Cifras({ m, enMovil, esCupon, accent, dia, zona }) {
  const joven = m.inicio && Date.now() - m.inicio < 30 * DIA;
  const desde = m.inicio ? `desde el ${fecha(m.inicio, zona)}` : null;
  const enPct = m.total ? Math.round((m.activos / m.total) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12 }}>
      <Cifra label="Clientes" valor={numero(m.total)} accent={accent}
        pie={[joven ? desde : `${m.nuevos30 ? "+" : ""}${numero(m.nuevos30)} en 30 días`, `${numero(enMovil)} con la tarjeta en el móvil`]} />
      <Cifra label="Siguen viniendo" valor={numero(m.activos)} accent={C.ok}
        pie={[`el ${enPct}% de tus clientes`, `${contar(m.porEstado.nuevo, ["nuevo", "nuevos"])} y ${numero(m.porEstado.activo)} a su ritmo`]} />
      <Cifra label="Visitas" valor={numero(m.visitas30)} cambio={cambio(m.visitas30, m.visitas30Previas)}
        pie={[
          joven ? desde : "en los últimos 30 días",
          m.visitas30Previas !== null ? "frente a los 30 anteriores" : dia.dias ? `en ${contar(dia.dias, ["día abierto", "días abiertos"])}` : null,
        ]} />
      {esCupon
        ? <Cifra label="Cupones usados" valor={numero(m.premios)} pie="desde el primer día" />
        : <Cifra label="Premios por dar" valor={numero(m.porDar)}
          pie={m.porDar ? [`a ${contar(m.conPremio, ["cliente", "clientes"])}`, "guardados o con la cartilla llena"] : "ninguno pendiente"} />}
    </div>
  );
}

// --------------------------------------------------------------- qué hacer
function LoQueDicen({ ideas, slug, accent }) {
  return (
    <section aria-labelledby="r-ideas" style={panel}>
      <h2 id="r-ideas" style={{ fontSize: 13, fontWeight: 600, color: C.suave, margin: "0 0 12px" }}>Lo que dicen los números</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {ideas.map((o) => (
          <li key={o.id} style={idea}>
            <span style={{ color: legible(accent), background: tinte(accent, 10), borderRadius: 10, width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icono nombre={iconoDe(o)} tam={19} />
            </span>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{o.texto}</div>
              {o.detalle && <div style={{ fontSize: 13, color: C.suave, marginTop: 3, lineHeight: 1.45 }}>{o.detalle}</div>}
            </div>
            {o.accion && (
              <a className="accion" href={enlaceDeAccion(slug, o.accion, o.texto)} style={botonAccion}>
                {o.accion.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const iconoDe = (o) => (o.id === "instalan" ? "movil" : o.id === "premios" ? "regalo" : o.accion?.tipo === "grupo" ? "clientes" : o.id.startsWith("sube") || o.id.startsWith("baja") ? "diana" : "reloj");

// --------------------------------------------------------------- lo que verás
/**
 * Lo que aún no se puede decir, en una lista corta y con cuándo saldrá, en vez
 * de un panel grande por cada cosa que dice «Aún no hay datos suficientes».
 */
function pendientesDe({ d, m, hay }) {
  const out = [];
  const enDias = (n) => `En ${contar(n, ["día", "días"])}`;
  if (d.vuelta && !d.vuelta.listo) {
    out.push({
      id: "curva", titulo: "Cuánto tardan en volver",
      texto: `${d.vuelta.faltanDias ? `${enDias(d.vuelta.faltanDias)}: ` : "Saldrá "}cuando ${d.vuelta.hacenFalta} clientes lleven una semana con la tarjeta.`,
    });
  }
  if (!hay.suficiente) out.push({ id: "horas", titulo: "A qué hora viene la gente", texto: textoFalta(hay), dias: hay.dias });
  if (d.puente && !d.puente.listo && d.puente.motivo === "joven") {
    out.push({ id: "puente", titulo: "Si ganas o pierdes clientes", texto: `${enDias(d.puente.faltanDias)}: al cumplir un mes con la tarjeta.` });
  }
  const faltaComparar = m.inicio ? Math.ceil(60 - (Date.now() - m.inicio) / DIA) : 0;
  if (m.visitas30Previas === null && faltaComparar > 0) {
    out.push({ id: "tendencia", titulo: "Si vienen más o menos que el mes anterior", texto: `${enDias(faltaComparar)}: con dos meses de tarjetas.` });
  }
  return out;
}

const LETRAS = ["L", "M", "X", "J", "V", "S", "D"];

function Pendientes({ items, accent }) {
  return (
    <section aria-labelledby="r-pendiente" style={{ ...panel, background: C.panelSuave }}>
      <h2 id="r-pendiente" style={{ fontSize: 13, fontWeight: 600, color: C.suave, margin: "0 0 12px" }}>Lo que verás con más días</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
        {items.map((x) => (
          <li key={x.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: C.tenue, display: "inline-flex", marginTop: 1 }}><Icono nombre="reloj" tam={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{x.titulo}</div>
              <div style={{ fontSize: 13, color: C.suave, marginTop: 2, lineHeight: 1.45 }}>{x.texto}</div>
              {x.dias && <DiasVistos dias={x.dias} accent={accent} />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * La semana de `suficiencia`: lleno el día que ya se ha visto bastante, a
 * medias el que se ha visto alguna vez, vacío el que no, y con raya el que la
 * tienda cierra. Así se ve que se va llenando.
 */
function DiasVistos({ dias, accent }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }} aria-hidden>
      {dias.map((x) => {
        const lleno = x.abre && x.listo;
        const medias = x.abre && !x.listo && x.fechas > 0;
        return (
          <span key={x.d} style={{
            width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 11.5, fontWeight: 650,
            background: lleno ? accent : medias ? tinte(accent, 30) : x.abre ? C.borde : "transparent",
            color: lleno ? "#fff" : x.abre ? C.texto : C.tenue,
            border: x.abre ? "none" : `1px dashed ${C.bordeFuerte}`,
          }}>{LETRAS[x.d]}</span>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------- estilos
// El botón de cada idea, con su estado al pasar por encima. El foco del teclado
// (gráficas incluidas, que se recorren con Tab) es el :focus-visible del layout.
const CSS = `
.resumen .accion { transition: background-color .15s ease-out, border-color .15s ease-out; }
.resumen .accion:hover { background: ${C.panelSuave}; border-color: ${C.tenue}; }
@media (prefers-reduced-motion: reduce) { .resumen .accion { transition: none; } }
`;

const idea = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", border: `1px solid ${C.borde}`, borderRadius: 12, background: C.panelSuave };
const botonAccion = {
  display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px", borderRadius: 10,
  border: `1px solid ${C.bordeFuerte}`, background: C.panel, color: C.texto, fontSize: 13.5, fontWeight: 600,
  textDecoration: "none", whiteSpace: "nowrap", marginLeft: "auto",
};
const enlaceSuave = {
  background: "none", border: 0, padding: "10px 0 0", font: "inherit", fontSize: 13, color: C.suave, textDecoration: "underline",
  cursor: "pointer", textAlign: "left", alignSelf: "flex-start",
};
