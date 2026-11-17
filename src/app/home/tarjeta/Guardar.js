"use client";

import { useRef, useState } from "react";
import { leerContactos, MAX_CONTACTO } from "@/lib/interesados";

// ----------------------------------------------------------------------------
// El último paso: un email, un teléfono o los dos, sin verificar (con uno basta).
// Guarda lo elegido y nos lo enseña en /admin. Lo que se dice aquí tiene que ser
// verdad de lo que se hace.
// ----------------------------------------------------------------------------
const NO_SE_GUARDO = "No se ha podido guardar. Prueba otra vez.";

function Guardar({ eleccion, alGuardar }) {
  const [campos, setCampos] = useState({ email: "", telefono: "" });
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({}); // { email, telefono, ninguno, servidor }
  const refs = { email: useRef(null), telefono: useRef(null) };

  const escribir = (campo) => (ev) => {
    const valor = ev.target.value;
    setCampos((c) => ({ ...c, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined, ninguno: undefined, servidor: undefined }));
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    const { email, telefono, errores: mal } = leerContactos(campos);
    if (mal) {
      setErrores(mal);
      refs[mal.email || mal.ninguno ? "email" : "telefono"].current?.focus();
      return;
    }
    setEnviando(true);
    setErrores({});
    try {
      const r = await fetch("/api/interesados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, telefono, eleccion }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || NO_SE_GUARDO);
      // Sin volver a poner `enviando` a false: este formulario ya no se vuelve a ver.
      alGuardar({ email, telefono });
    } catch (err) {
      setErrores({ servidor: err.message || NO_SE_GUARDO });
      setEnviando(false);
    }
  };

  const campo = (id, etiqueta, extra) => (
    <div className="prob-campo">
      <label className="prob-nombre prob-contacto">
        <span className="prob-oculto">{etiqueta}</span>
        <input
          ref={refs[id]}
          value={campos[id]}
          onChange={escribir(id)}
          placeholder={etiqueta}
          maxLength={MAX_CONTACTO}
          enterKeyHint="send"
          aria-invalid={Boolean(errores[id] || errores.ninguno)}
          aria-describedby={errores[id] ? `prob-error-${id}` : errores.ninguno ? "prob-error-ninguno" : undefined}
          {...extra}
        />
      </label>
      {errores[id] && <p id={`prob-error-${id}`} className="prob-error" role="alert">{errores[id]}</p>}
    </div>
  );

  return (
    <form className="prob-guardar" onSubmit={enviar} noValidate>
      {campo("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false })}
      {campo("telefono", "Teléfono", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
      {errores.ninguno && <p id="prob-error-ninguno" className="prob-error" role="alert">{errores.ninguno}</p>}
      {errores.servidor && <p className="prob-error" role="alert">{errores.servidor}</p>}
      <button type="submit" className="prob-siguiente prob-ancho" disabled={enviando} aria-busy={enviando || undefined}>
        {enviando ? "Guardando…" : "Guardar mi tarjeta"}
      </button>
      <p className="prob-legal">
        Lo usamos solo para hablarte de tu tarjeta. Si cambias de idea, escríbenos y lo borramos. <a href="/privacidad">Privacidad</a>
      </p>
    </form>
  );
}

export default Guardar;
