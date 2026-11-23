"use client";

import { useEffect, useState } from "react";
import { FilaInterruptor } from "@/app/Interruptor";
import { confirmar } from "@/app/Dialogo";
import Icono from "@/app/Icono";
import { C, panel, h2 } from "@/app/ui";

// La TARJETA DEL DUEÑO de una tienda (lib/dueno/): su pase de Wallet con el informe
// semanal. Viene apagada. Apagar no borra nada: al volver a encender es la misma
// tarjeta (mismo serial y token), así que la del iPhone sigue valiendo. «Cambiar la
// llave» es lo contrario a propósito: anula el pase que ande suelto.
// El estado lo pide a /api/admin/dueno; el token y el serial no llegan nunca aquí.
const nota = { fontSize: 12.5, color: C.tenue, margin: "10px 0 0", lineHeight: 1.4 };

const iphonesTexto = (n) => (n > 0 ? `En ${n} iPhone.` : "Aún no está en ningún iPhone.");

async function llamar(metodo, cuerpo, slug) {
  const r = await fetch(metodo === "GET" ? `/api/admin/dueno?slug=${slug}` : "/api/admin/dueno", {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify({ slug, ...cuerpo }) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d };
}

export default function TarjetaDuenoAdmin({ slug, accent, flash }) {
  const [estado, setEstado] = useState(null); // { activa, iphones }
  const [fallo, setFallo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    llamar("GET", null, slug)
      .then(({ ok, d }) => vivo && (ok ? setEstado(d) : setFallo(true)))
      .catch(() => vivo && setFallo(true));
    return () => { vivo = false; };
  }, [slug]);

  async function enviar(metodo, cuerpo, aviso) {
    setGuardando(true);
    try {
      const { ok, d } = await llamar(metodo, cuerpo, slug);
      if (!ok) return flash(d.error || "No se pudo guardar");
      setEstado(d);
      flash(aviso);
    } catch {
      flash("Sin conexión: no se ha guardado");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarLlave() {
    const si = await confirmar({
      titulo: "Cambiar la llave",
      texto: "La tarjeta que tenga en el iPhone dejará de funcionar y tendrá que añadirla otra vez. ¿Seguro?",
      si: "Cambiar la llave", peligro: true, accent,
    });
    if (si) enviar("POST", { accion: "llave" }, "Llave nueva: tiene que volver a añadirla desde Tienda");
  }

  const on = estado?.activa === true;
  const lado = on
    ? { titulo: "Encendida para esta tienda", texto: `El dueño la añade desde Tienda → Tu tarjeta de dueño, debajo del QR. Cada lunes le llega el resumen de la semana. ${iphonesTexto(estado.iphones)}` }
    : { titulo: "Apagada para esta tienda", texto: "La que tenga en el iPhone deja de actualizarse. Al volver a encenderla, sigue siendo la misma." };

  return (
    <section style={panel}>
      <h2 style={h2}>Tarjeta del dueño</h2>
      {fallo ? (
        <p style={{ ...nota, margin: 0, color: C.mal }}>No se pudo leer el estado de la tarjeta.</p>
      ) : (
        <FilaInterruptor
          on={on} accent={accent} icono="cartera" disabled={!estado || guardando}
          titulo={estado ? lado.titulo : "Cargando…"} texto={estado ? lado.texto : ""}
          onClick={() => enviar("PUT", { activa: !on }, on ? "Tarjeta del dueño apagada" : "Tarjeta del dueño encendida")}
        />
      )}
      {on && (
        <>
          <button type="button" onClick={cambiarLlave} disabled={guardando}
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: C.texto, background: "transparent", border: `1px solid ${C.bordeFuerte}`, borderRadius: 8, cursor: guardando ? "default" : "pointer" }}>
            <Icono nombre="candado" tam={15} /> Cambiar la llave
          </button>
          <p style={nota}>Para cuando el pase se pierde o se ha reenviado a quien no debía.</p>
        </>
      )}
    </section>
  );
}
