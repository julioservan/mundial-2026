"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/AdminGuard";

interface Health {
  status: "green" | "amber" | "red";
  reasons?: string[];
  reason?: string;
  lastSyncAt?: string;
  ageMinutes?: number;
  dailyCount?: number | null;
  dailyCap?: number | null;
  providerRemaining?: number | null;
  league?: { leagueId?: number; season?: number } | null;
  unknownTeams?: string[];
  lastErrors?: string[];
}

const DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};
const LABEL: Record<string, string> = {
  green: "Todo correcto",
  amber: "Atención",
  red: "Problema",
};

function ago(iso?: string): string {
  if (!iso) return "—";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-t border-border/60 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export default function AdminSyncPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((active: () => boolean = () => true) => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => active() && setHealth(d))
      .catch(
        () =>
          active() &&
          setHealth({ status: "red", reason: "No se pudo leer /api/health" }),
      )
      .finally(() => active() && setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  // El botón sí puede marcar "cargando" (es un manejador de evento, no un efecto).
  const refresh = () => {
    setLoading(true);
    load();
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Link
          href="/admin"
          className="text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          ← Panel admin
        </Link>
        <header className="mt-3 mb-8 flex items-end justify-between gap-3 flex-wrap">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Sincro<span className="font-display text-accent">nización.</span>
          </h1>
          <button
            onClick={refresh}
            className="text-sm font-semibold border border-border rounded-lg px-3 py-1.5 hover:border-accent/40 transition-colors"
          >
            ↻ Refrescar
          </button>
        </header>

        {loading && !health ? (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        ) : health ? (
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${DOT[health.status]}`}
                  aria-hidden
                />
                <span className="text-lg font-bold">
                  {LABEL[health.status] ?? health.status}
                </span>
              </div>
              {(health.reasons?.length || health.reason) && (
                <ul className="mt-3 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {health.reason && <li>{health.reason}</li>}
                  {health.reasons?.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface border border-border rounded-2xl px-6 py-2">
              <Row label="Última sincronización" value={ago(health.lastSyncAt)} />
              <Row
                label="Peticiones hoy (nuestra cuenta)"
                value={
                  health.dailyCount != null
                    ? `${health.dailyCount}${health.dailyCap ? ` / ${health.dailyCap}` : ""}`
                    : "—"
                }
              />
              <Row
                label="Cuota restante (proveedor)"
                value={health.providerRemaining ?? "—"}
              />
              <Row
                label="Liga / temporada detectada"
                value={
                  health.league?.leagueId
                    ? `id ${health.league.leagueId} · ${health.league.season}`
                    : "—"
                }
              />
              <Row
                label="Equipos sin reconocer"
                value={health.unknownTeams?.length ?? 0}
              />
            </div>

            {(health.unknownTeams?.length ?? 0) > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/40 rounded-2xl p-5 text-sm">
                <p className="font-semibold text-amber-500 mb-2">
                  Nombres del feed sin mapear
                </p>
                <p className="text-muted-foreground mb-2">
                  Añádelos en <code>lib/data/team-aliases.ts</code> para que cuenten.
                </p>
                <ul className="list-disc list-inside">
                  {health.unknownTeams?.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {(health.lastErrors?.length ?? 0) > 0 && (
              <div className="bg-red-500/5 border border-red-500/40 rounded-2xl p-5 text-sm">
                <p className="font-semibold text-red-500 mb-2">Últimos errores</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  {health.lastErrors?.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AdminGuard>
  );
}
