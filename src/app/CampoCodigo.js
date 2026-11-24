"use client";

import { campo } from "@/app/ui";

// El código de 6 cifras que llega por correo (invitación y recuperar contraseña):
// letras grandes y espaciadas para poder cotejarlo con el correo de un vistazo, y
// `one-time-code` para que el móvil lo ofrezca solo desde el mensaje.
export default function CampoCodigo({ id, valor, onChange, autoFocus }) {
  return (
    <input
      id={id}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      autoFocus={autoFocus}
      style={{ ...campo, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 24, letterSpacing: "0.35em", textAlign: "center" }}
    />
  );
}
