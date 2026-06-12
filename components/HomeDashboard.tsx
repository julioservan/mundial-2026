"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/supabase/auth";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchLeaderboard, type LiveLeaderboardEntry } from "@/lib/leaderboard";

// Ventana en la que consideramos un partido "en juego" desde su inicio.
const LIVE_MS = 135 * 60 * 1000; // 2h15m
const PLAYABLE = MATCHES.filter((m) => m.homeTeamId && m.awayTeamId);
const MEDAL = ["text-accent", "text-cyan", "text-pink"];

export function HomeDashboard() {
  const { user, profile } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [results, setResults] = useState<ResultMap>({});
  const [board, setBoard] = useState<LiveLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [r, b] = await Promise.all([fetchResults(), fetchLeaderboard()]);
        if (active) {
          setResults(r);
          setBoard(b);
        }
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

  const upcoming = PLAYABLE.filter((m) => Date.parse(m.kickoff) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
    .slice(0, 4);

  const myIndex = board.findIndex((e) => e.userId === user?.id);
  const top = board.slice(0, 5);

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

      {/* Partidos jugándose ahora */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-pink animate-pulse" aria-hidden />
          <h2 className="text-xl font-bold tracking-tight">Jugándose ahora</h2>
        </div>

        {live.length > 0 ? (
          <ul className="space-y-3">
            {live.map((m) => (
              <MatchRow key={m.id} matchId={m.id} live />
            ))}
          </ul>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            No hay partidos en juego ahora mismo.
            {upcoming.length > 0 && (
              <span className="block mt-1">Estos son los próximos:</span>
            )}
          </div>
        )}

        {live.length === 0 && upcoming.length > 0 && (
          <ul className="space-y-3 mt-3">
            {upcoming.map((m) => (
              <MatchRow key={m.id} matchId={m.id} />
            ))}
          </ul>
        )}
      </section>

      {/* Resultado de la gente: ranking */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Clasificación</h2>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            Ver completa →
          </Link>
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

function MatchRow({ matchId, live }: { matchId: string; live?: boolean }) {
  const match = MATCHES.find((m) => m.id === matchId)!;
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);

  return (
    <li className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-1 flex items-center justify-end gap-2 text-sm font-semibold tracking-tight min-w-0">
        <span className="truncate text-right">{home?.name}</span>
        <span className="text-xl shrink-0" aria-hidden>
          {home?.flag}
        </span>
      </div>
      <div className="shrink-0 text-center px-2">
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
      </div>
      <div className="flex-1 flex items-center gap-2 text-sm font-semibold tracking-tight min-w-0">
        <span className="text-xl shrink-0" aria-hidden>
          {away?.flag}
        </span>
        <span className="truncate">{away?.name}</span>
      </div>
    </li>
  );
}
