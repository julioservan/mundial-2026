"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/lib/supabase/auth";
import { scorePick, winnerOf, type Outcome, type Pick } from "@/lib/scoring";
import { type ResultMap, fetchResults } from "@/lib/results";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";
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

interface Phase {
  key: string;
  label: string;
  order: number;
}

// Fase (pestaña) a la que pertenece un partido: jornada de grupos o ronda KO.
function phaseOf(m: Match): Phase {
  if (m.stage === "group") {
    const md = m.matchday ?? 1;
    return { key: `g${md}`, label: `Jornada ${md}`, order: md };
  }
  const KO_ORDER: Record<string, number> = {
    round32: 10,
    round16: 11,
    quarterfinal: 12,
    semifinal: 13,
    third_place: 14,
    final: 15,
  };
  return {
    key: m.stage,
    label: stageLabel(m.stage),
    order: KO_ORDER[m.stage] ?? 99,
  };
}

export function PredictionForm({ matches }: Props) {
  const { loading: authLoading, user } = useAuth();
  const [picks, setPicks] = useState<PickMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [assignments, setAssignments] = useState<
    Record<string, SlotAssignment>
  >({});
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [activePhase, setActivePhase] = useState("g1");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Rellena los equipos de eliminatoria con los cruces reales del feed.
  const enriched = useMemo<Match[]>(
    () =>
      matches.map((m) => {
        if (m.stage === "group") return m;
        const a = assignments[m.id];
        if (!a) return m;
        return {
          ...m,
          homeTeamId: a.homeTeamId ?? m.homeTeamId,
          awayTeamId: a.awayTeamId ?? m.awayTeamId,
        };
      }),
    [matches, assignments],
  );

  // Un partido es pronosticable cuando ya se conocen ambos equipos.
  const isPlayable = (m: Match) => Boolean(m.homeTeamId && m.awayTeamId);
  const isKnockout = (m: Match) => m.stage !== "group";

  // Fases a mostrar: las jornadas de grupo siempre; las rondas KO solo cuando
  // al menos un cruce tiene ya equipos definidos.
  const phases = useMemo<Phase[]>(() => {
    const map = new Map<string, Phase>();
    for (const m of enriched) {
      if (isKnockout(m) && !enriched.some((x) => x.stage === m.stage && isPlayable(x))) {
        continue;
      }
      const p = phaseOf(m);
      map.set(p.key, p);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [enriched]);

  // Reloj: refresca cada 30 s para bloquear los partidos al empezar sin recargar.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const validIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  const onlyValid = useCallback(
    (map: PickMap): PickMap => {
      const out: PickMap = {};
      for (const [id, p] of Object.entries(map)) {
        if (validIds.has(id)) out[id] = p;
      }
      return out;
    },
    [validIds],
  );

  // Cruces de eliminatoria desde el feed (para rellenar equipos).
  useEffect(() => {
    let active = true;
    fetchFixtureAssignments()
      .then((a) => active && setAssignments(a))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Carga inicial de pronósticos (Supabase con sesión, localStorage sin ella).
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
          const orphans = Object.keys(remote).filter((id) => !validIds.has(id));
          for (const id of orphans) {
            void deleteRemote(user.id, id).catch(() => {});
          }
          const remoteValid = onlyValid(remote);
          const local = onlyValid(loadLocal());
          if (Object.keys(remoteValid).length === 0 && hasAnyPick(local)) {
            await migrateLocalToRemote(user.id, local);
            clearLocal();
            if (active) setPicks(local);
          } else if (active) {
            setPicks(remoteValid);
          }
        } catch {
          if (active) setStatus("error");
        }
      } else if (active) {
        setPicks(onlyValid(loadLocal()));
      }
      if (active) setHydrated(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, [user, authLoading, validIds, onlyValid]);

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
    const match = enriched.find((m) => m.id === matchId);
    if (!match || !isPlayable(match)) return;
    if (Date.parse(match.kickoff) <= now) return;

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

  // Totales sobre lo pronosticable (los cruces KO aún sin equipos no cuentan).
  const playable = enriched.filter(isPlayable);
  const completed = playable.filter((m) => picks[m.id]).length;
  const progress = playable.length > 0 ? (completed / playable.length) * 100 : 0;
  const visibleMatches = enriched.filter((m) => phaseOf(m).key === activePhase);
  const phasePicked = (key: string) =>
    enriched.filter((m) => phaseOf(m).key === key && isPlayable(m) && picks[m.id])
      .length;
  const phaseTotal = (key: string) =>
    enriched.filter((m) => phaseOf(m).key === key && isPlayable(m)).length;

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
                / {playable.length}
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
          Elige <span className="text-foreground">quién gana</span> cada partido.
          1 punto por acierto. En eliminatorias eliges quién pasa.
        </p>
      </div>

      {/* Pestañas por fase (jornadas de grupo + rondas de eliminatoria) */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {phases.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePhase(p.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              activePhase === p.key
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {p.label}
            <span
              className={`ml-1.5 text-xs ${
                activePhase === p.key ? "opacity-80" : "opacity-60"
              }`}
            >
              {phasePicked(p.key)}/{phaseTotal(p.key)}
            </span>
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visibleMatches.map((match) => {
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
          const playableMatch = isPlayable(match);
          const started = Date.parse(match.kickoff) <= now;
          const locked = started || finished || !playableMatch;
          const knockout = isKnockout(match);

          return (
            <li
              key={match.id}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-colors ${
                pick && !finished ? "border-accent/60" : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3 flex justify-between gap-2 font-semibold">
                <span>
                  {knockout
                    ? stageLabel(match.stage)
                    : `Grupo ${match.group} · J${match.matchday}`}
                </span>
                <span className="flex items-center gap-2">
                  {!playableMatch && (
                    <span className="text-muted-foreground">Por definir</span>
                  )}
                  {playableMatch && locked && !finished && (
                    <span className="text-muted-foreground">🔒 Cerrado</span>
                  )}
                  <span className="font-mono">
                    <LocalTime iso={match.kickoff} />
                  </span>
                </span>
              </div>

              <div className={`grid gap-2 ${knockout ? "grid-cols-2" : "grid-cols-3"}`}>
                <PickButton
                  selected={pick === "home"}
                  correct={actual === "home"}
                  finished={finished}
                  locked={locked}
                  onClick={() => choose(match.id, "home")}
                  flag={home?.flag}
                  label={home?.name ?? "Por definir"}
                  sub={knockout ? "Pasa" : "Gana"}
                />
                {!knockout && (
                  <PickButton
                    selected={pick === "draw"}
                    correct={actual === "draw"}
                    finished={finished}
                    locked={locked}
                    onClick={() => choose(match.id, "draw")}
                    label="Empate"
                    sub="X"
                  />
                )}
                <PickButton
                  selected={pick === "away"}
                  correct={actual === "away"}
                  finished={finished}
                  locked={locked}
                  onClick={() => choose(match.id, "away")}
                  flag={away?.flag}
                  label={away?.name ?? "Por definir"}
                  sub={knockout ? "Pasa" : "Gana"}
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
  locked,
  onClick,
  flag,
  label,
  sub,
}: {
  selected: boolean;
  correct: boolean;
  finished: boolean;
  locked: boolean;
  onClick: () => void;
  flag?: string;
  label: string;
  sub: string;
}) {
  const base =
    "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-all min-h-[4.5rem]";
  const state = finished
    ? correct
      ? "border-accent bg-accent-soft"
      : selected
        ? "border-pink/50 bg-pink/10"
        : "border-border opacity-60"
    : locked
      ? selected
        ? "border-accent bg-accent-soft"
        : "border-border opacity-60"
      : selected
        ? "border-accent bg-accent text-accent-foreground"
        : "border-border hover:border-border-strong hover:bg-surface-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
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
