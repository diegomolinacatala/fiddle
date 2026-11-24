"use client";

import { useEffect, useState } from "react";
import { NumeroVisto } from "@/app/useVisto";
import ClaveNueva from "@/app/ClaveNueva";
import CambiarClave from "./CambiarClave";
import Bloque from "../Bloque";
import { avanceDe } from "@/lib/primerosPasos";
import { C, panel } from "@/app/ui";
import { MESES_SIN_USO, legalCompleto } from "@/lib/legal";
import { confirmar } from "@/app/Dialogo";
import { confirmarTarjetas } from "../manager/confirmarTarjetas";
import { tiene } from "@/lib/planes";
import { PLANES, enlaceWhatsApp } from "@/app/home/datos";

// ============================================================================
// AJUSTES — lo de la cuenta
// ----------------------------------------------------------------------------
// Antes la contraseña de la caja vivía en Tienda, debajo del horario, a la
// vista cada vez que se entraba a cambiar la tarjeta. Es lo de "se va un
// empleado": se toca casi nunca y no debe estar en medio. Las mismas filas que
// en Tienda (Bloque.js). Aquí también la propia contraseña del dueño (dando la
// actual) y «Cerrar todas las sesiones», que es lo de la cuenta. Y, arriba,
// «● Abierto hasta…» en la tarjeta: es donde lo busca el dueño (31-10-2026), no
// dentro del horario ni al fondo del editor de la tarjeta.
// ============================================================================

export default function PanelAjustes({ slug, negocio: n, plan = null, usuarios, esAdmin = false, reloj = false }) {
  const abiertoEnPlan = tiene(n, "abierto");
  const [enPase, setEnPase] = useState(n.tema.abierto !== false);
  const [guardandoEnPase, setGuardandoEnPase] = useState(false);
  const [pedirNombre, setPedirNombre] = useState(Boolean(n.pedirNombre));
  const [claveCaja, setClaveCaja] = useState(null); // contraseña nueva de la caja, se ve una vez
  const [cambiandoClave, setCambiandoClave] = useState(false); // el formulario de «Cambiar mi contraseña»
  const [msg, setMsg] = useState(null);
  const [origin, setOrigin] = useState("");
  const accent = n.tema.accent;

  useEffect(() => setOrigin(window.location.origin), []);
  function flash(m) { setMsg(m); setTimeout(() => setMsg(null), 3000); }

  // Un ordenador ajeno donde se quedó abierta, un móvil perdido: fuera todos, sin
  // cambiar contraseñas. La sesión de quien lo pide se vuelve a firmar en el servidor.
  async function cerrarSesiones() {
    if (!(await confirmar({
      titulo: "¿Cerrar la sesión en todos los dispositivos?",
      texto: "También en el móvil de la caja: habrá que volver a entrar en todos con las contraseñas de siempre. Aquí sigues dentro.",
      si: "Cerrar las sesiones", accent,
    }))) return;
    try {
      const res = await fetch(`/api/sesiones?b=${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "No se pudieron cerrar");
      flash("Sesiones cerradas en los demás dispositivos");
    } catch {
      flash("Sin conexión: no se han cerrado");
    }
  }

  // Un empleado que se va, un móvil perdido: contraseña nueva y la vieja deja de valer.
  async function cambiarClaveCaja() {
    if (!(await confirmar({
      titulo: "¿Cambiar la contraseña de la caja?",
      texto: "La actual dejará de valer y los móviles que tengan la caja abierta se quedarán fuera. Tendrás que escribir la nueva en el móvil de la caja.",
      si: "Cambiarla", accent,
    }))) return;
    try {
      const res = await fetch(`/api/accesos/caja?b=${slug}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "No se pudo cambiar");
      setClaveCaja(data);
    } catch {
      flash("Sin conexión: no se ha cambiado");
    }
  }

  // Se guarda al tocarlo, tras avisar: pone al día la tarjeta de todos los clientes.
  async function cambiarEnPase() {
    const on = !enPase;
    if (!(await confirmarTarjetas(accent))) return;
    setGuardandoEnPase(true);
    try {
      const res = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tema: { abierto: on } }),
      });
      const data = await res.json();
      if (!res.ok) return flash(data.error || "No se pudo guardar");
      setEnPase(data.tema?.abierto !== false);
      flash(on ? "La tarjeta dirá si estás abierto" : "La tarjeta ya no dice si estás abierto");
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardandoEnPase(false);
    }
  }

  // No sale en el pase: se guarda al tocarlo, sin preguntar.
  async function cambiarPedirNombre() {
    const on = !pedirNombre;
    setPedirNombre(on);
    try {
      const res = await fetch(`/api/negocio?b=${slug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedirNombre: on }),
      });
      const data = await res.json();
      if (!res.ok) { setPedirNombre(!on); return flash(data.error || "No se pudo guardar"); }
      setPedirNombre(Boolean(data.pedirNombre));
      flash(on ? "Al escanear se pedirá el nombre" : "Al escanear irán directos a la Wallet");
    } catch {
      setPedirNombre(!on);
      flash("Sin conexión: no se ha guardado");
    }
  }

  const urlCaja = `${origin}/${slug}/caja`;
  async function copiarCaja() {
    try { await navigator.clipboard.writeText(urlCaja); flash("Enlace de la caja copiado"); } catch { flash(urlCaja); }
  }

  return (
    <>

        <section style={{ ...panel, maxWidth: 640, marginTop: 20, paddingTop: 6, paddingBottom: 6 }}>
          {n.primerosPasos && <FilaPrimerosPasos slug={slug} negocio={n} accent={accent} />}
          <Bloque
            primero={!n.primerosPasos} data-recorrido="abierto" accent={accent} icono="reloj" titulo="«● Abierto hasta…» en la tarjeta"
            resumen={!abiertoEnPlan
              ? "No va en tu plan: la tarjeta no dice si estás abierto. Mira «Tu plan», más abajo."
              : !n.horario
              ? "Pon tu horario en Tienda y la tarjeta dirá si estás abierto."
              : !enPase
                ? "Apagado: la tarjeta no dice si estás abierto."
                : reloj
                  ? "En el iPhone, sobre los puntos; en Android, en los detalles y en la tarjeta web."
                  : "En la tarjeta web ya sale. En Wallet, cuando el reloj de los avisos esté en marcha."}
            interruptor={{ on: abiertoEnPlan && Boolean(n.horario) && enPase, disabled: !abiertoEnPlan || !n.horario || guardandoEnPase, onClick: cambiarEnPase }}
          />
          <Bloque
            data-recorrido="pedir-nombre" accent={accent} icono="clientes" titulo="Pedir el nombre al escanear"
            resumen="Un paso más antes de la Wallet, pero la caja sabe quién es cada uno. El nombre es para reconocerle en caja: no sale en su tarjeta y se guarda cifrado."
            interruptor={{ on: pedirNombre, onClick: cambiarPedirNombre }}
          />
          {plan && (
            <Bloque
              accent={accent} icono="estrella" titulo={`Tu plan: ${plan.nombre}`}
              resumen={textoDelPlan(plan, slug)}
              accion={mejoraDe(plan, n.nombre)}
            />
          )}
          <Bloque
            accent={accent} icono="candado" titulo="Contraseña de la caja"
            resumen={<>Usuario <strong style={{ color: C.texto }}>{usuarios.caja}</strong>. Si se va alguien o se pierde el móvil, cámbiala: la vieja deja de valer y ese móvil se queda fuera.</>}
            accion={{ texto: "Cambiar contraseña", icono: "editar", onClick: cambiarClaveCaja }}
            abierto={Boolean(claveCaja)}
          >
            {claveCaja && <ClaveNueva accesos={[claveCaja]} onCerrar={() => setClaveCaja(null)} />}
          </Bloque>
          <Bloque
            accent={accent} icono="movil" titulo="La caja en otro móvil"
            resumen={<>Ábrelo en el móvil del mostrador y entra con el usuario de la caja: <span style={{ wordBreak: "break-all" }}>{urlCaja}</span></>}
            accion={{ texto: "Copiar enlace", icono: "copiar", onClick: copiarCaja }}
          />
          {/* Privacidad es de la cuenta, no de la tarjeta: por eso aquí y no en Tienda. */}
          <Bloque
            accent={accent} icono="candado" titulo="Privacidad de tus clientes"
            resumen={<>
              Guardamos sus puntos, premios e historial de visitas{n.pedirNombre ? ", su nombre" : ""} y las notas que apuntes, con el nombre y las notas cifrados.
              {" "}Una tarjeta sin uso en {MESES_SIN_USO} meses se borra sola. Cada cliente puede dejar las promos, descargar sus datos o borrar su tarjeta desde ella.
              {" "}{legalCompleto(n.legal)
                ? <>Tus datos legales están en el aviso{n.legal.email ? <> (contacto: {n.legal.email})</> : null}.</>
                : <span style={{ color: C.mal }}>Faltan tus datos legales (razón social, NIF y email) en el aviso: se ponen con el contrato.</span>}
            </>}
            accion={{ texto: "Ver el aviso de privacidad", icono: "nota", onClick: () => window.open(`/privacidad?b=${slug}`, "_blank", "noopener") }}
          />
          <Bloque
            accent={accent} icono="puerta" titulo="Tu acceso"
            resumen={esAdmin
              ? "Has entrado como administrador de fiddle."
              : <>{usuarios.manager.includes("@") ? "Entras con" : "Usuario"} <strong style={{ color: C.texto }}>{usuarios.manager}</strong>. Si cambias tu contraseña, aquí sigues dentro; en los demás dispositivos habrá que volver a entrar.</>}
            abierto={cambiandoClave}
            accion={esAdmin ? null : {
              texto: cambiandoClave ? "Cerrar" : "Cambiar mi contraseña",
              icono: cambiandoClave ? "cerrar" : "editar",
              onClick: () => setCambiandoClave((v) => !v),
            }}
          >
            <CambiarClave
              slug={slug} usuario={usuarios.manager} accent={accent}
              onHecho={() => { setCambiandoClave(false); flash("Contraseña cambiada"); }}
            />
          </Bloque>
          <Bloque
            accent={accent} icono="movil" titulo="Sesiones abiertas"
            resumen="Si te dejaste la sesión abierta en un ordenador que no es tuyo o se perdió un móvil, ciérralas todas a la vez (la caja también). Las contraseñas no cambian."
            accion={{ texto: "Cerrar todas las sesiones", icono: "cerrar", onClick: cerrarSesiones }}
          />
        </section>

        {msg && <div role="status" style={toast}>{msg}</div>}
    </>
  );
}

// A qué plan puede pasar y el WhatsApp ya escrito, con los precios de la web
// (app/home/datos.js, el único sitio donde viven). Desde Gratis se elige entre los
// dos de pago; desde Básico, Pro; desde Pro, nada (aunque el admin le apague algo).
function mejoraDe(plan, tienda) {
  const precio = (id) => {
    const p = PLANES.find((x) => x.id === id);
    return `${p.nombre}, ${p.precio} €/mes o ${p.anual} €/año`;
  };
  const abrir = (texto) => () => window.open(enlaceWhatsApp(`Hola, soy de ${tienda} y ${texto}.`), "_blank", "noopener");
  if (plan.id === "gratis") {
    return { texto: "Pasar a un plan de pago", icono: "correo", onClick: abrir(`quiero pasar a un plan de pago (${precio("basico")}; ${precio("pro")})`) };
  }
  if (plan.id === "basico") return { texto: "Pasar a Pro", icono: "correo", onClick: abrir(`quiero pasar a Pro (${precio("pro")})`) };
  return null;
}

// Su plan y cómo va de tarjetas (lib/planes.js). Gratis: hasta el límite EN USO (las
// que nadie guardó ni usó no cuentan) y, al llegar, quien escanea se apunta en la
// lista de espera. Básico y Pro: sin límite; Básico dice lo que no lleva. Si falta el
// proveedor de correo lo sabemos nosotros, no el dueño: a él le basta saber que se
// les escribirá.
function textoDelPlan({ id, nombre, cupo, esperan, faltan }, slug) {
  const noLleva = faltan.length ? ` No lleva: ${listaDe(faltan)}${id === "basico" ? "; van en Pro" : ""}.` : "";
  if (!cupo) return faltan.length ? `Tarjetas sin límite.${noLleva}` : "Tarjetas sin límite y todo incluido.";
  // Las que lleva ruedan desde las que vio aquí la última vez (app/useVisto.js).
  const cuenta = <><NumeroVisto id={`${slug}:emitidas`} valor={cupo.emitidas} /> de {cupo.max.toLocaleString("es")} tarjetas en uso.</>;
  const nota = " Las que nadie guardó ni usó no cuentan; las que ya tienen siguen funcionando siempre.";
  const lista = esperan > 0
    ? ` Hay ${esperan} ${esperan === 1 ? "persona" : "personas"} en la lista de espera: les llega su tarjeta por correo en cuanto pases a un plan de pago.`
    : "";
  if (cupo.estado === "cerrado" || cupo.estado === "lleno") {
    return <><span style={{ color: C.mal }}>{cuenta} Has llegado al límite:</span> quien escanea ahora deja su correo y le mandamos la tarjeta cuando pases a un plan de pago.{lista}{nota}</>;
  }
  if (cupo.estado === "cerca") return <><span style={{ color: C.mal }}>{cuenta}</span> Te queda poco para el límite del plan {nombre}.{lista}{nota}</>;
  return <>{cuenta} {faltan.length ? `El plan ${nombre} llega hasta ese límite.${noLleva}` : `El plan ${nombre} lleva todo, hasta ese límite.`}{lista}{nota}</>;
}

/** «a, b y c», en minúscula salvo lo que va entre comillas. */
const listaDe = (nombres) => {
  const n = nombres.map((x) => (x.startsWith("«") ? x : x.charAt(0).toLowerCase() + x.slice(1)));
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n.at(-1)}` : n[0];
};

const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: C.toastFondo, color: C.toastTexto, padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};

/** Los primeros pasos de una tienda nueva (lib/primerosPasos.js): cuánto lleva y volver a ellos. */
function FilaPrimerosPasos({ slug, negocio, accent }) {
  const a = avanceDe(negocio);
  const resumen = a.terminado
    ? "Hechos los cinco. Puedes repasarlos cuando quieras."
    : `${a.hechos.length} de ${a.total} hechos.${a.oculto ? " El aviso de Tienda está oculto: siguen aquí." : ""}`;
  return (
    <Bloque
      primero accent={accent} icono="brote" titulo="Primeros pasos" resumen={resumen}
      accion={{ texto: a.terminado ? "Repasarlos" : "Seguir con ellos", icono: "adelante", onClick: () => { window.location.href = `/${slug}/primeros-pasos${a.siguiente ? `#${a.siguiente}` : "#tarjeta"}`; } }}
    />
  );
}
