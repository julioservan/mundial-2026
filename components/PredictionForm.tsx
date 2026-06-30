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
  deleteManyRemote,
  deleteRemote,
  fetchRemote,
  hasAnyPick,
  loadLocal,
  migrateLocalToRemote,
  saveAllRemote,
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
    // Las eliminatorias van primero (order 10-15) y las jornadas después en
    // orden descendente (J3, J2, J1) -> order 97, 98, 99.
    return { key: `g${md}`, label: `Jornada ${md}`, order: 100 - md };
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
  // null = sin elección manual aún (se usa la pestaña por defecto).
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
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
          kickoff: a.kickoff ?? m.kickoff,
        };
      }),
    [matches, assignments],
  );

  const isPlayable = (m: Match) => Boolean(m.homeTeamId && m.awayTeamId);
  const isKnockout = (m: Match) => m.stage !== "group";

  const phases = useMemo<Phase[]>(() => {
    const map = new Map<string, Phase>();
    for (const m of enriched) {
      if (isKnockout(m)) {
        const anyPlayable = enriched.some(
          (x) => x.stage === m.stage && isPlayable(x),
        );
        // Dieciseisavos siempre visible (es la pestaña por defecto); el resto de
        // rondas KO solo aparecen cuando ya hay cruces con equipos.
        if (m.stage !== "round32" && !anyPlayable) continue;
      }
      const p = phaseOf(m);
      map.set(p.key, p);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [enriched]);

  // Pestaña efectiva: la elegida por el usuario si sigue existiendo; si no,
  // dieciseisavos (round32) por defecto, o la primera disponible.
  const effectivePhase = useMemo(() => {
    if (activePhase && phases.some((p) => p.key === activePhase)) {
      return activePhase;
    }
    return (
      phases.find((p) => p.key === "round32")?.key ?? phases[0]?.key ?? "g1"
    );
  }, [activePhase, phases]);

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
          // NO borramos pronósticos "huérfanos": aunque un match_id no esté en el
          // calendario actual, conservamos la fila del usuario (evita pérdidas).
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

  // Lleva la vista (y un resaltado) al siguiente partido sin pronosticar,
  // saltando de jornada cuando se completa la actual. Solo en fase de grupos.
  function advanceFrom(matchId: string) {
    const canFill = (m: Match) =>
      isPlayable(m) && Date.parse(m.kickoff) > now;
    const pending = (m: Match) => m.id !== matchId && !picks[m.id];

    const inPhase = enriched
      .filter((m) => phaseOf(m).key === effectivePhase)
      .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
      .filter(canFill);
    const idx = inPhase.findIndex((m) => m.id === matchId);
    let next =
      inPhase.slice(idx + 1).find(pending) ?? inPhase.find(pending) ?? null;

    if (!next) {
      // Jornada completa -> primera siguiente fase con partidos por rellenar.
      const pIdx = phases.findIndex((p) => p.key === effectivePhase);
      for (let i = pIdx + 1; i < phases.length; i++) {
        const cand = enriched.filter(
          (m) => phaseOf(m).key === phases[i].key && canFill(m) && !picks[m.id],
        );
        if (cand.length) {
          setActivePhase(phases[i].key);
          next = cand[0];
          break;
        }
      }
    }
    if (next) scrollHighlight(next.id);
  }

  function scrollHighlight(id: string) {
    setHighlightId(id);
    window.setTimeout(() => {
      document
        .getElementById(`pred-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 90);
    window.setTimeout(
      () => setHighlightId((cur) => (cur === id ? null : cur)),
      1400,
    );
  }

  function chooseWinner(matchId: string, pick: Pick) {
    if (!editable(matchId)) return;
    const match = enriched.find((m) => m.id === matchId);
    // Re-pulsar la opción ya elegida NO la borra (evita perder pronósticos sin
    // querer); solo se cambia eligiendo otra opción.
    if (picks[matchId]?.pick === pick) return;
    update(matchId, (e) => {
      const base = e ?? { pick, home: "", away: "", advance: null };
      const advance = pick === "draw" ? base.advance : null;
      return { ...base, pick, advance };
    });
    // Auto-avance solo en grupos (en KO aún hay que meter el resultado).
    if (match && !isKnockout(match)) advanceFrom(matchId);
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

  // Guardado manual: fuerza la subida inmediata de todos los pronósticos
  // (cancela los guardados automáticos pendientes y reescribe todo).
  async function handleSaveNow() {
    for (const t of Object.values(timersRef.current)) clearTimeout(t);
    timersRef.current = {};
    if (!user) {
      saveLocal(picks);
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      await saveAllRemote(user.id, picks);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  // Solo se pueden resetear los partidos que aún no han empezado; los ya
  // jugados quedan registrados y no se tocan.
  const resettableIds = Object.keys(picks).filter((id) => editable(id));

  async function handleReset() {
    setConfirmReset(false);
    if (resettableIds.length === 0) return;
    const next = { ...picks };
    for (const id of resettableIds) delete next[id];
    setPicks(next);
    if (user) {
      setStatus("saving");
      try {
        await deleteManyRemote(user.id, resettableIds);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    } else {
      saveLocal(next);
    }
  }

  const playable = enriched.filter(isPlayable);
  const completed = playable.filter((m) => picks[m.id]).length;
  const progress = playable.length > 0 ? (completed / playable.length) * 100 : 0;
  const visibleMatches = enriched
    .filter((m) => phaseOf(m).key === effectivePhase)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
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
              onClick={() => setConfirmReset(true)}
              disabled={resettableIds.length === 0}
              title={
                resettableIds.length === 0
                  ? "No hay pronósticos de partidos sin empezar que borrar"
                  : undefined
              }
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
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
              effectivePhase === p.key
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {p.label}
            <span
              className={`ml-1.5 text-xs ${effectivePhase === p.key ? "opacity-80" : "opacity-60"}`}
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
              id={`pred-${match.id}`}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-all scroll-mt-40 ${
                highlightId === match.id
                  ? "border-accent ring-2 ring-accent/40"
                  : pick && !finished
                    ? "border-accent/60"
                    : "border-border"
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

      {confirmReset && (
        <ResetConfirm
          count={resettableIds.length}
          remote={Boolean(user)}
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}

      {/* Barra flotante: guardado manual inmediato (refuerza el automático) */}
      {completed > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-surface/95 backdrop-blur border border-border shadow-xl rounded-full pl-4 pr-2 py-2">
            <span className="text-xs text-muted-foreground">
              {status === "saving" ? (
                "Guardando…"
              ) : status === "error" ? (
                <span className="text-pink font-medium">Error al guardar</span>
              ) : (
                <>
                  <span className="text-foreground font-semibold">{completed}</span>{" "}
                  guardado{completed === 1 ? "" : "s"}
                </>
              )}
            </span>
            <button
              onClick={handleSaveNow}
              disabled={status === "saving"}
              className="px-4 py-1.5 rounded-full text-sm font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Guardar ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Confirmación explícita antes de borrar TODOS los pronósticos.
function ResetConfirm({
  count,
  remote,
  onCancel,
  onConfirm,
}: {
  count: number;
  remote: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-title"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reset-title" className="text-lg font-bold tracking-tight mb-2">
          ¿Resetear tus pronósticos?
        </h3>
        <p className="text-sm text-muted-foreground mb-1">
          Se eliminarán tus{" "}
          <span className="font-semibold text-foreground">
            {count} pronóstico{count === 1 ? "" : "s"}
          </span>{" "}
          de partidos que{" "}
          <span className="text-foreground">aún no han empezado</span>.
        </p>
        <p className="text-sm text-muted-foreground mb-1">
          Los de partidos <span className="text-foreground">ya jugados</span> se
          conservan: quedan registrados y no se pueden borrar.
        </p>
        <p className="text-sm text-pink font-medium mb-4">
          Esta acción no se puede deshacer.
          {!remote && " (Se borran de este navegador.)"}
        </p>
        <label className="flex items-start gap-2 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-pink"
          />
          <span className="text-sm text-foreground">
            Confirmo que soy retrasado y que quiero resetear mis {count}{" "}
            pronóstico{count === 1 ? "" : "s"}.
          </span>
        </label>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-surface-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-pink text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Sí, que sea lo que Dios quiera
          </button>
        </div>
      </div>
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
