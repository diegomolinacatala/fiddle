"use client";

import { useEffect } from "react";

// Registra el service worker en producción (en dev no, para no cachear cambios).
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
