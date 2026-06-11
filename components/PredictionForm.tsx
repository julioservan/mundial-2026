"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/lib/supabase/auth";
import { scorePick, winnerOf, type Outcome, type Pick } from "@/lib/scoring";
import { type ResultMap, fetchResults } from "@/lib/results";
import {
  type PickMap,
  clearLocal,
  deleteAllRemote,
  deleteRemote,
  fetchRemote,
  hasAnyPick,
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
  const [picks, setPicks] = useState<PickMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Carga inicial: desde Supabase si hay sesión (migrando lo local la primera
  // vez), o desde localStorage si se juega sin cuenta. Los resultados son
  // públicos y se cargan siempre.
  useEffect(() => {
    let active = true;
    async function load() {
      if (authLoading) return;
      try {
        const res = await fetchResults();
        if (active) setResults(res);
      } catch {
        // seguimos sin resultados
      }
      if (user) {
        try {
          const remote = await fetchRemote(user.id);
          const local = loadLocal();
          if (Object.keys(remote).length === 0 && hasAnyPick(local)) {
            await migrateLocalToRemote(user.id, local);
            clearLocal();
            if (active) setPicks(local);
          } else if (active) {
            setPicks(remote);
          }
        } catch {
          if (active) setStatus("error");
        }
      } else if (active) {
        setPicks(loadLocal());
      }
      if (active) setHydrated(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, authLoading]);

  const scheduleRemoteSync = useCallback(
    (matchId: string, pick: Pick | null) => {
      if (!user) return;
      clearTimeout(timersRef.current[matchId]);
      setStatus("saving");
      timersRef.current[matchId] = setTimeout(async () => {
        try {
          if (pick) await upsertRemote(user.id, matchId, pick);
          else await deleteRemote(user.id, matchId);
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, 500);
    },
    [user],
  );

  function choose(matchId: string, pick: Pick) {
    // Volver a pulsar la opción ya elegida la deselecciona.
    const nextPick = picks[matchId] === pick ? null : pick;
    const next = { ...picks };
    if (nextPick) next[matchId] = nextPick;
    else delete next[matchId];
    setPicks(next);

    if (user) scheduleRemoteSync(matchId, nextPick);
    else saveLocal(next);
  }

  async function handleReset() {
    if (!confirm("¿Borrar todos los pronósticos?")) return;
    setPicks({});
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

  const completed = Object.keys(picks).length;
  const progress = matches.length > 0 ? (completed / matches.length) * 100 : 0;

  if (!hydrated) {
    return <PredictionsSkeleton rows={Math.min(matches.length, 6)} />;
  }

  return (
    <div>
      {!user && (
        <div className="bg-accent-soft border border-accent/30 rounded-2xl px-5 py-4 mb-6 text-sm flex items-center justify-between gap-4">
          <span>
            Estás jugando <strong>sin cuenta</strong>. Tus pronósticos se guardan
            solo en este navegador.
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
              Pronosticados
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
        <p className="text-[11px] text-muted-foreground mt-3">
          Elige <span className="text-foreground">quién gana</span> cada partido
          (o empate). 1 punto por acierto.
        </p>
      </div>

      <ul className="space-y-3">
        {matches.map((match) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          const pick = picks[match.id] ?? null;
          const result = results[match.id];
          const finished = Boolean(
            result && result.home !== "" && result.away !== "",
          );
          const actual = finished
            ? winnerOf(Number(result!.home), Number(result!.away))
            : null;
          const scored = finished && pick ? scorePick(pick, result!) : null;

          return (
            <li
              key={match.id}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-colors ${
                pick && !finished ? "border-accent/60" : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3 flex justify-between font-semibold">
                <span>
                  Grupo {match.group} · J{match.matchday}
                </span>
                <span className="font-mono">
                  <LocalTime iso={match.kickoff} />
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PickButton
                  selected={pick === "home"}
                  correct={actual === "home"}
                  finished={finished}
                  onClick={() => choose(match.id, "home")}
                  flag={home?.flag}
                  label={home?.name ?? "Local"}
                  sub="Gana"
                />
                <PickButton
                  selected={pick === "draw"}
                  correct={actual === "draw"}
                  finished={finished}
                  onClick={() => choose(match.id, "draw")}
                  label="Empate"
                  sub="X"
                />
                <PickButton
                  selected={pick === "away"}
                  correct={actual === "away"}
                  finished={finished}
                  onClick={() => choose(match.id, "away")}
                  flag={away?.flag}
                  label={away?.name ?? "Visitante"}
                  sub="Gana"
                />
              </div>

              {finished && (
                <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Resultado final:{" "}
                    <span className="font-mono text-foreground font-semibold">
                      {result!.home}–{result!.away}
                    </span>
                  </span>
                  {scored ? (
                    <OutcomeBadge outcome={scored.outcome} points={scored.points} />
                  ) : (
                    <span className="text-muted-foreground/70">Sin pronóstico</span>
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

function PickButton({
  selected,
  correct,
  finished,
  onClick,
  flag,
  label,
  sub,
}: {
  selected: boolean;
  correct: boolean;
  finished: boolean;
  onClick: () => void;
  flag?: string;
  label: string;
  sub: string;
}) {
  // Resalta en verde el ganador real cuando el partido ya terminó.
  const base =
    "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-all min-h-[4.5rem]";
  const state = finished
    ? correct
      ? "border-accent bg-accent-soft"
      : selected
        ? "border-pink/50 bg-pink/10"
        : "border-border opacity-60"
    : selected
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border hover:border-border-strong hover:bg-surface-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={finished}
      className={`${base} ${state} disabled:cursor-not-allowed`}
    >
      {flag && (
        <span className="text-xl leading-none" aria-hidden>
          {flag}
        </span>
      )}
      <span className="text-xs font-semibold tracking-tight leading-tight line-clamp-2">
        {label}
      </span>
      <span className="text-[9px] uppercase tracking-wider opacity-70">{sub}</span>
    </button>
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
    correct: { label: "Acertaste", cls: "bg-accent text-accent-foreground" },
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
      <div className="bg-surface border border-border rounded-2xl p-5 mb-8 h-24" />
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
