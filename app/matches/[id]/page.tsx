"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { getSupabase } from "@/lib/supabase/client";
import { fetchResults } from "@/lib/results";
import { fetchProfilesLite, type ProfileLite } from "@/lib/profiles";
import { stageLabel } from "@/lib/utils/format";
import { MatchDetailView } from "@/components/MatchDetailView";
import { MatchPreview } from "@/components/MatchPreview";
import { MatchPrediction } from "@/components/MatchPrediction";
import { PlayerAvatar, initialsOf } from "@/components/PlayerAvatar";
import type { MatchDetail, MatchEvent } from "@/lib/providers";
import type { Pick } from "@/lib/scoring";

type PlayerLite = ProfileLite;

export default function MatchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const match = useMemo(() => MATCHES.find((m) => m.id === id), [id]);

  const [picks, setPicks] = useState<{ userId: string; pick: Pick }[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [result, setResult] = useState<{ home: string; away: string } | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [info, setInfo] = useState<{
    status?: string;
    kickoff?: string | null;
    home?: number | null;
    away?: number | null;
    penHome?: number | null;
    penAway?: number | null;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [goalToast, setGoalToast] = useState<string | null>(null);
  // Nº de goles visto en el último sondeo, para detectar uno nuevo en vivo.
  const prevGoalsRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // El aviso de gol se autocierra a los 6 s.
  useEffect(() => {
    if (!goalToast) return;
    const t = setTimeout(() => setGoalToast(null), 6_000);
    return () => clearTimeout(t);
  }, [goalToast]);

  // Estado del partido + marcador en vivo + cronología (refrescable en directo).
  const fetchLive = useCallback(async () => {
    const [mi, results] = await Promise.all([
      fetch(`/api/match/${id}`)
        .then((r) => r.json())
        .catch(() => null),
      fetchResults().catch(
        () => ({}) as Record<string, { home: string; away: string }>,
      ),
    ]);
    if (mi && mi.found) {
      setInfo({
        status: mi.status,
        kickoff: mi.kickoff ?? null,
        home: mi.home,
        away: mi.away,
        penHome: mi.penHome ?? null,
        penAway: mi.penAway ?? null,
        homeTeamId: mi.homeTeamId,
        awayTeamId: mi.awayTeamId,
      });
      setDetail(mi.detail ?? null);

      // Aviso de gol: si aparece un gol nuevo mientras el partido está en vivo.
      const goals = ((mi.detail?.events ?? []) as MatchEvent[]).filter(
        (e) => e.type.toLowerCase() === "goal" && e.detail !== "Missed Penalty",
      );
      const prev = prevGoalsRef.current;
      prevGoalsRef.current = goals.length;
      if (prev != null && goals.length > prev && mi.status === "live") {
        const newest = [...goals].sort(
          (a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0),
        )[goals.length - 1];
        const team = getTeam(newest.teamId);
        const who = newest.player ? newest.player : "Gol";
        setGoalToast(
          `⚽ ¡Gooool! ${who}${team ? ` · ${team.name}` : ""} (${newest.minute}')`,
        );
      }
    }
    setResult(results[id] ?? null);
  }, [id]);

  // Refresca la lista de "pronósticos de la gente" (también tras guardar el propio).
  const reloadPicks = useCallback(async () => {
    const { data } = await getSupabase()
      .from("mundial_predictions")
      .select("user_id, pick")
      .eq("match_id", id);
    setPicks(
      (data ?? [])
        .filter((r) => r.pick)
        .map((r) => ({ userId: r.user_id as string, pick: r.pick as Pick })),
    );
  }, [id]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabase();
        // Datos rápidos (pronósticos del partido + perfiles cacheados).
        const [picksRes, profs] = await Promise.all([
          supabase
            .from("mundial_predictions")
            .select("user_id, pick")
            .eq("match_id", id),
          fetchProfilesLite(),
        ]);
        if (active) {
          setPicks(
            (picksRes.data ?? [])
              .filter((r) => r.pick)
              .map((r) => ({ userId: r.user_id as string, pick: r.pick as Pick })),
          );
          setPlayers(profs);
        }
      } catch {
        // sin datos
      }
      // Ya es interactivo: el marcador en vivo y la cronología (que pueden
      // tocar la API externa) se cargan en segundo plano sin bloquear.
      if (active) setLoading(false);
      void fetchLive();
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, fetchLive]);

  // Mientras el partido esté en vivo, refresca marcador y cronología cada 30 s.
  // Sondea mientras el partido no haya terminado y ya esté (cerca de) empezado,
  // sin depender de que el estado "live" llegue a tiempo.
  useEffect(() => {
    if (!match) return;
    const finishedNow = Boolean(result && result.home !== "" && result.away !== "");
    if (finishedNow) return;
    const kickoffMs = Date.parse(info?.kickoff ?? match.kickoff);
    if (now < kickoffMs - 15 * 60_000) return;
    const t = setInterval(() => void fetchLive(), 30_000);
    return () => clearInterval(t);
  }, [match, result, info?.kickoff, now, fetchLive]);

  if (!match) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">Partido no encontrado.</p>
        <Link
          href="/matches"
          className="inline-block mt-6 text-sm font-semibold text-accent hover:underline underline-offset-4"
        >
          ← Volver al calendario
        </Link>
      </div>
    );
  }

  const homeTeamId = info?.homeTeamId ?? match.homeTeamId;
  const awayTeamId = info?.awayTeamId ?? match.awayTeamId;
  // Hora real del feed; el calendario estático de eliminatorias es placeholder.
  const kickoff = info?.kickoff ?? match.kickoff;
  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);
  const finished = Boolean(result && result.home !== "" && result.away !== "");

  // Goleadores derivados de la cronología (también respaldan el marcador).
  const goalEvents = (detail?.events ?? []).filter(
    (e) => e.type.toLowerCase() === "goal" && e.detail !== "Missed Penalty",
  );
  const homeGoals = goalEvents.filter((e) => e.teamId === homeTeamId);
  const awayGoals = goalEvents.filter((e) => e.teamId === awayTeamId);

  // Recuento de goles desde la cronología (el gol en propia suma al rival).
  let evHome = 0;
  let evAway = 0;
  for (const e of goalEvents) {
    const own = e.detail === "Own Goal";
    if ((e.teamId === homeTeamId) !== own) evHome += 1;
    else evAway += 1;
  }

  // Marcador en vivo: el mayor entre el feed (fixtures) y los goles de la
  // cronología (que llegan antes), para que el marcador y los goleadores salgan
  // a la vez. Se muestra mientras el partido no haya terminado.
  const liveHome =
    info?.home != null
      ? Math.max(info.home, evHome)
      : goalEvents.length
        ? evHome
        : null;
  const liveAway =
    info?.away != null
      ? Math.max(info.away, evAway)
      : goalEvents.length
        ? evAway
        : null;
  const hasLiveScore = liveHome != null && liveAway != null;
  const isLive = !finished && (info?.status === "live" || hasLiveScore);
  // Minuto aproximado en vivo: el del último evento (gol/tarjeta/cambio).
  const liveMinute = isLive
    ? (detail?.events ?? []).reduce(
        (m, e) => Math.max(m, e.minute + (e.extra ?? 0)),
        0,
      )
    : 0;
  const byPick = (p: Pick) => picks.filter((e) => e.pick === p);

  // Foto de cada goleador (vía valoraciones de jugadores).
  const photoById: Record<number, string> = {};
  for (const p of detail?.players ?? []) {
    if (p.id != null && p.photo) photoById[p.id] = p.photo;
  }

  // Partido con los equipos y la hora reales (eliminatoria una vez asignada).
  const enrichedMatch = { ...match, homeTeamId, awayTeamId, kickoff };
  // Cerrado para pronosticar si ya empezó/terminó o aún no hay rivales.
  const started =
    finished ||
    isLive ||
    info?.status === "finished" ||
    now >= Date.parse(kickoff);
  const predLocked = started || !homeTeamId || !awayTeamId;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Aviso flotante de gol en vivo */}
      {goalToast && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto bg-pink text-white font-semibold text-sm px-5 py-3 rounded-full shadow-xl animate-pulse">
            {goalToast}
          </div>
        </div>
      )}

      <Link
        href="/matches"
        className="text-sm font-semibold text-accent hover:underline underline-offset-4"
      >
        ← Calendario
      </Link>

      {/* Cabecera del partido */}
      <div className="bg-surface border border-border rounded-2xl p-6 mt-4 mb-8">
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-center mb-4 font-semibold">
          {match.group ? `Grupo ${match.group}` : stageLabel(match.stage)}
          {match.matchday ? ` · Jornada ${match.matchday}` : ""} ·{" "}
          <LocalTime iso={kickoff} />
        </div>
        {isLive && (
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pink animate-pulse">
              ● EN VIVO{liveMinute > 0 ? ` · ${liveMinute}'` : ""}
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <div className="flex-1 text-right min-w-0">
            <div className="text-4xl leading-none" aria-hidden>
              {home?.flag ?? "❓"}
            </div>
            <div className="font-semibold tracking-tight truncate mt-1">
              {home?.name ?? "Por definir"}
            </div>
          </div>
          <div className="shrink-0 font-display leading-none px-2 text-center">
            {finished ? (
              <span className="text-4xl text-foreground">
                {result!.home}–{result!.away}
              </span>
            ) : isLive ? (
              <span className="text-4xl text-pink">
                {liveHome ?? 0}–{liveAway ?? 0}
              </span>
            ) : (
              <span className="text-2xl text-muted-foreground">vs</span>
            )}
            {info?.penHome != null && info?.penAway != null && (
              <div className="font-sans text-xs text-muted-foreground mt-1.5">
                {info.penHome}–{info.penAway} en penales
              </div>
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-4xl leading-none" aria-hidden>
              {away?.flag ?? "❓"}
            </div>
            <div className="font-semibold tracking-tight truncate mt-1">
              {away?.name ?? "Por definir"}
            </div>
          </div>
        </div>

        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              {homeGoals.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <PlayerAvatar
                    photo={g.playerId != null ? photoById[g.playerId] : null}
                    fallback={g.player ? initialsOf(g.player) : "⚽"}
                    size={24}
                    alt={g.player ?? ""}
                  />
                  <span className="truncate font-medium">{g.player ?? "—"}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {g.minute}&apos;
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {awayGoals.map((g, i) => (
                <div key={i} className="flex items-center gap-2 flex-row-reverse">
                  <PlayerAvatar
                    photo={g.playerId != null ? photoById[g.playerId] : null}
                    fallback={g.player ? initialsOf(g.player) : "⚽"}
                    size={24}
                    alt={g.player ?? ""}
                  />
                  <span className="truncate font-medium">{g.player ?? "—"}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {g.minute}&apos;
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground mt-4">
          {match.venue.stadium} · {match.venue.city}
        </div>
      </div>

      {/* Previa: pronóstico, forma, cara a cara y bajas (antes del partido) */}
      {detail?.preview && !finished && (
        <MatchPreview
          preview={detail.preview}
          homeId={homeTeamId}
          awayId={awayTeamId}
          home={home}
          away={away}
        />
      )}

      {/* Detalle del partido: cronología, alineaciones y estadísticas */}
      {detail && (
        <MatchDetailView
          detail={detail}
          homeId={homeTeamId}
          awayId={awayTeamId}
          home={home}
          away={away}
        />
      )}

      {/* Tu pronóstico (editable si el partido no ha empezado) */}
      <MatchPrediction
        match={enrichedMatch}
        locked={predLocked}
        result={result}
        onSaved={reloadPicks}
      />

      {/* Pronósticos de la gente */}
      <h2 className="text-xl font-bold tracking-tight mb-4">
        Pronósticos de la gente
      </h2>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando…</p>
      ) : picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nadie ha pronosticado este partido todavía.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <PickColumn
            label="Gana"
            flag={home?.flag}
            voters={byPick("home")}
            players={players}
          />
          <PickColumn label="Empate" voters={byPick("draw")} players={players} />
          <PickColumn
            label="Gana"
            flag={away?.flag}
            voters={byPick("away")}
            players={players}
          />
        </div>
      )}
    </div>
  );
}

function PickColumn({
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
    <div className="bg-surface border border-border rounded-2xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
        {flag && <span aria-hidden>{flag}</span>}
        <span>{label}</span>
      </div>
      <div className="font-display text-2xl text-accent leading-none mb-2">
        {voters.length}
      </div>
      <div className="space-y-1.5">
        {voters.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        ) : (
          voters.map((v) => {
            const p = players[v.userId];
            return (
              <div key={v.userId} className="flex items-center gap-1.5 justify-center">
                <Avatar
                  url={p?.avatar_url ?? null}
                  name={p?.username ?? "?"}
                  size={18}
                  className="text-[7px] shrink-0"
                />
                <span className="text-[11px] font-medium leading-tight truncate">
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
