"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/types";
import { MatchesList } from "@/components/MatchesList";
import { MatchesCalendar } from "@/components/MatchesCalendar";
import { fetchResults, type ResultMap } from "@/lib/results";

type View = "list" | "calendar";

interface Props {
  matches: Match[];
}

export type ScorersMap = Record<string, { home: string[]; away: string[] }>;

export function MatchesView({ matches }: Props) {
  const [view, setView] = useState<View>("list");
  const [results, setResults] = useState<ResultMap>({});
  const [scorers, setScorers] = useState<ScorersMap>({});

  useEffect(() => {
    let active = true;
    fetchResults()
      .then((r) => {
        if (active) setResults(r);
      })
      .catch(() => {});
    // Goleadores (y marcador en vivo) desde la API.
    fetch("/api/live")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const map: ScorersMap = {};
        for (const m of data.matches ?? []) {
          if (m.homeScorers?.length || m.awayScorers?.length) {
            map[m.matchId] = {
              home: m.homeScorers ?? [],
              away: m.awayScorers ?? [],
            };
          }
        }
        setScorers(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <div className="flex justify-end mb-6">
        <div
          role="tablist"
          aria-label="Cambiar vista"
          className="inline-flex bg-surface-muted border border-border rounded-md p-1"
        >
          <button
            role="tab"
            aria-selected={view === "list"}
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              view === "list"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <ListIcon />
              Lista
            </span>
          </button>
          <button
            role="tab"
            aria-selected={view === "calendar"}
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              view === "calendar"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon />
              Calendario
            </span>
          </button>
        </div>
      </div>

      {view === "list" ? (
        <MatchesList matches={matches} results={results} scorers={scorers} />
      ) : (
        <MatchesCalendar matches={matches} results={results} scorers={scorers} />
      )}
    </div>
  );
}

function ListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
