"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { C, botonSecundario } from "@/app/ui";

// ============================================================================
// RECORRIDO DE BIENVENIDA — globos sobre la pantalla de verdad
// ----------------------------------------------------------------------------
// La primera vez que alguien entra al manager o a la caja, se oscurece la
// pantalla menos una parte y un globo explica qué es. No es una maqueta: señala
// los botones reales, marcados con `data-recorrido="<ancla>"` en su pantalla.
// Si un ancla no está (la tienda es de cupón y no tiene cartilla), ese paso se
// salta solo.
//
// Que ya lo vio se guarda POR USUARIO en la base (/api/tutorial), no en el
// navegador: la caja cambia de móvil y el dueño entra desde varios sitios.
// El botón (?) de la cabecera (<BotonAyuda>) lo vuelve a lanzar.
//
// Añadir un paso = una entrada en RECORRIDOS + el `data-recorrido` en la pantalla.
// ============================================================================

export const RECORRIDOS = {
  manager: [
    { ancla: "cartilla", titulo: "Tu tarjeta", texto: "Con «Editar tarjeta» tocas cualquier parte de ella (logo, colores, sellos, premio) y la cambias. Al guardar, cambia en todos los teléfonos." },
    { ancla: "botones-caja", titulo: "Lo que puede hacer la caja", texto: "Lo que ve quien atiende al escanear una tarjeta. En «Editar vista de caja» eliges sus botones y lo pruebas antes de guardar." },
    { ancla: "ubicacion", titulo: "Dónde está la tienda", texto: "«Elegir en el mapa» y pon el punto en tu puerta. Cuando un cliente pase cerca, el iPhone le saca la tarjeta en la pantalla de bloqueo." },
    { ancla: "vista-previa", titulo: "Así la ve el cliente", texto: "La tarjeta tal cual sale en el móvil, en Apple y en Google. Escribe el código de un cliente para ver la suya." },
    { ancla: "horario", titulo: "Cuándo abres", texto: "Tu horario y los festivos. Los avisos a una hora se eligen dentro de él, y la tarjeta web dice si estás abierto." },
    { ancla: "tag", titulo: "El tag y el QR del mostrador", texto: "Quien lo toque o lo escanee se lleva su tarjeta. Graba el tag desde aquí o imprime el QR." },
    { ancla: "pedir-nombre", titulo: "¿Pedir el nombre?", texto: "Apagado, el cliente va directo a la Wallet. Encendido, escribe su nombre antes: un paso más, pero la caja sabe quién es." },
    { ancla: "pestana-clientes", titulo: "Tus clientes", texto: "Quién viene, quién ha dejado de venir y a quién le falta un sello." },
    { ancla: "pestana-avisos", titulo: "Avisos", texto: "Promos para todos y mensajes a un grupo, ahora o a la hora que elijas de hoy o de mañana." },
    { ancla: "pestana-plantilla", titulo: "Tu plantilla", texto: "Quién atiende la caja. Cada uno elige su nombre en su móvil y aquí ves los sellos, el ritmo y las correcciones de cada persona." },
    { ancla: "pestana-ajustes", titulo: "Ajustes", texto: "La contraseña de la caja (si se va alguien, cámbiala aquí) y cómo abrir la caja en otro móvil." },
    { ancla: "ayuda", titulo: "¿Otra vez?", texto: "Este botón vuelve a enseñar el recorrido cuando quieras." },
  ],
  caja: [
    { ancla: "escanear", titulo: "Escanea la tarjeta", texto: "El cliente enseña su tarjeta en el móvil y apuntas al QR. Se abre su ficha con los botones para sellar." },
    { ancla: "codigo", titulo: "Si el QR no se lee", texto: "Debajo del QR hay un código de 3 letras. Escríbelo aquí y abre la misma ficha." },
    { ancla: "clientes", titulo: "Los últimos clientes", texto: "Toca uno para abrir su ficha sin escanear." },
    { ancla: "hoy", titulo: "Lo tuyo de hoy", texto: "Los sellos, clientes y premios que llevas hoy. Solo lo tuyo: cada sello se apunta a quien atiende." },
    { ancla: "cambiar-quien", titulo: "El relevo", texto: "Si coges el móvil de otra persona, toca «Cambiar» y elige tu nombre. Se pregunta solo una vez al día en cada móvil." },
    { ancla: "ayuda", titulo: "¿Otra vez?", texto: "Este botón vuelve a enseñar el recorrido cuando quieras." },
  ],
};

const EVENTO = "recorrido:abrir";
const MARGEN = 16;
const HUECO = 8; // aire alrededor de lo que se señala

/** El (?) de la cabecera. Lanza el recorrido de la pantalla en la que está. */
export function BotonAyuda({ style }) {
  return (
    <button
      type="button"
      data-recorrido="ayuda"
      onClick={() => window.dispatchEvent(new Event(EVENTO))}
      aria-label="Ver el recorrido de ayuda"
      title="Ayuda"
      style={{ ...botonSecundario, padding: 0, width: 40, height: 40, display: "grid", placeItems: "center", flexShrink: 0, ...style }}
    >
      <Icono nombre="ayuda" tam={20} />
    </button>
  );
}

/**
 * @param {{recorrido: keyof typeof RECORRIDOS, accent?: string}} props
 */
export default function Recorrido({ recorrido, accent = C.texto }) {
  const pasos = RECORRIDOS[recorrido];
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const globo = useRef(null);
  const [altoGlobo, setAltoGlobo] = useState(160);

  // ¿Ya lo vio? Si no, arranca solo, con la pantalla ya pintada.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/tutorial?recorrido=${recorrido}`)
      .then((r) => (r.ok ? r.json() : { visto: true })) // ante la duda, no molestar
      .then((d) => { if (vivo && !d.visto) setTimeout(() => vivo && abrir(), 700); })
      .catch(() => {});
    const alPedir = () => abrir();
    window.addEventListener(EVENTO, alPedir);
    return () => { vivo = false; window.removeEventListener(EVENTO, alPedir); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorrido]);

  function abrir() {
    const primero = siguienteVisible(pasos, 0, 1);
    if (primero === -1) return;
    setI(primero);
    setAbierto(true);
  }

  const cerrar = useCallback(() => {
    setAbierto(false);
    setRect(null);
    fetch("/api/tutorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recorrido }) })
      .catch(() => {});
  }, [recorrido]);

  const ir = useCallback((dir) => {
    const j = siguienteVisible(pasos, i + dir, dir);
    if (j === -1) return dir > 0 ? cerrar() : undefined;
    setI(j);
  }, [i, pasos, cerrar]);

  // Lleva a la vista lo que toca y lo sigue si la página se mueve.
  useEffect(() => {
    if (!abierto) return;
    const el = document.querySelector(`[data-recorrido="${pasos[i].ancla}"]`);
    if (!el) return ir(1);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const medir = () => setRect(el.getBoundingClientRect());
    medir();
    const t = setTimeout(medir, 400); // cuando acaba el desplazamiento suave
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, i]);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    globo.current?.focus();
    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, i, ir, cerrar]);

  useLayoutEffect(() => {
    if (globo.current) setAltoGlobo(globo.current.offsetHeight);
  }, [abierto, i, rect]);

  if (!abierto) return null;
  const paso = pasos[i];
  const visibles = pasos.filter((p) => document.querySelector(`[data-recorrido="${p.ancla}"]`));
  const n = visibles.indexOf(paso) + 1;
  const ultimo = siguienteVisible(pasos, i + 1, 1) === -1;
  const pos = rect ? colocar(rect, altoGlobo) : null;

  return (
    // La capa se come los toques: mientras dura, la pantalla solo se mira.
    <div style={capa}>
      {rect && (
        <div
          aria-hidden
          style={{
            ...foco,
            top: rect.top - HUECO, left: rect.left - HUECO,
            width: rect.width + HUECO * 2, height: rect.height + HUECO * 2,
          }}
        />
      )}
      <div
        ref={globo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorrido-titulo"
        tabIndex={-1}
        style={{ ...globoEstilo, ...(pos || { top: "50%", left: MARGEN, right: MARGEN }), borderTop: `4px solid ${accent}` }}
      >
        <div style={{ fontSize: 12, color: C.tenue, fontWeight: 600 }}>{n} de {visibles.length}</div>
        <h2 id="recorrido-titulo" style={{ fontSize: 16, fontWeight: 650, margin: "4px 0 6px" }}>{paso.titulo}</h2>
        <p style={{ fontSize: 14, color: C.suave, lineHeight: 1.5, margin: 0 }}>{paso.texto}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          {!ultimo && <button type="button" onClick={cerrar} style={saltar}>Saltar</button>}
          <div style={{ flex: 1 }} />
          {n > 1 && <button type="button" onClick={() => ir(-1)} style={{ ...botonSecundario, padding: "0.5rem 0.9rem" }}>Anterior</button>}
          <button type="button" onClick={() => ir(1)} style={{ ...siguiente, background: accent }}>
            {ultimo ? "Entendido" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Índice del próximo paso cuya ancla está en pantalla, en la dirección `dir`, o -1.
function siguienteVisible(pasos, desde, dir) {
  for (let j = desde; j >= 0 && j < pasos.length; j += dir) {
    if (document.querySelector(`[data-recorrido="${pasos[j].ancla}"]`)) return j;
  }
  return -1;
}

// Debajo de lo señalado si cabe; si no, encima; si tampoco (es más alto que la
// pantalla), pegado abajo. En horizontal, centrado sobre ello sin salirse.
function colocar(r, alto) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(360, vw - MARGEN * 2);
  const left = Math.min(Math.max(r.left + r.width / 2 - ancho / 2, MARGEN), vw - ancho - MARGEN);
  const abajo = r.bottom + HUECO + 12;
  if (abajo + alto <= vh - MARGEN) return { top: abajo, left, width: ancho };
  const arriba = r.top - HUECO - 12 - alto;
  if (arriba >= MARGEN) return { top: arriba, left, width: ancho };
  return { bottom: MARGEN, left, width: ancho };
}

const capa = { position: "fixed", inset: 0, zIndex: 1000 };
const foco = {
  position: "fixed", borderRadius: 14, pointerEvents: "none",
  boxShadow: "0 0 0 9999px rgba(15,18,24,.58)", transition: "all .25s ease",
};
const globoEstilo = {
  position: "fixed", background: "#fff", borderRadius: 14, padding: "14px 16px",
  boxShadow: "0 12px 32px rgba(16,20,28,.28)", outline: "none", transition: "top .25s ease, left .25s ease",
};
const saltar = { border: 0, background: "transparent", color: C.suave, fontSize: 14, cursor: "pointer", padding: "0.5rem 0", minHeight: 36 };
const siguiente = { border: 0, borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 14, padding: "0.55rem 1rem", cursor: "pointer" };
