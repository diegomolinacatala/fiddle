"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import QuienAtiende from "./QuienAtiende";
import LogoutButton from "@/app/LogoutButton";
import MarcaTienda from "@/app/MarcaTienda";
import Icono from "@/app/Icono";
import Recorrido, { BotonAyuda } from "@/app/Recorrido";
import { useInstalar } from "@/app/instalable";
import { normalizarCodigo } from "@/lib/codigo";
import { saldoCorto } from "@/lib/cartillas";
import { C, pagina, panel, campo, titulo, subtitulo, botonPrimario, botonSecundario, chipCodigo, aviso } from "@/app/ui";

// App de CAJA de un negocio (móvil, instalable). Escanea el pase; si el QR no se
// deja leer, se teclea el código de 3 caracteres que el cliente ve en su pase.
//
// Si la tienda tiene plantilla (lib/plantilla.js), antes de nada se elige quién
// atiende desde este móvil: una vez al día, y «Cambiar» arriba para el relevo.
// Mientras no se elige, no sale el escáner: ningún sello sin nombre.
export default function Caja() {
  const { negocio } = useParams();
  const router = useRouter();
  const [n, setN] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [valor, setValor] = useState("");
  const [manual, setManual] = useState(false);
  const [error, setError] = useState(null);
  const [quien, setQuien] = useState(null); // lo que dice /api/plantilla/quien
  const [listo, setListo] = useState(false); // ya se sabe si hay que elegir: hasta entonces, sin cámara
  const [eligiendo, setEligiendo] = useState(false);
  const [perdido, setPerdido] = useState(false); // la ficha mandó aquí con un sello sin guardar
  const [volver, setVolver] = useState(null); // a dónde ir tras elegir (la ficha que se escaneó)
  const [guardando, setGuardando] = useState(false);
  const instalar = useInstalar();

  useEffect(() => {
    if (!negocio) return;
    fetch(`/api/negocio?b=${negocio}`)
      .then((r) => {
        // La sesión ya no vale (cambiaron la contraseña de la caja): a entrar otra vez.
        if (r.status === 401) return router.replace(`/login?b=${negocio}&next=/${negocio}/caja`);
        return r.json().then(setN);
      })
      .catch(() => {});
    fetch(`/api/clientes?b=${negocio}`).then((r) => r.json())
      .then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {});
    // ?quien=1 lo manda la ficha (o «Cambiar»): a elegir aunque ya haya alguien.
    const q = new URLSearchParams(window.location.search);
    const destino = q.get("volver");
    setVolver(destino && /^\/w\/[0-9a-f-]{36}$/i.test(destino) ? destino : null);
    setPerdido(q.get("perdido") === "1");
    cargarQuien(q.get("quien") === "1");
  }, [negocio]);

  function cargarQuien(forzar = false) {
    fetch(`/api/plantilla/quien?b=${negocio}`).then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuien(d);
        if (d.elegir || (forzar && d.plantilla.length)) setEligiendo(true);
      })
      .catch(() => {})
      // Pase lo que pase (sin conexión también), la caja sale: quedarse sin escáner sería peor.
      .finally(() => setListo(true));
  }

  async function elegir(e) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/plantilla/quien?b=${negocio}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id }),
      });
      if (!res.ok) throw new Error();
      setEligiendo(false);
      if (volver) return router.push(volver);
      window.history.replaceState(null, "", `/${negocio}/caja`);
      cargarQuien();
    } catch {
      setError("No se pudo guardar quién atiende. Vuelve a intentarlo.");
    } finally {
      setGuardando(false);
    }
  }

  // Acepta las tres formas de referirse a un pase: código corto ("K7M"), serial
  // o la URL entera. El código solo se busca entre los clientes de ESTE negocio,
  // así que el mismo "K7M" de otra tienda nunca se cuela aquí.
  async function abrir(e) {
    e?.preventDefault();
    setError(null);
    const texto = valor.trim();
    if (!texto) return;

    const codigo = normalizarCodigo(texto);
    if (codigo) {
      // La lista cargada cubre lo normal; si no está (tienda con muchos pases),
      // lo resuelve el servidor, que también busca solo dentro de este negocio.
      const local = clientes.find((c) => c.codigo === codigo);
      if (local) return router.push(`/w/${local.serial}`);
      const res = await fetch(`/api/clientes?b=${negocio}&codigo=${codigo}`);
      if (!res.ok) return setError(`Ningún pase de ${n?.nombre || "esta tienda"} con el código ${codigo}.`);
      const cliente = await res.json();
      return router.push(`/w/${cliente.serial}`);
    }

    const m = texto.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    router.push(`/w/${m ? m[0] : texto}`);
  }

  const accent = n?.tema?.accent || C.texto;
  const atiende = quien?.empleado || null;
  const hoy = quien?.hoy || null;
  const filaCliente = (c) => (
    <a key={c.serial} href={`/w/${c.serial}`} style={fila}>
      <span style={chipCodigo(accent)}>{c.codigo}</span>
      <span style={{ fontSize: 14, color: c.nombre ? C.texto : C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.nombre || "sin nombre"}
      </span>
      <span style={{ fontSize: 14, color: C.suave, whiteSpace: "nowrap" }}>{resumenCliente(c, n)}</span>
    </a>
  );

  return (
    <main style={pagina}>
      <div style={{ width: "min(430px, 100%)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {n?.tema && <MarcaTienda tema={n.tema} tam={40} icono />}
            <div style={{ minWidth: 0 }}>
              <h1 style={titulo}>{n?.nombre || "Caja"}</h1>
              {atiende && !eligiendo ? (
                <p style={{ ...subtitulo, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>Atiende <strong style={{ color: C.texto, fontWeight: 600 }}>{atiende.nombre}</strong></span>
                  <button type="button" onClick={() => setEligiendo(true)} data-recorrido="cambiar-quien" style={cambiar}>Cambiar</button>
                </p>
              ) : (
                <p style={subtitulo}>{eligiendo ? "Antes de escanear, di quién eres." : "Escanea la tarjeta del cliente."}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <BotonAyuda />
            <LogoutButton negocio={negocio} />
          </div>
        </header>

        {!listo ? null : eligiendo && quien ? (
          <div style={{ marginTop: 16 }}>
            {perdido && (
              <div role="alert" style={{ ...aviso(false), marginBottom: 10 }}>
                El último sello no se ha guardado: hoy nadie había dicho quién atiende en este móvil. Elige tu nombre y vuelve a darlo.
              </div>
            )}
            {/* Con «Cambiar» ya hay alguien: a la lista directa, no a proponer al mismo. */}
            <QuienAtiende plantilla={quien.plantilla} ultimo={atiende ? null : quien.ultimo} accent={accent} onElegir={elegir} ocupado={guardando} />
            {error && <div role="alert" style={{ ...aviso(false), marginTop: 10 }}>{error}</div>}
            {atiende && (
              <button type="button" onClick={() => setEligiendo(false)} style={{ ...botonSecundario, width: "100%", marginTop: 10 }}>
                Seguir como {atiende.nombre}
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ ...panel, marginTop: 16, padding: 16 }}>
              <div data-recorrido="escanear"><QrScanner accent={accent} /></div>

              <button data-recorrido="codigo" onClick={() => { setManual((v) => !v); setError(null); }} style={{ ...botonSecundario, width: "100%", marginTop: 10 }}>
                {manual ? "Ocultar entrada manual" : "Escribir el código a mano"}
              </button>
              {manual && (
                <form onSubmit={abrir} style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={valor}
                      onChange={(e) => { setValor(e.target.value); setError(null); }}
                      placeholder="K7M, o el serial"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      style={{ ...campo, textTransform: "uppercase", letterSpacing: 1 }}
                    />
                    <button type="submit" style={botonPrimario(accent)}>Abrir</button>
                  </div>
                  <p style={{ fontSize: 12, color: C.tenue, margin: "8px 0 0" }}>
                    El código de 3 caracteres sale debajo del QR del pase.
                  </p>
                  {error && <div role="alert" style={{ ...aviso(false), marginTop: 10 }}>{error}</div>}
                </form>
              )}
            </div>

            {/* Lo suyo de hoy: lo ve solo quien atiende, en su móvil. Los números del equipo son del manager. */}
            {atiende && hoy && (
              <div data-recorrido="hoy" style={{ ...panel, marginTop: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.tenue, textTransform: "uppercase", letterSpacing: 0.8 }}>Hoy, {atiende.nombre}</span>
                <Cuenta n={hoy.sellos} uno="sello" varios="sellos" accent={accent} />
                <Cuenta n={hoy.clientes} uno="cliente" varios="clientes" />
                <Cuenta n={hoy.premios} uno="premio" varios="premios" />
                {hoy.quitados > 0 && <Cuenta n={hoy.quitados} uno="quitado" varios="quitados" color={C.mal} />}
              </div>
            )}

            {/* Lo que señala el recorrido: la etiqueta y las primeras filas, no toda la lista. */}
            <div data-recorrido="clientes">
            <div style={{ fontSize: 12, color: C.tenue, textTransform: "uppercase", letterSpacing: 1, margin: "22px 0 8px" }}>
              Clientes ({clientes.length})
            </div>
            {clientes.slice(0, 3).map(filaCliente)}
            </div>
            {clientes.slice(3, 15).map(filaCliente)}
            {clientes.length === 0 && <p style={{ color: C.suave, fontSize: 14 }}>Aún no hay clientes.</p>}

            {instalar.puede && !instalar.instalada && (
              <button onClick={instalar.instalar} style={{ ...botonSecundario, width: "100%", marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icono nombre="instalar" tam={18} /> Instalar la caja en este móvil
              </button>
            )}
          </>
        )}
        {/* El recorrido espera a que se elija quién atiende: sin escáner no hay nada que señalar. */}
        {!eligiendo && <Recorrido recorrido="caja" accent={accent} />}
      </div>
    </main>
  );
}

function Cuenta({ n, uno, varios, accent, color }) {
  return (
    <span style={{ fontSize: 14, color: color || C.suave }}>
      <strong style={{ fontSize: 18, fontWeight: 650, color: color || accent || C.texto }}>{n}</strong> {n === 1 ? uno : varios}
    </span>
  );
}

const resumenCliente = (c, n) => (n ? saldoCorto(c, n) : String(c.sellos));

const cambiar = { border: 0, background: "transparent", color: C.suave, textDecoration: "underline", cursor: "pointer", font: "inherit", fontSize: 13, padding: 0 };

const fila = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  gap: 10,
  alignItems: "center",
  padding: "12px 14px",
  marginTop: 8,
  borderRadius: 12,
  background: C.panel,
  border: `1px solid ${C.borde}`,
  color: C.texto,
  textDecoration: "none",
};
