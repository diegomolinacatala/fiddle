"use client";

import { useRouter } from "next/navigation";

// Cierra la sesión y vuelve al login del mismo negocio.
export default function LogoutButton({ negocio, style }) {
  const router = useRouter();

  async function salir() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.push(negocio ? `/login?b=${encodeURIComponent(negocio)}` : "/login");
    router.refresh();
  }

  return (
    <button onClick={salir} style={{ ...base, ...style }}>
      Salir
    </button>
  );
}

const base = {
  padding: "0.4rem 0.9rem",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.25)",
  background: "transparent",
  color: "rgba(255,255,255,.75)",
  fontSize: 13,
  cursor: "pointer",
};
