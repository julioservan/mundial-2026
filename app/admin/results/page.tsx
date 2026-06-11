"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/lib/supabase/auth";
import {
  type ResultMap,
  deleteResult,
  fetchResults,
  upsertResult,
} from "@/lib/results";

type SyncStatus = "idle" | "saving" | "saved" | "error";

// Solo partidos con ambos equipos definidos (en eliminatorias aún no se sabe).
const PLAYABLE = MATCHES.filter((m) => m.homeTeamId && m.awayTeamId);

export default function AdminResultsPage() {
  const { loading, user, profile } = useAuth();
  const [results, setResults] = useState<ResultMap>({});
  const [status, setStatus] = useState<SyncStatus>("idle");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      if (loading || !profile?.is_admin) return;
      try {
        const data = await fetchResults();
        if (active) setResults(data);
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loading, profile?.is_admin]);

  const scheduleSync = useCallback(
    (matchId: string, score: { home: string; away: string }) => {
      clearTimeout(timersRef.current[matchId]);
      setStatus("saving");
      timersRef.current[matchId] = setTimeout(async () => {
        try {
          if (score.home !== "" && score.away !== "") {
            await upsertResult(matchId, Number(score.home), Number(score.away));
          } else {
            await deleteResult(matchId);
          }
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, 600);
    },
    [],
  );

  function updateScore(matchId: string, side: "home" | "away", value: string) {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 2);
    const score = {
      home: side === "home" ? sanitized : results[matchId]?.home ?? "",
      away: side === "away" ? sanitized : results[matchId]?.away ?? "",
    };
    setResults({ ...results, [matchId]: score });
    scheduleSync(matchId, score);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!user || !profile?.is_admin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Acceso restringido</h1>
        <p className="text-muted-foreground text-sm">
          Esta página es solo para administradores.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const entered = Object.values(results).filter(
    (r) => r.home !== "" && r.away !== "",
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <header className="mb-8">
        <Link
          href="/admin"
          className="text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          ← Panel admin
        </Link>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-3">
          Resultados <span className="font-display text-accent">reales.</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Introduce el marcador final de cada partido. El ranking se recalcula
          automáticamente. {entered}/{PLAYABLE.length} cargados.
          {status === "saving" && " · Guardando…"}
          {status === "saved" && " · Guardado ✓"}
          {status === "error" && (
            <span className="text-pink"> · Error al guardar</span>
          )}
        </p>
      </header>

      <ul className="space-y-3">
        {PLAYABLE.map((match) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          const r = results[match.id] ?? { home: "", away: "" };
          const done = r.home !== "" && r.away !== "";

          return (
            <li
              key={match.id}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 ${
                done ? "border-accent/60" : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4 flex justify-between font-semibold">
                <span>
                  {match.group ? `Grupo ${match.group}` : "Eliminatoria"}
                  {match.matchday ? ` · J${match.matchday}` : ""}
                </span>
                <span className="font-mono">
                  <LocalTime iso={match.kickoff} />
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-semibold tracking-tight truncate text-sm sm:text-base">
                    {home?.name}
                  </span>
                  <span className="text-2xl shrink-0" aria-hidden>
                    {home?.flag}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.home}
                    onChange={(e) => updateScore(match.id, "home", e.target.value)}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
                    placeholder="—"
                    aria-label={`Goles de ${home?.name}`}
                  />
                  <span className="text-muted-foreground text-xs font-mono">vs</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={r.away}
                    onChange={(e) => updateScore(match.id, "away", e.target.value)}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
                    placeholder="—"
                    aria-label={`Goles de ${away?.name}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl shrink-0" aria-hidden>
                    {away?.flag}
                  </span>
                  <span className="font-semibold tracking-tight truncate text-sm sm:text-base">
                    {away?.name}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
