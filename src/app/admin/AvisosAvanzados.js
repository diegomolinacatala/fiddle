"use client";

import InterruptorTienda from "@/app/admin/InterruptorTienda";

// Los avisos AUTOMÁTICOS y PROGRAMADOS de una tienda: solo el admin los
// enciende. Apagados, sus pestañas no salen en Avisos y el reloj no manda nada
// de ellos (lib/motorAvisos.js), ni siquiera las reglas que la tienda dejó
// encendidas. No se borra nada: al volver a encenderlos, están como estaban.
export default function AvisosAvanzados(props) {
  return (
    <InterruptorTienda
      {...props}
      clave="avisosAvanzados"
      seccion="Avisos automáticos y programados"
      icono="megafono"
      encendido={{
        titulo: "Encendidos para esta tienda",
        texto: "Salen sus pestañas en Avisos y el reloj manda lo que la tienda tenga encendido.",
        aviso: "Automáticos y programados, encendidos",
      }}
      apagado={{
        titulo: "Apagados para esta tienda",
        texto: "Sin pestañas y sin envíos: ni las reglas que dejó encendidas. Sus reglas se guardan tal cual.",
        aviso: "Automáticos y programados, apagados",
      }}
      nota="«Enviar» (ahora o a una hora de hoy o de mañana) funciona siempre."
    />
  );
}
