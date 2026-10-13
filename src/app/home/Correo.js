"use client";

import { useEffect, useRef, useState } from "react";
import Icono from "@/app/Icono";
import { CORREO, enlaceCorreo, enlaceGmail } from "./datos";

// ============================================================================
// ESCRIBIRNOS POR CORREO
// ----------------------------------------------------------------------------
// Un mailto: solo funciona si el aparato tiene una app de correo configurada.
// En el móvil casi siempre (Mail, Gmail); en un ordenador muchas veces no, y al
// pulsarlo no pasa nada. Así que:
//   - con dedo (móvil, tableta): mailto, que abre su app con el correo empezado;
//   - con ratón (ordenador): el MISMO enlace pasa a ser Gmail en otra pestaña,
//     con el correo ya escrito. Un enlace de verdad, no window.open: ningún
//     bloqueador de ventanas lo para, y el clic central o Ctrl+clic van como siempre;
//   - y al lado, «Copiar», para quien use otro correo.
// Sin JavaScript (y en el primer pintado) queda el mailto.
// ============================================================================

export default function Correo({ children }) {
  const [conRaton, setConRaton] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const reloj = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const mirar = () => setConRaton(mq.matches);
    mirar();
    mq.addEventListener("change", mirar);
    return () => {
      mq.removeEventListener("change", mirar);
      clearTimeout(reloj.current);
    };
  }, []);

  async function copiar() {
    if (!(await alPortapapeles(CORREO))) {
      // Ni con permiso ni a la antigua: que la copie a mano.
      window.prompt("Copia nuestra dirección de correo:", CORREO);
      return;
    }
    setCopiado(true);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setCopiado(false), 2200);
  }

  const enlace = conRaton
    ? { href: enlaceGmail(), target: "_blank", rel: "noopener noreferrer" }
    : { href: enlaceCorreo() };

  return (
    <div className="contacto-correo">
      <a {...enlace} className="contacto-via">
        {children}
      </a>
      <button type="button" className="contacto-copiar" onClick={copiar}>
        <Icono nombre={copiado ? "check" : "copiar"} tam={20} />
        <span>{copiado ? "Copiado" : "Copiar"}</span>
        {!copiado && <span className="solo-lector"> la dirección de correo</span>}
      </button>
      <span className="solo-lector" role="status">{copiado ? "Dirección copiada" : ""}</span>
    </div>
  );
}

// El portapapeles moderno pide permiso y algunos navegadores (o vistas dentro de
// otra app) lo niegan; entonces, el de siempre: un textarea seleccionado y «copiar».
// El foco vuelve a donde estaba (seleccionar el textarea se lo lleva).
async function alPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const antes = document.activeElement;
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    // 16px: con menos, el iPhone hace zoom al enfocarlo.
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
      antes?.focus?.();
    }
  }
}
