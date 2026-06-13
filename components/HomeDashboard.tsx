"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";
import { deviceTimezone } from "@/lib/timezones";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchLeaderboard, type LiveLeaderboardEntry } from "@/lib/leaderboard";
import type { Pick } from "@/lib/scoring";

// Ventana en la que consideramos un partido "en juego" desde su inicio.
const LIVE_MS = 135 * 60 * 1000; // 2h15m
const PLAYABLE = MATCHES.filter((m) => m.homeTeamId && m.awayTeamId);
const MEDAL = ["text-accent", "text-cyan", "text-pink"];

interface PlayerLite {
  username: string;
  avatar_url: string | null;
}
type PicksByMatch = Record<string, { userId: string; pick: Pick }[]>;

export function HomeDashboard() {
  const { user, profile } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [results, setResults] = useState<ResultMap>({});
  const [board, setBoard] = useState<LiveLeaderboardEntry[]>([]);
  const [picksByMatch, setPicksByMatch] = useState<PicksByMatch>({});
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [liveScores, setLiveScores] = useState<
    Record<string, { home: number; away: number; live: boolean; finished: boolean }>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Marcadores en vivo desde la API (se refresca cada 30 s).
  useEffect(() => {
    let active = true;
    async function loadLive() {
      try {
        const res = await fetch("/api/live");
        const data = await res.json();
        if (!active) return;
        const map: Record<
          string,
          { home: number; away: number; live: boolean; finished: boolean }
        > = {};
        for (const m of data.matches ?? []) map[m.matchId] = m;
        setLiveScores(map);
      } catch {
        // sin datos en vivo, el panel sigue funcionando
      }
    }
    void loadLive();
    const t = setInterval(loadLive, 30_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabase();
        const [r, b, picksRes, profsRes] = await Promise.all([
          fetchResults(),
          fetchLeaderboard(),
          supabase.from("mundial_predictions").select("user_id, match_id, pick"),
          supabase.from("mundial_profiles").select("id, username, avatar_url"),
        ]);
        if (!active) return;
        setResults(r);
        setBoard(b);

        const byMatch: PicksByMatch = {};
        for (const row of picksRes.data ?? []) {
          if (!row.pick) continue;
          const id = row.match_id as string;
          (byMatch[id] ??= []).push({
            userId: row.user_id as string,
            pick: row.pick as Pick,
          });
        }
        setPicksByMatch(byMatch);

        const profs: Record<string, PlayerLite> = {};
        for (const p of profsRes.data ?? []) {
          profs[p.id as string] = {
            username: p.username as string,
            avatar_url: (p.avatar_url as string | null) ?? null,
          };
        }
        setPlayers(profs);
      } catch {
        // pantalla sigue usable sin datos
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const isFinished = (id: string) => {
    const r = results[id];
    return Boolean(r && r.home !== "" && r.away !== "");
  };

  const live = PLAYABLE.filter((m) => {
    const k = Date.parse(m.kickoff);
    return now >= k && now < k + LIVE_MS && !isFinished(m.id);
  });

  // Si no hay partidos en juego, todos los del próximo día con partidos.
  const tz = profile?.timezone || deviceTimezone();
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));

  const allUpcoming = PLAYABLE.filter((m) => Date.parse(m.kickoff) > now).sort(
    (a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff),
  );
  const nextDay = allUpcoming.length > 0 ? dayOf(allUpcoming[0].kickoff) : null;
  const nextOfDay = nextDay
    ? allUpcoming.filter((m) => dayOf(m.kickoff) === nextDay)
    : [];

  const myIndex = board.findIndex((e) => e.userId === user?.id);
  const top = board.slice(0, 5);

  function renderMatch(matchId: string, isLive: boolean) {
    return (
      <MatchRow
        key={matchId}
        matchId={matchId}
        live={isLive}
        score={liveScores[matchId]}
        entries={picksByMatch[matchId] ?? []}
        players={players}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-2">
          — Tu Mundial
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Hola,{" "}
          <span className="font-display text-accent">
            {profile?.username ?? "jugador"}.
          </span>
        </h1>
        {myIndex >= 0 && (
          <p className="text-muted-foreground mt-3 text-sm">
            Vas <span className="text-foreground font-semibold">#{myIndex + 1}</span>{" "}
            en el ranking con{" "}
            <span className="text-foreground font-semibold">
              {board[myIndex].points}
            </span>{" "}
            puntos.
          </p>
        )}
      </header>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-pink animate-pulse" aria-hidden />
          <h2 className="text-xl font-bold tracking-tight">Jugándose ahora</h2>
        </div>

        {live.length > 0 ? (
          <ul className="space-y-3">{live.map((m) => renderMatch(m.id, true))}</ul>
        ) : nextOfDay.length > 0 ? (
          <>
            <div className="text-sm text-muted-foreground mb-3">
              No hay partidos en juego. Los siguientes son el{" "}
              <span className="text-foreground font-semibold">
                <LocalTime iso={nextOfDay[0].kickoff} mode="date" />
              </span>
              :
            </div>
            <ul className="space-y-3">
              {nextOfDay.map((m) => renderMatch(m.id, false))}
            </ul>
          </>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            No hay más partidos programados.
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Clasificación</h2>
          <div className="flex items-center gap-4">
            <Link
              href="/players"
              className="text-sm font-semibold text-accent hover:underline underline-offset-4"
            >
              Pronósticos de la gente
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm font-semibold text-accent hover:underline underline-offset-4"
            >
              Ranking →
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando…</p>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay jugadores con puntos.
          </p>
        ) : (
          <ul className="bg-surface border border-border rounded-2xl divide-y divide-border/60 overflow-hidden">
            {top.map((e, idx) => {
              const isMe = e.userId === user?.id;
              return (
                <li key={e.userId}>
                  <Link
                    href={`/players/${e.userId}`}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      isMe ? "bg-accent-soft" : "hover:bg-surface-muted/40"
                    }`}
                  >
                    <span
                      className={`font-display text-xl w-6 text-center ${
                        MEDAL[idx] ?? "text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Avatar
                      url={e.avatarUrl}
                      name={e.username}
                      size={28}
                      className="text-xs shrink-0"
                    />
                    <span className="flex-1 font-semibold tracking-tight truncate">
                      {e.username}
                      {isMe && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                          Tú
                        </span>
                      )}
                    </span>
                    <span className="font-display text-xl text-accent tabular-nums">
                      {e.points}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MatchRow({
  matchId,
  live,
  score,
  entries,
  players,
}: {
  matchId: string;
  live?: boolean;
  score?: { home: number; away: number; live: boolean; finished: boolean };
  entries: { userId: string; pick: Pick }[];
  players: Record<string, PlayerLite>;
}) {
  const match = MATCHES.find((m) => m.id === matchId)!;
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);

  const byPick = (p: Pick) => entries.filter((e) => e.pick === p);

  return (
    <li className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center justify-end gap-2 text-sm font-semibold tracking-tight min-w-0">
          <span className="truncate text-right">{home?.name}</span>
          <span className="text-xl shrink-0" aria-hidden>
            {home?.flag}
          </span>
        </div>
        <div className="shrink-0 text-center px-2">
          {score ? (
            <>
              <span className="font-mono font-bold text-base whitespace-nowrap">
                {score.home}–{score.away}
              </span>
              <div className="text-[10px] mt-0.5">
                {score.live ? (
                  <span className="text-pink font-bold uppercase tracking-wider">
                    ● En vivo
                  </span>
                ) : score.finished ? (
                  <span className="text-muted-foreground uppercase tracking-wider">
                    Final
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {match.group ? `Grupo ${match.group}` : "Eliminatoria"}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              {live ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink">
                  ● En juego
                </span>
              ) : (
                <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                  <LocalTime iso={match.kickoff} mode="time" />
                </span>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {match.group ? `Grupo ${match.group}` : "Eliminatoria"}
              </div>
            </>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 text-sm font-semibold tracking-tight min-w-0">
          <span className="text-xl shrink-0" aria-hidden>
            {away?.flag}
          </span>
          <span className="truncate">{away?.name}</span>
        </div>
      </div>

      {/* Pronósticos de la gente para este partido */}
      <div className="mt-3 pt-3 border-t border-border/60">
        {entries.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center">
            Nadie ha pronosticado este partido todavía.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 items-start">
            <PickGroup
              label="Gana"
              flag={home?.flag}
              voters={byPick("home")}
              players={players}
            />
            <PickGroup label="Empate" voters={byPick("draw")} players={players} />
            <PickGroup
              label="Gana"
              flag={away?.flag}
              voters={byPick("away")}
              players={players}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function PickGroup({
  label,
  flag,
  voters,
  players,
}: {
  label: string;
  flag?: string;
  voters: { userId: string }[];
  players: Record<string, PlayerLite>;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
        {flag && <span aria-hidden>{flag}</span>}
        <span>{label}</span>
        <span className="text-foreground font-semibold">{voters.length}</span>
      </div>
      <div className="space-y-1">
        {voters.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        ) : (
          voters.map((v) => {
            const p = players[v.userId];
            return (
              <div
                key={v.userId}
                className="flex items-center gap-1.5 justify-center"
              >
                <Avatar
                  url={p?.avatar_url ?? null}
                  name={p?.username ?? "?"}
                  size={18}
                  className="text-[7px] shrink-0"
                />
                <span className="text-[11px] font-medium leading-tight">
                  {p?.username ?? "?"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
