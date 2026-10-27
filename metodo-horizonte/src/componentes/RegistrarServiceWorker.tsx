"use client";

import { useEffect } from "react";

/** Registra o service worker em produção, para o app abrir e lançar sem internet. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app funciona normalmente, só não abre offline.
    });
  }, []);
  return null;
}
