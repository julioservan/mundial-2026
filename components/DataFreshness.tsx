"use client";

import { useEffect, useState } from "react";
import { fetchFreshness, type DataFreshness } from "@/lib/fixtures";

function ago(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// Indicador de frescura de los datos automáticos. Muestra cuándo se sincronizó
// por última vez y avisa si los datos pueden estar retrasados (cuota agotada).
export function DataFreshness() {
  const [info, setInfo] = useState<DataFreshness | null>(null);

  useEffect(() => {
    let active = true;
    fetchFreshness()
      .then((f) => {
        if (active) setInfo(f);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!info || !info.at) return null;

  const stale = Boolean(info.note) || !info.ok;
  return (
    <div
      className={`inline-flex items-center gap-2 text-[11px] rounded-full px-3 py-1 border ${
        stale
          ? "border-amber-500/40 text-amber-500 bg-amber-500/5"
          : "border-border text-muted-foreground"
      }`}
      title={info.note || "Datos sincronizados automáticamente"}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          stale ? "bg-amber-500" : "bg-emerald-500"
        }`}
        aria-hidden
      />
      {stale ? "Datos quizá con retraso" : "Datos en vivo"}
      <span className="opacity-60">· {ago(info.at)}</span>
    </div>
  );
}
