"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { botonPequeno } from "@/app/ui";

// Cierra la sesión y vuelve al login del mismo negocio. Con `next` al sitio del
// que sale (la caja o el manager): así /login rellena el usuario que toca
// (usuarioSugerido en lib/acceso.js). Sin eso, la caja se encontraba el usuario
// del dueño y fallaba con su propia contraseña hasta quedar bloqueada.
export default function LogoutButton({ negocio, rol = "manager", style }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    const sitio = rol === "caja" ? "caja" : "manager";
    router.push(negocio ? `/login?b=${encodeURIComponent(negocio)}&next=${encodeURIComponent(`/${negocio}/${sitio}`)}` : "/login");
    router.refresh();
  }

  return (
    <button onClick={salir} disabled={saliendo} aria-busy={saliendo || undefined} style={{ ...botonPequeno, flexShrink: 0, ...style }}>
      Salir
    </button>
  );
}
