"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchStage } from "@/types";
import { KNOCKOUT_SLOTS, KNOCKOUT_MATCHES } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";
import { computeBracket, type BracketMatch } from "@/lib/bracket";
import { fetchResults, type ResultMap } from "@/lib/results";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";

const STAGE_ORDER: MatchStage[] = [
  "round32",
  "round16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

const STAGE_ACCENT: Record<string, string> = {
  round32: "border-blue-500/40 from-blue-500/5",
  round16: "border-indigo-500/40 from-indigo-500/5",
  quarterfinal: "border-purple-500/40 from-purple-500/5",
  semifinal: "border-pink-500/40 from-pink-500/5",
  third_place: "border-amber-500/40 from-amber-500/5",
  final: "border-yellow-500/50 from-yellow-500/10",
};

// Mapa match_id -> kickoff (de nuestro calendario) para mostrar la hora.
const KICKOFF_BY_ID: Record<string, string> = Object.fromEntries(
  KNOCKOUT_MATCHES.map((m) => [m.id, m.kickoff]),
);

function Side({
  teamId,
  fromLabel,
  score,
  pen,
  winner,
}: {
  teamId: string | null;
  fromLabel: string | null;
  score: number | null;
  /** Goles en la tanda de penales, si la hubo. */
  pen: number | null;
  winner: boolean;
}) {
  const team = getTeam(teamId);
  return (
    <div
      className={`flex items-center gap-2 text-sm ${winner ? "font-bold" : ""}`}
    >
      <span className="text-lg" aria-hidden>
        {team?.flag ?? "❔"}
      </span>
      <span className="flex-1 font-medium truncate">
        {team?.name ?? (
          <span className="text-muted-foreground italic">
            {fromLabel ?? "Por definir"}
          </span>
        )}
      </span>
      <span className="font-mono text-muted-foreground text-xs text-right">
        {score ?? "–"}
        {pen != null && <span className="text-[10px]"> ({pen})</span>}
      </span>
    </div>
  );
}

function Card({ m }: { m: BracketMatch }) {
  const accent = STAGE_ACCENT[m.stage] ?? "border-border";
  const kickoff = KICKOFF_BY_ID[m.id];
  return (
    <div
      className={`bg-gradient-to-b to-surface border ${accent} rounded-lg p-3 min-w-[220px]`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex justify-between items-center">
        {kickoff ? <LocalTime iso={kickoff} /> : <span />}
        {m.status === "live" && (
          <span className="text-pink font-bold animate-pulse">● EN VIVO</span>
        )}
        {m.projected && m.status !== "live" && (
          <span className="text-[9px] text-muted-foreground/70 border border-border rounded px-1">
            proyección
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <Side
          teamId={m.homeTeamId}
          fromLabel={m.homeFrom}
          score={m.homeScore}
          pen={m.homePen}
          winner={m.winnerTeamId != null && m.winnerTeamId === m.homeTeamId}
        />
        <Side
          teamId={m.awayTeamId}
          fromLabel={m.awayFrom}
          score={m.awayScore}
          pen={m.awayPen}
          winner={m.winnerTeamId != null && m.winnerTeamId === m.awayTeamId}
        />
      </div>
    </div>
  );
}

export function KnockoutBracketLive() {
  const [results, setResults] = useState<ResultMap>({});
  const [assignments, setAssignments] = useState<
    Record<string, SlotAssignment>
  >({});

  useEffect(() => {
    let active = true;
    Promise.all([fetchResults(), fetchFixtureAssignments()])
      .then(([r, a]) => {
        if (!active) return;
        setResults(r);
        setAssignments(a);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const bracket = useMemo(() => {
    // ResultMap (strings) -> formato numérico del motor.
    const numeric: Record<string, { home: number; away: number }> = {};
    for (const [id, r] of Object.entries(results)) {
      if (r.home === "" || r.away === "") continue;
      const h = Number(r.home);
      const a = Number(r.away);
      if (!Number.isNaN(h) && !Number.isNaN(a)) numeric[id] = { home: h, away: a };
    }
    return computeBracket({
      slots: KNOCKOUT_SLOTS,
      results: numeric,
      assignments,
    });
  }, [results, assignments]);

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <div className="flex gap-4 min-w-max pb-4">
        {STAGE_ORDER.map((stage) => {
          const stageMatches = bracket.byStage[stage] ?? [];
          if (stageMatches.length === 0) return null;
          return (
            <div key={stage} className="flex flex-col">
              <div className="mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {stageLabel(stage)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stageMatches.length} partido
                  {stageMatches.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex-1 flex flex-col justify-around gap-3">
                {stageMatches.map((m) => (
                  <Card key={m.id} m={m} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
