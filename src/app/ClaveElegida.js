"use client";

import { C, campo, botonSecundario } from "@/app/ui";

// ============================================================================
// ELEGIR UNA CONTRASEÑA (la invitación y Ajustes → «Cambiar mi contraseña»)
// ----------------------------------------------------------------------------
// Las mismas piezas en los dos sitios: el campo con su «Ver», la ayuda de cuánto
// falta, el «Son iguales.» de la repetida y la comprobación que hace el servidor
// (problemaClaveElegida en lib/claves.js), para avisar antes de enviar. Que las
// dos sean iguales solo se mira aquí: al servidor llega una. Se comparan sin los
// espacios de los lados, que el servidor también quita.
// ============================================================================

export const MIN = 10; // el mismo mínimo que lib/claves.js (MIN_ELEGIDA)

export function Clave({ id, valor, onChange, ver, setVer, autoFocus, autoComplete = "new-password" }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        type={ver ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        autoFocus={autoFocus}
        style={{ ...campo, minWidth: 0 }}
      />
      {/* Un solo «Ver», en una: enseña todas, que es cuando se ve en qué no coinciden. */}
      {setVer && (
        <button type="button" onClick={() => setVer((v) => !v)} style={{ ...botonSecundario, flexShrink: 0 }}>
          {ver ? "Ocultar" : "Ver"}
        </button>
      )}
    </div>
  );
}

export function Coinciden({ clave, repetida }) {
  const a = clave.trim();
  const b = repetida.trim();
  const [color, frase] =
    b && a === b ? [C.ok, "Son iguales."]
    : b.length >= a.length && b ? [C.mal, "No es igual que la de arriba."]
    : [C.tenue, "Otra vez, para saber que está bien escrita."];
  return <div style={{ fontSize: 12, color, marginTop: 6 }}>{frase}</div>;
}

export function Ayuda({ valor }) {
  const faltan = MIN - valor.trim().length;
  return (
    <div style={{ fontSize: 12, color: faltan > 0 ? C.tenue : C.ok, marginTop: 6 }}>
      {faltan > 0 ? `Al menos ${MIN} caracteres${valor ? ` (faltan ${faltan})` : ""}. Mejor una frase que una palabra rara.` : "Vale."}
    </div>
  );
}

/** Lo mismo que comprueba el servidor, más que las dos sean iguales. El problema, o null si vale. */
export function revisar(clave, repetida, usuario) {
  const s = clave.trim();
  if (s.length < MIN) return `Tiene que tener al menos ${MIN} caracteres.`;
  if (s.toLowerCase() === usuario.toLowerCase()) return "No puede ser igual que el usuario.";
  if (/^(.)\1+$/.test(s)) return "No puede ser el mismo carácter repetido.";
  if (!repetida.trim()) return "Escríbela otra vez en «Repítela».";
  if (repetida.trim() !== s) return "Las dos no son iguales. Con «Ver» puedes mirarlas.";
  return null;
}

/** ¿Se puede ya enviar? (para atenuar el botón mientras no) */
export const lista = (clave, repetida) => clave.trim().length >= MIN && repetida.trim() === clave.trim();
