"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { fetchRemote, type PredMap } from "@/lib/predictions";
import { fetchResults, type ResultMap } from "@/lib/results";
import { GROUP_MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { scorePick, winnerOf } from "@/lib/scoring";

interface PlayerProfile {
  username: string;
  avatar_url: string | null;
}

export default function PlayerPredictionsPage() {
  const params = useParams();
  const id = String(params.id);

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [picks, setPicks] = useState<PredMap>({});
  const [results, setResults] = useState<ResultMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const matchdays = useMemo(
    () =>
      Array.from(new Set(GROUP_MATCHES.map((m) => m.matchday ?? 1))).sort(
        (a, b) => a - b,
      ),
    [],
  );
  const [activeMd, setActiveMd] = useState(1);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [profRes, pk, res] = await Promise.all([
          getSupabase()
            .from("mundial_profiles")
            .select("username, avatar_url")
            .eq("id", id)
            .maybeSingle(),
          fetchRemote(id),
          fetchResults(),
        ]);
        if (!active) return;
        setProfile((profRes.data as PlayerProfile) ?? null);
        setPicks(pk);
        setResults(res);
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

  const visibleMatches = GROUP_MATCHES.filter(
    (m) => (m.matchday ?? 1) === activeMd,
  );

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
        {matchdays.map((md) => (
          <button
            key={md}
            onClick={() => setActiveMd(md)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              activeMd === md
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            Jornada {md}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visibleMatches.map((match) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          const pick = picks[match.id]?.pick ?? null;
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
              className="bg-surface border border-border rounded-2xl p-4 sm:p-5"
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3 flex justify-between gap-2 font-semibold">
                <span>
                  Grupo {match.group} · J{match.matchday}
                </span>
                <span className="font-mono">
                  <LocalTime iso={match.kickoff} />
                </span>
              </div>

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
                      {scored.points > 0 ? "Acertó +1" : "Falló"}
                    </span>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
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
