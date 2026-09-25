"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// El único paso antes de la Wallet: el nombre.
//
// Sin JavaScript (el cliente escribe antes de que cargue) es un formulario
// normal: POST a /api/tap y vuelta a esta página. Con él, no recarga: pide la
// tarjeta y refresca, y la página, que ya ve la cookie, enseña la Wallet.
export default function PedirNombre({ slug, nuevo }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [refrescando, empezar] = useTransition();
  const [error, setError] = useState(null);
  const accion = `/api/tap?b=${slug}${nuevo ? "&nuevo=1" : ""}`;
  const ocupado = enviando || refrescando;

  async function enviar(e) {
    e.preventDefault();
    if (ocupado) return; // dos toques seguidos serían dos tarjetas
    const nombre = new FormData(e.currentTarget).get("nombre");
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(accion, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ir) throw new Error(data.error || "No se ha podido crear la tarjeta. Prueba otra vez.");
      // `ir` es esta misma página salvo con WalletWallet (su web, fuera de aquí).
      if (!data.ir.startsWith("/")) return window.location.assign(data.ir);
      empezar(() => (nuevo ? router.replace(data.ir) : router.refresh()));
    } catch (err) {
      setError(err instanceof TypeError ? "Sin conexión. Prueba otra vez." : err.message);
      setEnviando(false);
    }
  }

  return (
    <form action={accion} method="post" onSubmit={enviar} className="formulario entra" style={{ animationDelay: "120ms" }}>
      <label htmlFor="nombre" className="solo-lector">Tu nombre</label>
      <input
        id="nombre"
        name="nombre"
        className="campo"
        placeholder="Tu nombre"
        autoComplete="given-name"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        maxLength={48}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "error-nombre" : undefined}
      />
      <button type="submit" className="boton" disabled={ocupado} aria-busy={ocupado || undefined}>
        {ocupado ? <span className="giro" role="status" aria-label="Creando tu tarjeta" /> : "Continuar"}
      </button>
      {error && <p id="error-nombre" role="alert" className="error">{error}</p>}
    </form>
  );
}
