"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";
import { type PredEntry, upsertRemote, deleteRemote } from "@/lib/predictions";
import {
  scorePick,
  scoreKnockout,
  winnerOf,
  type Outcome,
  type Pick,
} from "@/lib/scoring";

type SyncStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  // Partido ya enriquecido con los equipos reales (incluida eliminatoria).
  match: Match;
  // El partido ya no admite cambios (empezó / terminó / sin equipos aún).
  locked: boolean;
  result?: { home: string; away: string } | null;
  // Aviso al contenedor para refrescar la lista de "pronósticos de la gente".
  onSaved?: () => void;
}

// Pronóstico propio editable desde la ficha del partido.
//   · Grupos: 1 punto por acertar el ganador (1 / X / 2).
//   · Eliminatorias: 1 punto por el ganador + 3 por clavar el resultado exacto.
export function MatchPrediction({ match, locked, result, onSaved }: Props) {
  const { user, loading: authLoading } = useAuth();
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  const knockout = match.stage !== "group";
  const playable = Boolean(match.homeTeamId && match.awayTeamId);

  const [entry, setEntry] = useState<PredEntry | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Carga el pronóstico propio de este partido (si hay sesión).
  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    getSupabase()
      .from("mundial_predictions")
      .select("pick, home_score, away_score, advance")
      .eq("user_id", user.id)
      .eq("match_id", match.id)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!active) return;
          const has =
            data &&
            (data.pick ||
              (data.home_score != null && data.away_score != null));
          if (has) {
            const pick =
              (data!.pick as Pick | null) ??
              winnerOf(data!.home_score as number, data!.away_score as number);
            setEntry({
              pick,
              home: data!.home_score != null ? String(data!.home_score) : "",
              away: data!.away_score != null ? String(data!.away_score) : "",
              advance: (data!.advance as "home" | "away" | null) ?? null,
            });
          }
          setHydrated(true);
        },
        () => active && setHydrated(true),
      );
    return () => {
      active = false;
    };
  }, [user, authLoading, match.id]);

  const save = useCallback(
    (e: PredEntry | null) => {
      if (!user) return;
      clearTimeout(timer.current);
      setStatus("saving");
      timer.current = setTimeout(async () => {
        try {
          if (e) await upsertRemote(user.id, match.id, e);
          else await deleteRemote(user.id, match.id);
          setStatus("saved");
          onSaved?.();
        } catch {
          setStatus("error");
        }
      }, 500);
    },
    [user, match.id, onSaved],
  );

  const mutate = useCallback(
    (fn: (e: PredEntry | null) => PredEntry | null) => {
      setEntry((prev) => {
        const next = fn(prev);
        save(next);
        return next;
      });
    },
    [save],
  );

  function chooseWinner(pick: Pick) {
    if (locked) return;
    // Re-pulsar la opción ya elegida NO la borra (evita perder pronósticos sin
    // querer); solo se cambia eligiendo otra opción.
    if (entry?.pick === pick) return;
    mutate((e) => {
      const base = e ?? { pick, home: "", away: "", advance: null };
      return { ...base, pick, advance: pick === "draw" ? base.advance : null };
    });
  }
  function setScore(side: "home" | "away", value: string) {
    if (locked) return;
    const v = value.replace(/[^0-9]/g, "").slice(0, 2);
    mutate((e) => (e ? { ...e, [side]: v } : e));
  }
  function setAdvance(who: "home" | "away") {
    if (locked) return;
    mutate((e) => (e ? { ...e, advance: who } : e));
  }

  const pick = entry?.pick ?? null;
  const finished = Boolean(result && result.home !== "" && result.away !== "");
  const actual = finished
    ? winnerOf(Number(result!.home), Number(result!.away))
    : null;
  const scored: { outcome: Outcome; points: number } | null =
    finished && entry
      ? knockout
        ? scoreKnockout(entry.pick, entry.home, entry.away, result!)
        : scorePick(entry.pick, result!)
      : null;
  const needsAdvance = knockout && pick === "draw" && !entry?.advance;

  const heading = (
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <h2 className="text-xl font-bold tracking-tight">Tu pronóstico</h2>
      {user && !locked && <SyncBadge status={status} />}
    </div>
  );

  // Eliminatoria sin rivales todavía.
  if (!playable) {
    return (
      <section className="mb-8">
        {heading}
        <div className="bg-surface border border-border rounded-2xl p-5 text-sm text-muted-foreground">
          Aún no se conocen los dos equipos de este cruce. Podrás pronosticarlo
          cuando se definan.
        </div>
      </section>
    );
  }

  // Sin sesión: invitamos a entrar (los pronósticos se guardan en la cuenta).
  if (!user && !authLoading) {
    return (
      <section className="mb-8">
        {heading}
        <div className="bg-accent-soft border border-accent/30 rounded-2xl px-5 py-4 text-sm flex items-center justify-between gap-4">
          <span>Inicia sesión para pronosticar este partido.</span>
          <Link
            href="/login"
            className="shrink-0 font-semibold text-accent hover:underline underline-offset-4"
          >
            Entrar →
          </Link>
        </div>
      </section>
    );
  }

  if (authLoading || !hydrated) {
    return (
      <section className="mb-8">
        {heading}
        <div className="bg-surface border border-border rounded-2xl p-5 h-28 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="mb-8">
      {heading}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
        {locked && !finished && (
          <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
            🔒 El partido ya empezó: el pronóstico está cerrado.
          </p>
        )}

        {/* Ganador (1 / X / 2) */}
        <div className="grid grid-cols-3 gap-2">
          <PickButton
            selected={pick === "home"}
            correct={actual === "home"}
            finished={finished}
            locked={locked}
            onClick={() => chooseWinner("home")}
            flag={home?.flag}
            label={home?.name ?? "Local"}
            sub="Gana"
          />
          <PickButton
            selected={pick === "draw"}
            correct={actual === "draw"}
            finished={finished}
            locked={locked}
            onClick={() => chooseWinner("draw")}
            label="Empate"
            sub="X"
          />
          <PickButton
            selected={pick === "away"}
            correct={actual === "away"}
            finished={finished}
            locked={locked}
            onClick={() => chooseWinner("away")}
            flag={away?.flag}
            label={away?.name ?? "Visitante"}
            sub="Gana"
          />
        </div>

        {/* Eliminatorias: marcador exacto + quién pasa si empate */}
        {knockout && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg" aria-hidden>
                {home?.flag}
              </span>
              <ScoreInput
                value={entry?.home ?? ""}
                disabled={locked || !pick}
                onChange={(v) => setScore("home", v)}
                aria-label={`Goles de ${home?.name}`}
              />
              <span className="text-muted-foreground text-xs font-mono">
                resultado
              </span>
              <ScoreInput
                value={entry?.away ?? ""}
                disabled={locked || !pick}
                onChange={(v) => setScore("away", v)}
                aria-label={`Goles de ${away?.name}`}
              />
              <span className="text-lg" aria-hidden>
                {away?.flag}
              </span>
            </div>

            {pick === "draw" && (
              <div
                className={`rounded-xl border p-2.5 ${
                  needsAdvance
                    ? "border-amber-500/50 bg-amber-500/5"
                    : "border-border"
                }`}
              >
                <p className="text-[11px] text-center text-muted-foreground mb-2">
                  Empate: ¿quién pasa?{" "}
                  {needsAdvance && <span className="text-amber-500">(elige)</span>}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <AdvanceButton
                    selected={entry?.advance === "home"}
                    disabled={locked}
                    onClick={() => setAdvance("home")}
                    flag={home?.flag}
                    label={home?.name ?? "Local"}
                  />
                  <AdvanceButton
                    selected={entry?.advance === "away"}
                    disabled={locked}
                    onClick={() => setAdvance("away")}
                    flag={away?.flag}
                    label={away?.name ?? "Visitante"}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resultado y puntos una vez terminado */}
        {finished && (
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              Final:{" "}
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

        {/* Recordatorio de puntuación (mientras se puede editar) */}
        {!finished && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {knockout ? (
              <>
                Eliminatoria: <span className="text-foreground">ganador</span> (1
                pt) + <span className="text-foreground">resultado exacto</span> (3
                pts).
              </>
            ) : (
              <>
                Grupos: acierta <span className="text-foreground">quién gana</span>{" "}
                (1 pt).
              </>
            )}
          </p>
        )}
      </div>
    </section>
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

function OutcomeBadge({
  outcome,
  points,
}: {
  outcome: Outcome;
  points: number;
}) {
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
