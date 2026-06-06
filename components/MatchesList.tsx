import { MatchCard } from "@/components/MatchCard";
import { formatMatchDate, stageLabel } from "@/lib/utils/format";
import type { Match } from "@/types";

function groupByDate(matches: Match[]) {
  const grouped = new Map<string, Match[]>();
  for (const match of matches) {
    const date = match.kickoff.slice(0, 10);
    const list = grouped.get(date) ?? [];
    list.push(match);
    grouped.set(date, list);
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
}

interface Props {
  matches: Match[];
}

export function MatchesList({ matches }: Props) {
  const groupStage = matches.filter((m) => m.stage === "group");
  const knockouts = matches.filter((m) => m.stage !== "group");
  const byDate = groupByDate(groupStage);

  return (
    <div>
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-6">Fase de grupos</h2>
        <div className="space-y-8">
          {byDate.map(([date, dayMatches]) => (
            <div key={date}>
              <div className="sticky top-16 bg-background/95 backdrop-blur py-2 mb-3 z-10">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatMatchDate(date + "T12:00:00Z")}
                </h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dayMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-6">Eliminatorias</h2>
        <div className="space-y-6">
          {(
            [
              "round32",
              "round16",
              "quarterfinal",
              "semifinal",
              "third_place",
              "final",
            ] as const
          ).map((stage) => {
            const stageMatches = knockouts.filter((m) => m.stage === stage);
            if (stageMatches.length === 0) return null;
            return (
              <div key={stage}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {stageLabel(stage)}
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stageMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
