"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/lib/supabase/auth";
import { scorePrediction, type Outcome } from "@/lib/scoring";
import { type ResultMap, fetchResults } from "@/lib/results";
import {
  type ScoreMap,
  clearLocal,
  deleteAllRemote,
  deleteRemote,
  fetchRemote,
  hasAnyFilled,
  isFilled,
  loadLocal,
  migrateLocalToRemote,
  saveLocal,
  upsertRemote,
} from "@/lib/predictions";

type SyncStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  matches: Match[];
}

export function PredictionForm({ matches }: Props) {
  const { loading: authLoading, user } = useAuth();
  const [predictions, setPredictions] = useState<ScoreMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Carga inicial: desde Supabase si hay sesión (migrando lo local la primera
  // vez), o desde localStorage si se juega sin cuenta.
  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      // Los resultados reales son públicos: se cargan haya sesión o no.
      try {
        const res = await fetchResults();
        if (active) setResults(res);
      } catch {
        // si fallan los resultados, seguimos solo con las predicciones
      }
      if (user) {
        try {
          const remote = await fetchRemote(user.id);
          const local = loadLocal();
          if (Object.keys(remote).length === 0 && hasAnyFilled(local)) {
            await migrateLocalToRemote(user.id, local);
            clearLocal();
            if (active) setPredictions(local);
          } else if (active) {
            setPredictions(remote);
          }
        } catch {
          if (active) setStatus("error");
        }
      } else if (active) {
        setPredictions(loadLocal());
      }
      if (active) setHydrated(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  // Guarda un partido concreto (con rebote) en la base de datos.
  const scheduleRemoteSync = useCallback(
    (matchId: string, score: { home: string; away: string }) => {
      if (!user) return;
      clearTimeout(timersRef.current[matchId]);
      setStatus("saving");
      timersRef.current[matchId] = setTimeout(async () => {
        try {
          if (isFilled(score)) {
            await upsertRemote(
              user.id,
              matchId,
              Number(score.home),
              Number(score.away),
            );
          } else {
            await deleteRemote(user.id, matchId);
          }
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, 600);
    },
    [user],
  );

  function updateScore(
    matchId: string,
    side: "home" | "away",
    value: string,
    inputIndex: number,
  ) {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 2);
    const previous = predictions[matchId]?.[side] ?? "";
    const score = {
      home: side === "home" ? sanitized : predictions[matchId]?.home ?? "",
      away: side === "away" ? sanitized : predictions[matchId]?.away ?? "",
    };
    const next = { ...predictions, [matchId]: score };
    setPredictions(next);

    if (user) {
      scheduleRemoteSync(matchId, score);
    } else {
      saveLocal(next);
    }

    // Salta al siguiente campo al teclear un dígito (no al borrar).
    if (sanitized.length > previous.length) {
      inputsRef.current[inputIndex + 1]?.focus();
    }
  }

  async function handleReset() {
    if (!confirm("¿Borrar todas las predicciones?")) return;
    setPredictions({});
    if (user) {
      setStatus("saving");
      try {
        await deleteAllRemote(user.id);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    } else {
      clearLocal();
    }
  }

  const completed = hydrated
    ? Object.values(predictions).filter(isFilled).length
    : 0;
  const progress = matches.length > 0 ? (completed / matches.length) * 100 : 0;

  if (!hydrated) {
    return <PredictionsSkeleton rows={Math.min(matches.length, 6)} />;
  }

  return (
    <div>
      {hydrated && !user && (
        <div className="bg-accent-soft border border-accent/30 rounded-2xl px-5 py-4 mb-6 text-sm flex items-center justify-between gap-4">
          <span>
            Estás jugando <strong>sin cuenta</strong>. Tus predicciones se
            guardan solo en este navegador.
          </span>
          <Link
            href="/login"
            className="shrink-0 font-semibold text-accent hover:underline underline-offset-4"
          >
            Inicia sesión →
          </Link>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-5 mb-8 sticky top-16 z-10 backdrop-blur">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Progreso
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl text-accent leading-none">
                {completed}
              </span>
              <span className="text-muted-foreground text-sm">
                / {matches.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && <SyncBadge status={status} />}
            <button
              onClick={handleReset}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Resetear
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-3">
        {matches.map((match, matchIndex) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          const homeInputIndex = matchIndex * 2;
          const p = predictions[match.id] ?? { home: "", away: "" };
          const filled = isFilled(p);
          const result = results[match.id];
          const finished = Boolean(result && isFilled(result));
          const scored = finished && filled ? scorePrediction(p, result!) : null;

          return (
            <li
              key={match.id}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-colors ${
                finished
                  ? "border-border"
                  : filled
                    ? "border-accent/60"
                    : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4 flex justify-between font-semibold">
                <span>
                  Grupo {match.group} · J{match.matchday}
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
                    ref={(el) => {
                      inputsRef.current[homeInputIndex] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={p.home}
                    onChange={(e) =>
                      updateScore(match.id, "home", e.target.value, homeInputIndex)
                    }
                    disabled={finished}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="—"
                    aria-label={`Goles de ${home?.name}`}
                  />
                  <span className="text-muted-foreground text-xs font-mono">vs</span>
                  <input
                    ref={(el) => {
                      inputsRef.current[homeInputIndex + 1] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={p.away}
                    onChange={(e) =>
                      updateScore(match.id, "away", e.target.value, homeInputIndex + 1)
                    }
                    disabled={finished}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

              {finished && (
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Resultado final:{" "}
                    <span className="font-mono text-foreground font-semibold">
                      {result!.home}–{result!.away}
                    </span>
                  </span>
                  {scored ? (
                    <OutcomeBadge outcome={scored.outcome} points={scored.points} />
                  ) : (
                    <span className="text-muted-foreground/70">Sin predicción</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const label =
    status === "saving"
      ? "Guardando…"
      : status === "saved"
        ? "Guardado ✓"
        : status === "error"
          ? "Error al guardar"
          : "";
  if (!label) return null;
  return (
    <span
      className={`text-xs font-medium ${
        status === "error" ? "text-pink" : "text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

function OutcomeBadge({ outcome, points }: { outcome: Outcome; points: number }) {
  const config = {
    exact: { label: "¡Marcador exacto!", cls: "bg-accent text-accent-foreground" },
    outcome: { label: "Acertaste el resultado", cls: "bg-cyan/20 text-cyan" },
    miss: { label: "Fallaste", cls: "bg-surface-muted text-muted-foreground" },
  }[outcome];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${config.cls}`}
    >
      {config.label}
      <span className="font-mono">
        {points > 0 ? `+${points}` : points} pt{points === 1 ? "" : "s"}
      </span>
    </span>
  );
}

function PredictionsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse">
      <div className="bg-surface border border-border rounded-2xl p-5 mb-8 h-20" />
      <ul className="space-y-3">
        {Array.from({ length: Math.max(rows, 3) }).map((_, i) => (
          <li
            key={i}
            className="bg-surface border border-border rounded-2xl p-4 sm:p-5 h-28"
          />
        ))}
      </ul>
    </div>
  );
}
