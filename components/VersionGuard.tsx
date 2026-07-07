"use client";

import { useEffect, useRef } from "react";

// Guardián de versión: si la pestaña lleva tanto tiempo abierta que su bundle
// ya no corresponde al despliegue actual, recarga la página al volver a primer
// plano. Evita que clientes con código antiguo cacheado sigan operando (una
// pestaña de móvil con semanas de vida llegó a borrar pronósticos ejecutando
// una limpieza ya retirada).
export function VersionGuard() {
  // Versión con la que arrancó esta pestaña (se fija en la primera respuesta).
  const initial = useRef<string | null>(null);

  useEffect(() => {
    let checking = false;

    async function check() {
      if (checking) return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v?: string };
        if (!v || v === "dev") return;
        if (initial.current === null) {
          initial.current = v;
          return;
        }
        if (v !== initial.current) {
          // Hay un despliegue más nuevo: recarga para soltar el bundle viejo.
          // Se hace al volver a la pestaña, cuando recargar no interrumpe nada.
          window.location.reload();
        }
      } catch {
        // sin red no se puede comprobar; se reintentará
      } finally {
        checking = false;
      }
    }

    void check(); // fija la versión de arranque

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Respaldo para pestañas que nunca pasan a segundo plano.
    const t = setInterval(() => void check(), 6 * 3_600_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(t);
    };
  }, []);

  return null;
}
