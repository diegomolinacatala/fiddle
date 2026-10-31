"use client";

import { useEffect, useState } from "react";
import ClaveNueva from "@/app/ClaveNueva";
import CambiarClave from "./CambiarClave";
import Bloque from "../Bloque";
import { C, panel } from "@/app/ui";
import { MESES_SIN_USO, legalCompleto } from "@/lib/legal";
import { confirmar } from "@/app/Dialogo";
import { confirmarTarjetas } from "../manager/confirmarTarjetas";

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

export default function PanelAjustes({ slug, negocio: n, usuarios, esAdmin = false, reloj = false }) {
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
          <Bloque
            primero data-recorrido="abierto" accent={accent} icono="reloj" titulo="«● Abierto hasta…» en la tarjeta"
            resumen={!n.horario
              ? "Pon tu horario en Tienda y la tarjeta dirá si estás abierto."
              : !enPase
                ? "Apagado: la tarjeta no dice si estás abierto."
                : reloj
                  ? "En el iPhone, sobre los puntos; en Android, en los detalles y en la tarjeta web."
                  : "En la tarjeta web ya sale. En Wallet, cuando el reloj de los avisos esté en marcha."}
            interruptor={{ on: Boolean(n.horario) && enPase, disabled: !n.horario || guardandoEnPase, onClick: cambiarEnPase }}
          />
          <Bloque
            data-recorrido="pedir-nombre" accent={accent} icono="clientes" titulo="Pedir el nombre al escanear"
            resumen="Un paso más antes de la Wallet, pero la caja sabe quién es cada uno. El nombre es para reconocerle en caja: no sale en su tarjeta y se guarda cifrado."
            interruptor={{ on: pedirNombre, onClick: cambiarPedirNombre }}
          />
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
              : <>Usuario <strong style={{ color: C.texto }}>{usuarios.manager}</strong>. Si cambias tu contraseña, aquí sigues dentro; en los demás dispositivos habrá que volver a entrar.</>}
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

const toast = {
  position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
  background: C.toastFondo, color: C.toastTexto, padding: "10px 18px", borderRadius: 10,
  fontWeight: 500, maxWidth: "90vw", textAlign: "center", boxShadow: "0 6px 20px rgba(16,20,28,.25)",
};
