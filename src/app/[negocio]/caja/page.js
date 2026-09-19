"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import LogoutButton from "@/app/LogoutButton";
import { normalizarCodigo } from "@/lib/codigo";
import { C, pagina, panel, campo, titulo, subtitulo, botonPrimario, botonSecundario, chipCodigo, aviso } from "@/app/ui";

// App de CAJA de un negocio (móvil, instalable). Escanea el pase; si el QR no se
// deja leer, se teclea el código de 3 caracteres que el cliente ve en su pase.
export default function Caja() {
  const { negocio } = useParams();
  const router = useRouter();
  const [n, setN] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [valor, setValor] = useState("");
  const [manual, setManual] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!negocio) return;
    fetch(`/api/negocio?b=${negocio}`).then((r) => r.json()).then(setN).catch(() => {});
    fetch(`/api/clientes?b=${negocio}`).then((r) => r.json())
      .then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {});
  }, [negocio]);

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

  return (
    <main style={pagina}>
      <div style={{ width: "min(430px, 94vw)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1 style={titulo}>{n?.tema?.emoji || "📱"} {n?.nombre || "Caja"}</h1>
            <p style={subtitulo}>Escanea el QR del pase del cliente.</p>
          </div>
          <LogoutButton negocio={negocio} />
        </header>

        <div style={{ ...panel, marginTop: 16, padding: 16 }}>
          <QrScanner accent={accent} />

          <button onClick={() => { setManual((v) => !v); setError(null); }} style={{ ...botonSecundario, width: "100%", marginTop: 10 }}>
            {manual ? "Ocultar entrada manual" : "Escribir el código a mano"}
          </button>
          {manual && (
            <form onSubmit={abrir} style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={valor}
                  onChange={(e) => { setValor(e.target.value); setError(null); }}
                  placeholder="K7M · o el serial"
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

        <div style={{ fontSize: 12, color: C.tenue, textTransform: "uppercase", letterSpacing: 1, margin: "22px 0 8px" }}>
          Clientes ({clientes.length})
        </div>
        {clientes.slice(0, 15).map((c) => (
          <a key={c.serial} href={`/w/${c.serial}`} style={fila}>
            <span style={chipCodigo(accent)}>{c.codigo}</span>
            <span style={{ fontSize: 14, color: c.nombre ? C.texto : C.suave, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.nombre || "sin nombre"}
            </span>
            <span style={{ fontSize: 14 }}>{c.sellos} · {c.premios || 0} 🎁</span>
          </a>
        ))}
        {clientes.length === 0 && <p style={{ color: C.suave, fontSize: 14 }}>Aún no hay clientes.</p>}
      </div>
    </main>
  );
}

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
