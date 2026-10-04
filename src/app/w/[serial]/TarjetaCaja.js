"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConFotoBanda } from "@/app/fotoBanda";
import { ACCIONES, premiosDe } from "@/lib/acciones";
import { filasDeCaja, normalizarCaja } from "@/lib/caja";
import { stripDelPase, comoDataUri, svgBandaOpaca } from "@/lib/apple/dibujo";
import { estadoDe } from "@/lib/resumen";
import { cartillasDe, describirBanda } from "@/lib/cartillas";
import WorkerActions from "./WorkerActions";
import Icono from "@/app/Icono";
import { C, panel, RADIO } from "@/app/ui";

// ============================================================================
// LA TARJETA EN LA CAJA, AL INSTANTE
// ----------------------------------------------------------------------------
// Al pulsar un botón, el sello sale YA: se aplica aquí la misma función pura
// que aplica el servidor (`ACCIONES[x].aplicar`) y la petición va detrás. Si
// el servidor dice otra cosa (otra caja tocó a este cliente, sin conexión), se
// vuelve a lo que diga el servidor y se avisa.
//
// Las peticiones van EN FILA: dos sellos seguidos no compiten entre sí en el
// guardado optimista del servidor. Cuando la fila se vacía, se refresca la
// página por detrás (historial, visitas) sin tocar lo que ya se ve.
// ============================================================================

// `demo`: la vista previa del manager (Editar vista de caja). Se pulsa y se ve
// pasar, pero no se guarda nada ni se navega.
// `volver`: a dónde ir con "Volver al escáner al sumar".
export default function TarjetaCaja({ serial, inicial, negocio, demo = false, volver = null }) {
  const router = useRouter();
  const opciones = normalizarCaja(negocio.caja);
  const vuelta = useRef(null);
  const [cliente, setCliente] = useState(inicial);
  const [toast, setToast] = useState(null);
  // El mensaje que traía en su tarjeta al llegar (la promo de la racha, "hace
  // tiempo que no te vemos"…): la caja tiene que verlo para aplicarlo. Sumar la
  // visita lo quita del pase, pero aquí se queda a la vista mientras se le atiende.
  const [alLlegar] = useState(inicial.mensaje || null);
  const fila = useRef(Promise.resolve());
  const pendientes = useRef(0);

  // Lo que llegue del servidor al refrescar manda, salvo con algo aún en vuelo.
  useEffect(() => { if (!pendientes.current) setCliente(inicial); }, [inicial]);

  // Se va solo al escáner (si la tienda lo quiere) tras sumar; cualquier otro
  // toque, o "Quedarme aquí", lo para.
  function cancelarVuelta() {
    clearInterval(vuelta.current);
    vuelta.current = null;
    setToast((t) => (t ? { ...t, vuelta: null } : t));
  }
  function empezarVuelta() {
    clearInterval(vuelta.current);
    let quedan = 3;
    setToast((t) => (t ? { ...t, vuelta: quedan } : t));
    vuelta.current = setInterval(() => {
      quedan -= 1;
      if (quedan > 0) return setToast((t) => (t ? { ...t, vuelta: quedan } : t));
      clearInterval(vuelta.current);
      vuelta.current = null;
      setToast((t) => (t ? { ...t, vuelta: null } : t));
      if (!demo && volver) router.push(volver);
    }, 1000);
  }
  useEffect(() => () => clearInterval(vuelta.current), []);

  /** Aplica `key` `veces` veces (el "+2"): aquí al momento, y cada una a la fila del servidor. */
  function ejecutar(key, veces = 1) {
    cancelarVuelta();
    let actual = cliente;
    let r = null;
    let hechas = 0;
    for (let i = 0; i < veces; i += 1) {
      const paso = ACCIONES[key].aplicar(actual, negocio);
      if (paso.ok === false) { if (!hechas) r = paso; break; }
      actual = paso.cliente;
      r = paso;
      hechas += 1;
    }
    if (!hechas) {
      setToast({ ok: false, msg: r.mensaje });
      navigator.vibrate?.([80, 60, 80]);
      return;
    }
    setCliente(actual);
    setToast({ ok: true, msg: hechas > 1 ? `${hechas} sellos añadidos · ${r.mensaje.split("· ").pop()}` : r.mensaje });
    navigator.vibrate?.(50);
    if (opciones.volverAlEscaner && /^sellar/.test(key)) empezarVuelta();
    if (demo) return;
    for (let i = 0; i < hechas; i += 1) enviar(key);
  }

  function enviar(key) {
    pendientes.current += 1;
    fila.current = fila.current.then(async () => {
      try {
        const res = await fetch("/api/accion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serial, accion: key }),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          if (data.cliente) setCliente(data.cliente);
          setToast({ ok: false, msg: data.mensaje || data.error || "No se ha guardado. Vuelve a intentarlo." });
          navigator.vibrate?.([80, 60, 80]);
        } else if (pendientes.current === 1) {
          setCliente(data.cliente);
          setToast((t) => (t?.ok ? { ...t, detalle: resumenAviso(data.aviso) } : t));
        }
      } catch {
        setToast({ ok: false, msg: "Sin conexión. No se ha guardado: vuelve a intentarlo." });
        router.refresh();
      } finally {
        pendientes.current -= 1;
        if (!pendientes.current) router.refresh();
      }
    });
  }

  const accent = negocio.tema.accent;
  const e = estadoDe(cliente, negocio);
  const conFoto = useConFotoBanda(negocio);
  const banda = stripDelPase(conFoto, cliente);

  return (
    <>
      {alLlegar && (
        <div role="note" style={{ ...avisoTarjeta, borderColor: `${accent}66`, background: `${accent}0d` }}>
          <span style={{ color: accent, display: "inline-flex", marginTop: 2 }}><Icono nombre="megafono" tam={18} /></span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 650, letterSpacing: 0.6, textTransform: "uppercase", color: accent }}>En su tarjeta pone</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{alLlegar}</div>
            {cliente.mensaje !== alLlegar && (
              <div style={{ fontSize: 12, color: C.tenue, marginTop: 4 }}>Ya se ha quitado de su tarjeta al sumar la visita.</div>
            )}
          </div>
        </div>
      )}
      <div style={{ ...panel, padding: 0, overflow: "hidden", borderColor: `${accent}66` }}>
        <img
          src={comoDataUri(svgBandaOpaca(banda.svg, negocio.tema.cardBg))}
          alt={e.esCupon ? (e.usado ? "Cupón usado" : "Cupón válido") : describirBanda(cliente, negocio)}
          style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${banda.ancho} / ${banda.alto}` }}
        />
        {!e.esCupon && negocio.cartillas ? cartillasDe(cliente, negocio).map((c) => (
          <div key={c.clave} style={{ ...cuentaFila, borderTop: c.indice ? `1px solid ${C.borde}` : 0 }}>
            <span style={{ fontSize: 15, color: c.completa ? accent : C.suave, fontWeight: c.completa ? 650 : 400 }}>
              <strong style={{ color: C.texto, fontWeight: 600 }}>{c.nombre}</strong>
              {" · "}{c.completa ? `premio listo: ${c.premio}` : `faltan ${c.faltan} para ${c.premio}`}
            </span>
            <span style={{ fontSize: 20, fontWeight: 650 }}>{c.sellos}/{c.meta}</span>
          </div>
        )) : (
          <div style={cuentaFila}>
            {e.esCupon ? (
              <>
                <span style={{ fontSize: 16, fontWeight: 600, color: e.usado ? C.tenue : accent }}>{e.usado ? "Ya usado" : "Válido, un solo uso"}</span>
                <span style={{ fontSize: 14, color: C.suave, textAlign: "right" }}>{negocio.premio}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, color: e.completa ? accent : C.suave, fontWeight: e.completa ? 650 : 400 }}>
                  {e.completa ? `Premio listo: ${negocio.premio}` : `Faltan ${e.faltan} para ${negocio.premio}`}
                </span>
                <span style={{ fontSize: 22, fontWeight: 650 }}>{e.sellos}/{e.meta}</span>
              </>
            )}
          </div>
        )}
      </div>

      <WorkerActions
        filas={filasDeCaja(negocio)}
        premios={premiosDe(cliente, negocio)}
        accent={accent}
        ejecutar={ejecutar}
        toast={toast}
        grande={opciones.grande}
        onCancelarVuelta={cancelarVuelta}
      />
    </>
  );
}

// "Le ha llegado al iPhone" / "…al Android": que la caja sepa que el cliente se ha enterado.
function resumenAviso(a) {
  if (!a) return null;
  const donde = [
    a.avisados > 0 && "iPhone",
    (a.web > 0 || a.google > 0) && "Android",
  ].filter(Boolean);
  return donde.length ? `Aviso enviado a su ${donde.join(" y su ")}.` : null;
}

const cuentaFila = { padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 };
const avisoTarjeta = { display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", marginBottom: 12, border: "1px solid", borderRadius: RADIO.fila };
