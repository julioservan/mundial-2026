"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Match } from "@/types";
import { getSupabase } from "@/lib/supabase/client";
import { fetchRemote, type PredMap } from "@/lib/predictions";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { stageLabel } from "@/lib/utils/format";
import { scorePick, scoreKnockout, winnerOf } from "@/lib/scoring";

interface PlayerProfile {
  username: string;
  avatar_url: string | null;
}

interface Phase {
  key: string;
  label: string;
  order: number; // menor = más reciente (se muestra primero)
}

// Orden de fases de más nueva a más antigua: final → … → dieciseisavos →
// jornada 3 → jornada 2 → jornada 1.
function phaseOf(m: Match): Phase {
  if (m.stage === "group") {
    const md = m.matchday ?? 1;
    return { key: `g${md}`, label: `Jornada ${md}`, order: 100 - md };
  }
  const KO: Record<string, number> = {
    final: 1,
    third_place: 2,
    semifinal: 3,
    quarterfinal: 4,
    round16: 5,
    round32: 6,
  };
  return { key: m.stage, label: stageLabel(m.stage), order: KO[m.stage] ?? 50 };
}

export default function PlayerPredictionsPage() {
  const params = useParams();
  const id = String(params.id);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [picks, setPicks] = useState<PredMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>(
    {},
  );
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [profRes, pk, res, asg] = await Promise.all([
          getSupabase()
            .from("mundial_profiles")
            .select("username, avatar_url")
            .eq("id", id)
            .maybeSingle(),
          fetchRemote(id),
          fetchResults(),
          fetchFixtureAssignments().catch(() => ({})),
        ]);
        if (!active) return;
        setProfile((profRes.data as PlayerProfile) ?? null);
        setPicks(pk);
        setResults(res);
        setAssignments(asg as Record<string, SlotAssignment>);
      } catch {
        if (active) setError("No se pudieron cargar los pronósticos.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  // Rellena equipos y hora reales de eliminatoria desde el feed.
  const enriched = useMemo<Match[]>(
    () =>
      MATCHES.map((m) => {
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
    [assignments],
  );

  const isPlayable = (m: Match) => Boolean(m.homeTeamId && m.awayTeamId);

  // Fases visibles: grupos siempre; eliminatorias solo cuando ya hay cruces.
  const phases = useMemo<Phase[]>(() => {
    const map = new Map<string, Phase>();
    for (const m of enriched) {
      if (m.stage !== "group" && !isPlayable(m)) continue;
      const p = phaseOf(m);
      map.set(p.key, p);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [enriched]);

  const effectivePhase =
    (activePhase && phases.some((p) => p.key === activePhase)
      ? activePhase
      : phases[0]?.key) ?? "g3";

  // Partidos de la fase activa, de más nuevo a más antiguo.
  const visibleMatches = enriched
    .filter((m) => phaseOf(m).key === effectivePhase)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">
          {error ?? "Jugador no encontrado."}
        </p>
        <Link
          href="/leaderboard"
          className="inline-block mt-6 text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          ← Volver al ranking
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link
        href="/leaderboard"
        className="text-sm font-semibold text-accent hover:underline underline-offset-4"
      >
        ← Ranking
      </Link>

      <header className="flex items-center gap-4 mt-3 mb-6">
        <Avatar
          url={profile.avatar_url}
          name={profile.username}
          size={56}
          className="text-xl shrink-0"
        />
        <div>
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent">
            Pronósticos de
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {profile.username}
          </h1>
        </div>
      </header>

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
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visibleMatches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            entry={picks[match.id]}
            result={results[match.id]}
            now={now}
          />
        ))}
      </ul>
    </div>
  );
}

function MatchRow({
  match,
  entry,
  result,
  now,
}: {
  match: Match;
  entry: PredMap[string] | undefined;
  result: ResultMap[string] | undefined;
  now: number;
}) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  const knockout = match.stage !== "group";
  const pick = entry?.pick ?? null;
  const finished = Boolean(result && result.home !== "" && result.away !== "");
  // El pronóstico se revela cuando el partido empieza (o termina).
  const revealed = finished || Date.parse(match.kickoff) <= now;
  const actual = finished
    ? winnerOf(Number(result!.home), Number(result!.away))
    : null;
  const scored = finished
    ? knockout
      ? scoreKnockout(pick, entry?.home ?? "", entry?.away ?? "", result!)
      : pick
        ? scorePick(pick, result!)
        : null
    : null;
  const predScore =
    knockout && entry && entry.home !== "" && entry.away !== ""
      ? `${entry.home}–${entry.away}`
      : null;

  return (
    <li className="bg-surface border border-border rounded-2xl p-4 sm:p-5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3 flex justify-between gap-2 font-semibold">
        <span>
          {knockout
            ? stageLabel(match.stage)
            : `Grupo ${match.group} · J${match.matchday}`}
        </span>
        <span className="font-mono">
          <LocalTime iso={match.kickoff} />
        </span>
      </div>

      {revealed ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <RevealChip
              label={home?.name ?? "Local"}
              flag={home?.flag}
              picked={pick === "home"}
              correct={actual === "home"}
              finished={finished}
            />
            <RevealChip
              label="Empate"
              picked={pick === "draw"}
              correct={actual === "draw"}
              finished={finished}
            />
            <RevealChip
              label={away?.name ?? "Visitante"}
              flag={away?.flag}
              picked={pick === "away"}
              correct={actual === "away"}
              finished={finished}
            />
          </div>

          {knockout && (predScore || pick) && (
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              {pick
                ? predScore
                  ? `Pronóstico: ${predScore}`
                  : "Pronóstico: solo ganador"
                : "Sin pronóstico"}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          🔒 Se revela cuando empiece el partido.
        </p>
      )}

      {finished && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            Resultado:{" "}
            <span className="font-mono text-foreground font-semibold">
              {result!.home}–{result!.away}
            </span>
          </span>
          {!pick ? (
            <span className="text-muted-foreground/70">Sin pronóstico</span>
          ) : scored ? (
            <span
              className={`font-semibold ${
                scored.points > 0 ? "text-accent" : "text-muted-foreground"
              }`}
            >
              {scored.points > 0
                ? `Acertó +${scored.points}`
                : "Falló"}
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

function RevealChip({
  label,
  flag,
  picked,
  correct,
  finished,
}: {
  label: string;
  flag?: string;
  picked: boolean;
  correct: boolean;
  finished: boolean;
}) {
  const state =
    finished && correct
      ? "border-accent bg-accent-soft"
      : picked
        ? "border-accent bg-accent text-accent-foreground"
        : "border-border opacity-50";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center min-h-[4rem] ${state}`}
    >
      {flag && (
        <span className="text-xl leading-none" aria-hidden>
          {flag}
        </span>
      )}
      <span className="text-xs font-semibold tracking-tight leading-tight line-clamp-2">
        {label}
      </span>
      {picked && (
        <span className="text-[9px] uppercase tracking-wider opacity-80">
          Su elección
        </span>
      )}
    </div>
  );
}
