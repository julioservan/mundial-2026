"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match } from "@/types";
import { MATCHES } from "@/lib/data/matches";
import { MatchCard } from "@/components/MatchCard";
import { MatchesCalendar } from "@/components/MatchesCalendar";
import { formatMatchDate } from "@/lib/utils/format";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchFixtures, type FixtureSnapshot } from "@/lib/fixtures";

type Tab = "upcoming" | "past" | "calendar";

export type ScorersMap = Record<string, { home: string[]; away: string[] }>;

export function MatchesView() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [results, setResults] = useState<ResultMap>({});
  const [fixtures, setFixtures] = useState<Record<string, FixtureSnapshot>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const load = () => {
      Promise.all([fetchResults().catch(() => ({})), fetchFixtures().catch(() => ({}))])
        .then(([r, f]) => {
          if (!active) return;
          setResults(r as ResultMap);
          setFixtures(f as Record<string, FixtureSnapshot>);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(() => {
      setNow(Date.now());
      load();
    }, 30_000);
    return () => {
      active = false;
      clearInterval(t);
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

  const isFinished = (id: string) => {
    const r = results[id];
    return (
      Boolean(r && r.home !== "" && r.away !== "") ||
      fixtures[id]?.status === "finished"
    );
  };
  const isLive = (id: string) => fixtures[id]?.status === "live";

  const upcoming = enriched
    .filter((m) => !isFinished(m.id))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const past = enriched
    .filter((m) => isFinished(m.id))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  const liveCount = enriched.filter((m) => isLive(m.id)).length;

  function liveScore(id: string) {
    const fx = fixtures[id];
    if (fx?.status === "live" && fx.homeScore != null && fx.awayScore != null) {
      return { home: fx.homeScore, away: fx.awayScore };
    }
    return null;
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "upcoming", label: "Próximos", count: upcoming.length },
    { key: "past", label: "Pasados", count: past.length },
    { key: "calendar", label: "Calendario" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div
          role="tablist"
          aria-label="Vista de partidos"
          className="inline-flex bg-surface-muted border border-border rounded-lg p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                tab === t.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-pink">
            <span className="w-2 h-2 rounded-full bg-pink animate-pulse" aria-hidden />
            {liveCount} en directo
          </span>
        )}
      </div>

      {tab === "calendar" ? (
        <MatchesCalendar matches={enriched} results={results} />
      ) : (
        <GroupedByDate
          matches={tab === "upcoming" ? upcoming : past}
          descending={tab === "past"}
          results={results}
          liveScore={liveScore}
          emptyText={
            tab === "upcoming"
              ? "No hay más partidos programados."
              : "Aún no se ha jugado ningún partido."
          }
          now={now}
        />
      )}
    </div>
  );
}

function GroupedByDate({
  matches,
  descending,
  results,
  liveScore,
  emptyText,
  now,
}: {
  matches: Match[];
  descending: boolean;
  results: ResultMap;
  liveScore: (id: string) => { home: number; away: number } | null;
  emptyText: string;
  now: number;
}) {
  void now;
  if (matches.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  // Agrupa por día respetando el orden recibido.
  const groups: { date: string; items: Match[] }[] = [];
  for (const m of matches) {
    const date = m.kickoff.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(m);
    else groups.push({ date, items: [m] });
  }
  void descending;

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.date}>
          <div className="sticky top-16 bg-background/95 backdrop-blur py-2 mb-3 z-10">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {formatMatchDate(g.date + "T12:00:00Z")}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.items.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                result={results[m.id]}
                live={liveScore(m.id)}
                href={`/matches/${m.id}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
