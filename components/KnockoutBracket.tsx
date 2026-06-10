import type { Match, MatchStage } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";

interface Props {
  matches: Match[];
}

const STAGE_ORDER: MatchStage[] = [
  "round32",
  "round16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

const STAGE_ACCENT: Record<MatchStage, string> = {
  group: "border-border",
  round32: "border-blue-500/40 from-blue-500/5",
  round16: "border-indigo-500/40 from-indigo-500/5",
  quarterfinal: "border-purple-500/40 from-purple-500/5",
  semifinal: "border-pink-500/40 from-pink-500/5",
  third_place: "border-amber-500/40 from-amber-500/5",
  final: "border-yellow-500/50 from-yellow-500/10",
};

function MatchCardBracket({ match }: { match: Match }) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  const accent = STAGE_ACCENT[match.stage];

  return (
    <div
      className={`bg-gradient-to-b to-surface border ${accent} rounded-lg p-3 min-w-[220px]`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 flex justify-between">
        <span>
          <LocalTime iso={match.kickoff} />
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg" aria-hidden>
            {home?.flag ?? "❔"}
          </span>
          <span className="flex-1 font-medium truncate">
            {home?.name ?? "Por definir"}
          </span>
          <span className="font-mono text-muted-foreground text-xs w-4 text-right">
            {match.homeScore ?? "–"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg" aria-hidden>
            {away?.flag ?? "❔"}
          </span>
          <span className="flex-1 font-medium truncate">
            {away?.name ?? "Por definir"}
          </span>
          <span className="font-mono text-muted-foreground text-xs w-4 text-right">
            {match.awayScore ?? "–"}
          </span>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground truncate">
        📍 {match.venue.city}
      </div>
    </div>
  );
}

export function KnockoutBracket({ matches }: Props) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <div className="flex gap-4 min-w-max pb-4">
        {STAGE_ORDER.map((stage) => {
          const stageMatches = matches.filter((m) => m.stage === stage);
          if (stageMatches.length === 0) return null;

          return (
            <div key={stage} className="flex flex-col">
              <div className="mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {stageLabel(stage)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stageMatches.length} partido{stageMatches.length > 1 ? "s" : ""}
                </p>
              </div>
              <div
                className="flex-1 flex flex-col justify-around gap-3"
                style={{ minHeight: "100%" }}
              >
                {stageMatches.map((m) => (
                  <MatchCardBracket key={m.id} match={m} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
