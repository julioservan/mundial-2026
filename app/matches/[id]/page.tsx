"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { getSupabase } from "@/lib/supabase/client";
import { fetchResults } from "@/lib/results";
import { stageLabel } from "@/lib/utils/format";
import { MatchDetailView } from "@/components/MatchDetailView";
import { MatchPrediction } from "@/components/MatchPrediction";
import type { MatchDetail } from "@/lib/providers";
import type { Pick } from "@/lib/scoring";

interface PlayerLite {
  username: string;
  avatar_url: string | null;
}

export default function MatchDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const match = useMemo(() => MATCHES.find((m) => m.id === id), [id]);

  const [picks, setPicks] = useState<{ userId: string; pick: Pick }[]>([]);
  const [players, setPlayers] = useState<Record<string, PlayerLite>>({});
  const [result, setResult] = useState<{ home: string; away: string } | null>(null);
  const [scorers, setScorers] = useState<{ home: string[]; away: string[] }>({
    home: [],
    away: [],
  });
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [info, setInfo] = useState<{
    status?: string;
    home?: number | null;
    away?: number | null;
    homeTeamId?: string | null;
    awayTeamId?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

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
        home: mi.home,
        away: mi.away,
        homeTeamId: mi.homeTeamId,
        awayTeamId: mi.awayTeamId,
      });
      setScorers({ home: mi.homeScorers ?? [], away: mi.awayScorers ?? [] });
      setDetail(mi.detail ?? null);
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
        const [picksRes, profsRes] = await Promise.all([
          supabase
            .from("mundial_predictions")
            .select("user_id, pick")
            .eq("match_id", id),
          supabase.from("mundial_profiles").select("id, username, avatar_url"),
        ]);
        if (active) {
          setPicks(
            (picksRes.data ?? [])
              .filter((r) => r.pick)
              .map((r) => ({ userId: r.user_id as string, pick: r.pick as Pick })),
          );
          const profs: Record<string, PlayerLite> = {};
          for (const p of profsRes.data ?? []) {
            profs[p.id as string] = {
              username: p.username as string,
              avatar_url: (p.avatar_url as string | null) ?? null,
            };
          }
          setPlayers(profs);
        }
      } catch {
        // sin datos
      }
      await fetchLive();
      if (active) setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, fetchLive]);

  // Mientras el partido esté en vivo, refresca marcador y cronología cada 45 s.
  useEffect(() => {
    if (info?.status !== "live") return;
    const t = setInterval(() => void fetchLive(), 45_000);
    return () => clearInterval(t);
  }, [info?.status, fetchLive]);

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
  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);
  const finished = Boolean(result && result.home !== "" && result.away !== "");
  const isLive = info?.status === "live";
  const hasLiveScore = info != null && info.home != null && info.away != null;
  const byPick = (p: Pick) => picks.filter((e) => e.pick === p);

  // Partido con los equipos reales (incluye eliminatoria una vez asignada).
  const enrichedMatch = { ...match, homeTeamId, awayTeamId };
  // Cerrado para pronosticar si ya empezó/terminó o aún no hay rivales.
  const started =
    finished ||
    isLive ||
    info?.status === "finished" ||
    now >= Date.parse(match.kickoff);
  const predLocked = started || !homeTeamId || !awayTeamId;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
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
          <LocalTime iso={match.kickoff} />
        </div>
        {isLive && (
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pink animate-pulse">
              ● EN VIVO
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
            ) : isLive && hasLiveScore ? (
              <span className="text-4xl text-pink">
                {info!.home}–{info!.away}
              </span>
            ) : (
              <span className="text-2xl text-muted-foreground">vs</span>
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

        {(scorers.home.length > 0 || scorers.away.length > 0) && (
          <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 gap-4 text-base">
            <div className="space-y-1.5">
              {scorers.home.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span aria-hidden>⚽</span>
                  <span className="truncate font-medium">{g}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-right">
              {scorers.away.map((g, i) => (
                <div key={i} className="flex items-center gap-2 justify-end">
                  <span className="truncate font-medium">{g}</span>
                  <span aria-hidden>⚽</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground mt-4">
          {match.venue.stadium} · {match.venue.city}
        </div>
      </div>

      {/* Detalle del partido: cronología, alineaciones y estadísticas */}
      {detail && (
        <MatchDetailView
          detail={detail}
          homeId={match.homeTeamId}
          awayId={match.awayTeamId}
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
