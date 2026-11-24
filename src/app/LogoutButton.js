"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { botonPequeno } from "@/app/ui";

// Cierra la sesión y vuelve al login, con `next` al sitio del que sale (la caja o
// el manager): al volver a entrar, /api/login lleva ahí si es de esa tienda. El
// login sale vacío (lo rellena el navegador).
export default function LogoutButton({ negocio, rol = "manager", style }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    const sitio = rol === "caja" ? "caja" : "manager";
    router.push(negocio ? `/login?next=${encodeURIComponent(`/${negocio}/${sitio}`)}` : "/login");
    router.refresh();
  }

  return (
    <button onClick={salir} disabled={saliendo} aria-busy={saliendo || undefined} style={{ ...botonPequeno, flexShrink: 0, ...style }}>
      Salir
    </button>
  );
}
