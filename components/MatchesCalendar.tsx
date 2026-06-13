"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";
import type { ResultMap } from "@/lib/results";
import {
  buildMonthGrid,
  isSameDay,
  MONTH_NAMES_ES,
  toISODate,
  WEEKDAY_LABELS_ES,
} from "@/lib/utils/calendar";

type ScorersMap = Record<string, { home: string[]; away: string[] }>;

interface Props {
  matches: Match[];
  results?: ResultMap;
  scorers?: ScorersMap;
}

const AVAILABLE_MONTHS: Array<{ year: number; month: number }> = [
  { year: 2026, month: 5 }, // June
  { year: 2026, month: 6 }, // July
];

function stageColor(stage: Match["stage"]): string {
  switch (stage) {
    case "group":
      return "bg-accent/15 text-accent border-accent/30";
    case "round32":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "round16":
      return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
    case "quarterfinal":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
    case "semifinal":
      return "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30";
    case "third_place":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "final":
      return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40";
    default:
      return "bg-surface-muted text-muted-foreground border-border";
  }
}

export function MatchesCalendar({ matches, results = {}, scorers = {} }: Props) {
  const [monthIdx, setMonthIdx] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { year, month } = AVAILABLE_MONTHS[monthIdx];

  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const date = m.kickoff.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(m);
      map.set(date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    }
    return map;
  }, [matches]);

  const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = new Date();

  const selectedMatches = selectedDate
    ? (matchesByDate.get(selectedDate) ?? [])
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">
          {MONTH_NAMES_ES[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
            disabled={monthIdx === 0}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <button
            onClick={() =>
              setMonthIdx((i) =>
                Math.min(AVAILABLE_MONTHS.length - 1, i + 1),
              )
            }
            disabled={monthIdx === AVAILABLE_MONTHS.length - 1}
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
          {WEEKDAY_LABELS_ES.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const iso = toISODate(day);
            const dayMatches = matchesByDate.get(iso) ?? [];
            const inMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);
            const isSelected = selectedDate === iso;

            return (
              <button
                key={iso + idx}
                onClick={() =>
                  setSelectedDate(isSelected || dayMatches.length === 0 ? null : iso)
                }
                disabled={dayMatches.length === 0}
                className={[
                  "min-h-24 sm:min-h-28 p-1.5 sm:p-2 border-r border-b border-border last:border-r-0 text-left transition-colors",
                  inMonth ? "" : "bg-surface-muted/30",
                  dayMatches.length > 0 ? "hover:bg-surface-muted cursor-pointer" : "cursor-default",
                  isSelected ? "ring-2 ring-accent ring-inset" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={[
                      "text-sm font-medium tabular-nums w-6 h-6 inline-flex items-center justify-center rounded-full",
                      inMonth ? "text-foreground" : "text-muted-foreground/50",
                      isToday ? "bg-accent text-accent-foreground" : "",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </span>
                  {dayMatches.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {dayMatches.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayMatches.slice(0, 2).map((m) => {
                    const home = getTeam(m.homeTeamId);
                    const away = getTeam(m.awayTeamId);
                    return (
                      <div
                        key={m.id}
                        className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded border truncate ${stageColor(
                          m.stage,
                        )}`}
                      >
                        <span className="hidden sm:inline">
                          {home?.flag ?? "?"} {home?.code ?? "?"}–
                          {away?.code ?? "?"} {away?.flag ?? "?"}
                        </span>
                        <span className="sm:hidden">
                          {home?.flag ?? "?"}{away?.flag ?? "?"}
                        </span>
                      </div>
                    );
                  })}
                  {dayMatches.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">
                      +{dayMatches.length - 2} más
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && selectedMatches.length > 0 && (
        <div className="mt-6 bg-surface border border-border rounded-lg p-4">
          <h4 className="font-semibold mb-3">
            Partidos del{" "}
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h4>
          <ul className="space-y-2">
            {selectedMatches.map((m) => {
              const home = getTeam(m.homeTeamId);
              const away = getTeam(m.awayTeamId);
              return (
                <li key={m.id} className="border-b border-border last:border-0">
                  <Link
                    href={`/matches/${m.id}`}
                    className="block py-2 hover:text-accent transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono tabular-nums w-12">
                        {results[m.id] &&
                        results[m.id].home !== "" &&
                        results[m.id].away !== "" ? (
                          <span className="font-bold text-foreground">
                            {results[m.id].home}–{results[m.id].away}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            <LocalTime iso={m.kickoff} mode="time" />
                          </span>
                        )}
                      </span>
                      <span className="flex-1 truncate">
                        {home?.flag ?? "?"} {home?.name ?? "Por definir"}{" "}
                        <span className="text-muted-foreground">vs</span>{" "}
                        {away?.name ?? "Por definir"} {away?.flag ?? "?"}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {m.group ? `Grupo ${m.group}` : stageLabel(m.stage)}
                      </span>
                    </div>
                    {scorers[m.id] &&
                      (scorers[m.id].home.length > 0 ||
                        scorers[m.id].away.length > 0) && (
                        <div className="pl-12 mt-1 text-[10px] text-muted-foreground/80 truncate">
                          ⚽{" "}
                          {[...scorers[m.id].home, ...scorers[m.id].away].join(
                            ", ",
                          )}
                        </div>
                      )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
