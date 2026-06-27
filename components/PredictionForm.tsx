"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";
import { useAuth } from "@/lib/supabase/auth";
import {
  scorePick,
  scoreKnockout,
  winnerOf,
  type Outcome,
  type Pick,
} from "@/lib/scoring";
import { type ResultMap, fetchResults } from "@/lib/results";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";
import {
  type PredEntry,
  type PredMap,
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
  return { key: m.stage, label: stageLabel(m.stage), order: KO_ORDER[m.stage] ?? 99 };
}

export function PredictionForm({ matches }: Props) {
  const { loading: authLoading, user } = useAuth();
  const [picks, setPicks] = useState<PredMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>({});
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [activePhase, setActivePhase] = useState("g1");
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const isPlayable = (m: Match) => Boolean(m.homeTeamId && m.awayTeamId);
  const isKnockout = (m: Match) => m.stage !== "group";

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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const validIds = useMemo(() => new Set(matches.map((m) => m.id)), [matches]);

  const onlyValid = useCallback(
    (map: PredMap): PredMap => {
      const out: PredMap = {};
      for (const [id, p] of Object.entries(map)) {
        if (validIds.has(id)) out[id] = p;
      }
      return out;
    },
    [validIds],
  );

  useEffect(() => {
    let active = true;
    fetchFixtureAssignments()
      .then((a) => active && setAssignments(a))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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

  const scheduleSync = useCallback(
    (matchId: string, e: PredEntry | null) => {
      clearTimeout(timersRef.current[matchId]);
      if (!user) return;
      setStatus("saving");
      timersRef.current[matchId] = setTimeout(async () => {
        try {
          if (e) await upsertRemote(user.id, matchId, e);
          else await deleteRemote(user.id, matchId);
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, 500);
    },
    [user],
  );

  // Aplica un cambio a la entrada de un partido y lo persiste.
  const update = useCallback(
    (matchId: string, mutate: (e: PredEntry | undefined) => PredEntry | null) => {
      setPicks((prev) => {
        const nextEntry = mutate(prev[matchId]);
        const next = { ...prev };
        if (nextEntry) next[matchId] = nextEntry;
        else delete next[matchId];
        if (user) scheduleSync(matchId, nextEntry);
        else saveLocal(next);
        return next;
      });
    },
    [user, scheduleSync],
  );

  function editable(matchId: string): boolean {
    const match = enriched.find((m) => m.id === matchId);
    if (!match || !isPlayable(match)) return false;
    return Date.parse(match.kickoff) > now;
  }

  function chooseWinner(matchId: string, pick: Pick) {
    if (!editable(matchId)) return;
    update(matchId, (e) => {
      // Re-pulsar el ganador elegido lo deselecciona (borra la entrada).
      if (e?.pick === pick) return null;
      const base = e ?? { pick, home: "", away: "", advance: null };
      const advance = pick === "draw" ? base.advance : null;
      return { ...base, pick, advance };
    });
  }

  function setScore(matchId: string, side: "home" | "away", value: string) {
    if (!editable(matchId)) return;
    const v = value.replace(/[^0-9]/g, "").slice(0, 2);
    update(matchId, (e) => {
      if (!e) return null; // hay que elegir ganador primero
      return { ...e, [side]: v };
    });
  }

  function setAdvance(matchId: string, who: "home" | "away") {
    if (!editable(matchId)) return;
    update(matchId, (e) => (e ? { ...e, advance: who } : null));
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

  const playable = enriched.filter(isPlayable);
  const completed = playable.filter((m) => picks[m.id]).length;
  const progress = playable.length > 0 ? (completed / playable.length) * 100 : 0;
  const visibleMatches = enriched.filter((m) => phaseOf(m).key === activePhase);
  const phasePicked = (key: string) =>
    enriched.filter((m) => phaseOf(m).key === key && isPlayable(m) && picks[m.id]).length;
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
              <span className="text-muted-foreground text-sm">/ {playable.length}</span>
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
          Grupos: acierta <span className="text-foreground">quién gana</span> (1 pt).
          Eliminatorias: <span className="text-foreground">ganador</span> (1 pt) +{" "}
          <span className="text-foreground">resultado exacto</span> (3 pts).
        </p>
      </div>

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
              className={`ml-1.5 text-xs ${activePhase === p.key ? "opacity-80" : "opacity-60"}`}
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
          const e = picks[match.id];
          const pick = e?.pick ?? null;
          const result = results[match.id];
          const finished = Boolean(result && result.home !== "" && result.away !== "");
          const actual = finished
            ? winnerOf(Number(result!.home), Number(result!.away))
            : null;
          const knockout = isKnockout(match);
          const scored = finished
            ? knockout
              ? scoreKnockout(pick, e?.home ?? "", e?.away ?? "", result!)
              : pick
                ? scorePick(pick, result!)
                : null
            : null;
          const playableMatch = isPlayable(match);
          const started = Date.parse(match.kickoff) <= now;
          const locked = started || finished || !playableMatch;
          const needsAdvance = knockout && pick === "draw" && !e?.advance;

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
                  {!playableMatch && <span className="text-muted-foreground">Por definir</span>}
                  {playableMatch && locked && !finished && (
                    <span className="text-muted-foreground">🔒 Cerrado</span>
                  )}
                  <span className="font-mono">
                    <LocalTime iso={match.kickoff} />
                  </span>
                </span>
              </div>

              {/* Ganador (1 / X / 2) */}
              <div className="grid grid-cols-3 gap-2">
                <PickButton
                  selected={pick === "home"}
                  correct={actual === "home"}
                  finished={finished}
                  locked={locked}
                  onClick={() => chooseWinner(match.id, "home")}
                  flag={home?.flag}
                  label={home?.name ?? "Por definir"}
                  sub="Gana"
                />
                <PickButton
                  selected={pick === "draw"}
                  correct={actual === "draw"}
                  finished={finished}
                  locked={locked}
                  onClick={() => chooseWinner(match.id, "draw")}
                  label="Empate"
                  sub="X"
                />
                <PickButton
                  selected={pick === "away"}
                  correct={actual === "away"}
                  finished={finished}
                  locked={locked}
                  onClick={() => chooseWinner(match.id, "away")}
                  flag={away?.flag}
                  label={away?.name ?? "Por definir"}
                  sub="Gana"
                />
              </div>

              {/* Eliminatorias: marcador exacto + quién pasa si empate */}
              {knockout && playableMatch && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {home?.flag}
                    </span>
                    <ScoreInput
                      value={e?.home ?? ""}
                      disabled={locked || !pick}
                      onChange={(v) => setScore(match.id, "home", v)}
                      aria-label={`Goles de ${home?.name}`}
                    />
                    <span className="text-muted-foreground text-xs font-mono">resultado</span>
                    <ScoreInput
                      value={e?.away ?? ""}
                      disabled={locked || !pick}
                      onChange={(v) => setScore(match.id, "away", v)}
                      aria-label={`Goles de ${away?.name}`}
                    />
                    <span className="text-lg" aria-hidden>
                      {away?.flag}
                    </span>
                  </div>

                  {pick === "draw" && (
                    <div
                      className={`rounded-xl border p-2.5 ${
                        needsAdvance ? "border-amber-500/50 bg-amber-500/5" : "border-border"
                      }`}
                    >
                      <p className="text-[11px] text-center text-muted-foreground mb-2">
                        Empate: ¿quién pasa? {needsAdvance && <span className="text-amber-500">(elige)</span>}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <AdvanceButton
                          selected={e?.advance === "home"}
                          disabled={locked}
                          onClick={() => setAdvance(match.id, "home")}
                          flag={home?.flag}
                          label={home?.name ?? "Local"}
                        />
                        <AdvanceButton
                          selected={e?.advance === "away"}
                          disabled={locked}
                          onClick={() => setAdvance(match.id, "away")}
                          flag={away?.flag}
                          label={away?.name ?? "Visitante"}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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

function ScoreInput({
  value,
  disabled,
  onChange,
  ...rest
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  "aria-label"?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      disabled={disabled}
      onChange={(ev) => onChange(ev.target.value)}
      placeholder="—"
      className="w-11 h-11 text-center font-display text-xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      {...rest}
    />
  );
}

function AdvanceButton({
  selected,
  disabled,
  onClick,
  flag,
  label,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  flag?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border hover:bg-surface-muted disabled:opacity-50"
      }`}
    >
      {flag && <span aria-hidden>{flag}</span>}
      <span className="truncate">{label}</span>
    </button>
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
