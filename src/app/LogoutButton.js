"use client";

import { useRouter } from "next/navigation";
import { botonPequeno } from "@/app/ui";

// Cierra la sesión y vuelve al login del mismo negocio.
export default function LogoutButton({ negocio, style }) {
  const router = useRouter();

  async function salir() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.push(negocio ? `/login?b=${encodeURIComponent(negocio)}` : "/login");
    router.refresh();
  }

  return (
    <button onClick={salir} style={{ ...botonPequeno, flexShrink: 0, ...style }}>
      Salir
    </button>
  );
}
