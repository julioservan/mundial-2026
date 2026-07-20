"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";
import { formatMatchTime } from "@/lib/utils/format";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/supabase/auth";
import { getSupabase } from "@/lib/supabase/client";
import { deviceTimezone } from "@/lib/timezones";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchFixtures, type FixtureSnapshot } from "@/lib/fixtures";
import { fetchLeaderboard, type LiveLeaderboardEntry } from "@/lib/leaderboard";
import type { Pick } from "@/lib/scoring";
import { PeoplePicksCompact, type VoterPick } from "@/components/PeoplePicks";
import { ChampionsFinale, type FinalSummary } from "@/components/ChampionsFinale";
import { actualWinnerOf } from "@/lib/bracket";
import { KNOCKOUT_SLOTS } from "@/lib/data/matches";

// Ventana en la que consideramos un partido "en juego" desde su inicio.
const LIVE_MS = 135 * 60 * 1000; // 2h15m
const MEDAL = ["text-accent", "text-cyan", "text-pink"];

interface PlayerLite {
  username: string;
  avatar_url: string | null;
}
type PicksByMatch = Record<string, VoterPick[]>;

export function HomeDashboard() {
  const { user, profile } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [results, setResults] = useState<ResultMap>({});
  const [board, setBoard] = useState<LiveLeaderboardEntry[]>([]);
  const [picksByMatch, setPicksByMatch] = useState<PicksByMatch>({});
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [fixtures, setFixtures] = useState<Record<string, FixtureSnapshot>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Snapshot de partidos (equipos reales de eliminatoria + marcador en vivo),
  // refrescado cada 30 s desde el feed sincronizado.
  useEffect(() => {
    let active = true;
    const loadLive = () =>
      fetchFixtures()
        .then((f) => active && setFixtures(f))
        .catch(() => {});
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
        const [r, b, profsRes] = await Promise.all([
          fetchResults(),
          fetchLeaderboard(),
          supabase.from("mundial_profiles").select("id, username, avatar_url"),
        ]);
        if (!active) return;
        setResults(r);
        setBoard(b);

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

  // Rellena equipos y kickoff reales de eliminatoria desde el feed.
  const enriched = useMemo<Match[]>(
    () =>
      MATCHES.map((m) => {
        if (m.stage === "group") return m;
        const fx = fixtures[m.id];
        if (!fx) return m;
        return {
          ...m,
          homeTeamId: fx.homeTeamId ?? m.homeTeamId,
          awayTeamId: fx.awayTeamId ?? m.awayTeamId,
          kickoff: fx.kickoff ?? m.kickoff,
        };
      }),
    [fixtures],
  );
  const matchById = useMemo(() => {
    const map: Record<string, Match> = {};
    for (const m of enriched) map[m.id] = m;
    return map;
  }, [enriched]);

  // Marcador (en vivo o final) derivado del feed.
  const liveScores = useMemo(() => {
    const map: Record<
      string,
      { home: number; away: number; live: boolean; finished: boolean }
    > = {};
    for (const [id, fx] of Object.entries(fixtures)) {
      const hasScore = fx.homeScore != null && fx.awayScore != null;
      if (fx.status === "finished") {
        if (hasScore) {
          map[id] = {
            home: fx.homeScore as number,
            away: fx.awayScore as number,
            live: false,
            finished: true,
          };
        }
      } else if (fx.status === "live" || hasScore) {
        // En juego (o ya con goles aunque el estado venga atrasado):
        // mostramos el marcador (0-0 si aún no hay goles).
        map[id] = {
          home: fx.homeScore ?? 0,
          away: fx.awayScore ?? 0,
          live: true,
          finished: false,
        };
      }
    }
    return map;
  }, [fixtures]);

  const isFinished = (id: string) => {
    const r = results[id];
    return (
      Boolean(r && r.home !== "" && r.away !== "") ||
      fixtures[id]?.status === "finished"
    );
  };

  // Partidos con equipos definidos (grupos siempre; eliminatoria cuando el
  // feed ya ha asignado los rivales).
  const playable = enriched.filter((m) => m.homeTeamId && m.awayTeamId);

  // En juego: marcado "live" por el feed, o dentro de la ventana de inicio.
  const live = playable.filter((m) => {
    if (fixtures[m.id]?.status === "live") return true;
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

  const liveIds = new Set(live.map((m) => m.id));
  const allUpcoming = playable
    .filter((m) => !liveIds.has(m.id) && !isFinished(m.id) && Date.parse(m.kickoff) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const nextDay = allUpcoming.length > 0 ? dayOf(allUpcoming[0].kickoff) : null;
  const nextOfDay = nextDay
    ? allUpcoming.filter((m) => dayOf(m.kickoff) === nextDay)
    : [];

  const myIndex = board.findIndex((e) => e.userId === user?.id);
  const top = board.slice(0, 5);

  // ¿Se acabó el Mundial? Con la final terminada y campeón conocido, la home
  // entera pasa al modo celebración (ChampionsFinale).
  const finale = useMemo<{
    champion: string;
    runnerUp: string | null;
    third: string | null;
    final: FinalSummary;
  } | null>(() => {
    const decideKO = (id: string): string | null => {
      const fx = fixtures[id];
      if (!fx || fx.status !== "finished") return null;
      const r = results[id];
      const numeric =
        r && r.home !== "" && r.away !== ""
          ? { home: Number(r.home), away: Number(r.away) }
          : undefined;
      return actualWinnerOf(
        {
          homeTeamId: fx.homeTeamId,
          awayTeamId: fx.awayTeamId,
          status: fx.status,
          homeScore: fx.homeScore,
          awayScore: fx.awayScore,
          penHome: fx.penHome,
          penAway: fx.penAway,
        },
        numeric,
      );
    };

    const finalId = KNOCKOUT_SLOTS.final;
    const champion = finalId ? decideKO(finalId) : null;
    if (!champion) return null;
    const fx = fixtures[finalId];
    const r = results[finalId];
    return {
      champion,
      runnerUp:
        champion === fx.homeTeamId ? fx.awayTeamId : fx.homeTeamId,
      third: KNOCKOUT_SLOTS.third_place
        ? decideKO(KNOCKOUT_SLOTS.third_place)
        : null,
      final: {
        homeTeamId: fx.homeTeamId,
        awayTeamId: fx.awayTeamId,
        homeScore: fx.homeScore,
        awayScore: fx.awayScore,
        r90Home: r && r.home !== "" ? Number(r.home) : null,
        r90Away: r && r.away !== "" ? Number(r.away) : null,
        penHome: fx.penHome,
        penAway: fx.penAway,
      },
    };
  }, [fixtures, results]);

  // Pronósticos SOLO de los partidos que se muestran. Ojo: pedir la tabla
  // entera (como antes) choca con el tope de 1000 filas por consulta de
  // Supabase y deja fuera los pronósticos de los partidos visibles.
  const shownKey = [...live, ...nextOfDay]
    .map((m) => m.id)
    .sort()
    .join(",");
  useEffect(() => {
    // Sin partidos visibles no hay nada que pedir (ni que pintar).
    if (!shownKey) return;
    let active = true;
    getSupabase()
      .from("mundial_predictions")
      .select("user_id, match_id, pick, home_score, away_score, advance")
      .in("match_id", shownKey.split(","))
      .then(({ data }) => {
        if (!active) return;
        const byMatch: PicksByMatch = {};
        for (const row of data ?? []) {
          if (!row.pick) continue;
          const id = row.match_id as string;
          (byMatch[id] ??= []).push({
            userId: row.user_id as string,
            pick: row.pick as Pick,
            home: row.home_score != null ? String(row.home_score) : "",
            away: row.away_score != null ? String(row.away_score) : "",
            advance: (row.advance as "home" | "away" | null) ?? null,
          });
        }
        setPicksByMatch(byMatch);
      });
    return () => {
      active = false;
    };
  }, [shownKey]);

  function renderMatch(matchId: string, isLive: boolean) {
    const match = matchById[matchId];
    if (!match) return null;
    return (
      <MatchRow
        key={matchId}
        match={match}
        live={isLive}
        score={liveScores[matchId]}
        entries={picksByMatch[matchId] ?? []}
        players={players}
        meId={user?.id ?? null}
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
            {finale ? (
              // Mundial terminado: en pasado, con guiño según el puesto.
              <>
                Has quedado{" "}
                <span className="text-foreground font-semibold">
                  #{myIndex + 1}
                </span>{" "}
                en el ranking final con{" "}
                <span className="text-foreground font-semibold">
                  {board[myIndex].points}
                </span>{" "}
                puntos.
                {myIndex === 0
                  ? " 👑 ¡Campeón de pronósticos!"
                  : myIndex <= 2
                    ? " 🏅 ¡Podio!"
                    : " El próximo Mundial es el bueno."}
              </>
            ) : (
              <>
                Vas{" "}
                <span className="text-foreground font-semibold">
                  #{myIndex + 1}
                </span>{" "}
                en el ranking con{" "}
                <span className="text-foreground font-semibold">
                  {board[myIndex].points}
                </span>{" "}
                puntos.
              </>
            )}
          </p>
        )}
      </header>

      {finale ? (
        <ChampionsFinale
          champion={finale.champion}
          runnerUp={finale.runnerUp}
          third={finale.third}
          final={finale.final}
          board={board}
          meId={user?.id ?? null}
        />
      ) : (
        <>
      {live.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-pink animate-pulse" aria-hidden />
            <h2 className="text-xl font-bold tracking-tight">Jugándose ahora</h2>
          </div>
          <ul className="space-y-3">{live.map((m) => renderMatch(m.id, true))}</ul>
        </section>
      )}

      <section className="mb-10">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold tracking-tight">Próximos partidos</h2>
          {nextOfDay.length > 0 && (
            <span className="text-sm text-muted-foreground">
              <LocalTime iso={nextOfDay[0].kickoff} mode="date" />
            </span>
          )}
        </div>

        {nextOfDay.length > 0 ? (
          <ul className="space-y-3">
            {nextOfDay.map((m) => renderMatch(m.id, false))}
          </ul>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-5 text-sm text-muted-foreground">
            {live.length > 0
              ? "No hay más partidos programados hoy."
              : "No hay más partidos programados."}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Clasificación</h2>
          <Link
            href="/leaderboard"
            className="text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            Ranking →
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
        </>
      )}
    </div>
  );
}

function MatchRow({
  match,
  live,
  score,
  entries,
  players,
  meId,
}: {
  match: Match;
  live?: boolean;
  score?: { home: number; away: number; live: boolean; finished: boolean };
  entries: VoterPick[];
  players: Record<string, PlayerLite>;
  meId: string | null;
}) {
  const matchId = match.id;
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);

  return (
    <li className="bg-surface border border-border rounded-2xl overflow-hidden">
      <Link
        href={`/matches/${matchId}`}
        className="block p-4 hover:bg-surface-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 flex items-center justify-end gap-2 text-sm font-semibold tracking-tight min-w-0">
          <span className="line-clamp-2 leading-tight text-right">{home?.name}</span>
          <span className="text-xl shrink-0" aria-hidden>
            {home?.flag}
          </span>
        </div>
        <div className="shrink-0 text-center px-1 sm:px-2">
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
                  {/* Móvil: solo la hora (ahorra ancho). Escritorio: con huso. */}
                  <span className="sm:hidden">
                    <LocalTime iso={match.kickoff} mode="time" showZone={false} />
                  </span>
                  <span className="hidden sm:inline">
                    <LocalTime iso={match.kickoff} mode="time" />
                  </span>
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
          <span className="line-clamp-2 leading-tight">{away?.name}</span>
        </div>
        </div>

        {/* Sede: estadio + hora local del estadio + ciudad corta */}
        {!score && (
          <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <span className="truncate">🏟 {match.venue.stadium}</span>
            <span aria-hidden>·</span>
            <span className="font-mono whitespace-nowrap">
              {formatMatchTime(match.kickoff, match.venue.tz)} {match.venue.short}
            </span>
          </div>
        )}

      {/* Pronósticos de la gente para este partido (reparto + votantes) */}
      <div className="mt-3 pt-3 border-t border-border/60">
        <PeoplePicksCompact
          picks={entries}
          players={players}
          meId={meId}
          home={home ?? null}
          away={away ?? null}
          knockout={match.stage !== "group"}
        />
      </div>
      </Link>
    </li>
  );
}
