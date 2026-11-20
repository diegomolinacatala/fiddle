"use client";

import { useState } from "react";

// Lo que ve quien escanea una tienda que ya no puede dar tarjetas: deja su correo
// y se la mandamos en cuanto pueda (lib/listaDeEspera.js). Mismo estilo que
// PedirNombre: los colores de la tienda y las clases de su página.
export default function ListaDeEspera({ slug, meses }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [apuntado, setApuntado] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    const email = String(new FormData(e.currentTarget).get("email") || "").trim();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/espera?b=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      // Mientras miraba la página la tienda ha vuelto a tener sitio: que la saque ya.
      if (data.hayCupo) return location.reload();
      if (!res.ok) throw new Error(data.error || "No se ha podido apuntar. Prueba otra vez.");
      setApuntado(email);
    } catch (err) {
      setError(err instanceof TypeError ? "Sin conexión. Prueba otra vez." : err.message);
      setEnviando(false);
    }
  }

  if (apuntado) {
    return <p role="status" className="promesa entra"><span>Listo. Te escribiremos a {apuntado} en cuanto podamos darte la tarjeta.</span></p>;
  }

  return (
    <>
      <form onSubmit={enviar} className="formulario entra" style={{ animationDelay: "120ms" }}>
        <label htmlFor="correo-espera" className="solo-lector">Tu correo</label>
        <input
          id="correo-espera"
          name="email"
          type="email"
          className="campo"
          placeholder="Tu correo"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={120}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "error-espera" : undefined}
        />
        <button type="submit" className="boton" disabled={enviando} aria-busy={enviando || undefined}>
          {enviando ? <span className="giro" role="status" aria-label="Apuntándote" /> : "Avisadme cuando pueda"}
        </button>
        {error && <p id="error-espera" role="alert" className="error">{error}</p>}
      </form>
      <p className="letra entra" style={{ animationDelay: "200ms" }}>
        Solo usamos tu correo para mandarte la tarjeta de esta tienda. Lo borramos al mandártela, o a los {meses} meses si no podemos.{" "}
        <a href={`/privacidad?b=${slug}`}>Privacidad</a>
      </p>
    </>
  );
}
