import Link from "next/link";
import type { Match, MatchStage } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { formatMatchDate, formatMatchTime, stageLabel } from "@/lib/utils/format";

interface Props {
  match: Match;
  href?: string;
}

const STAGE_STRIPE: Record<MatchStage, string> = {
  group: "bg-accent",
  round32: "bg-cyan",
  round16: "bg-violet",
  quarterfinal: "bg-pink",
  semifinal: "bg-amber",
  third_place: "bg-amber",
  final: "bg-accent",
};

export function MatchCard({ match, href }: Props) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  const stripe = STAGE_STRIPE[match.stage];

  const body = (
    <div className="relative bg-surface border border-border hover:border-border-strong rounded-xl overflow-hidden transition-all hover:translate-y-[-2px]">
      <div className={`absolute top-0 left-0 w-1 h-full ${stripe}`} aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
          <span className="font-semibold">
            {match.group ? `Grupo ${match.group}` : stageLabel(match.stage)}
            {match.matchday ? ` · J${match.matchday}` : ""}
          </span>
          <span className="font-mono">
            {formatMatchDate(match.kickoff)} · {formatMatchTime(match.kickoff)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none" aria-hidden>
              {home?.flag ?? "❓"}
            </span>
            <span className="font-semibold tracking-tight truncate flex-1">
              {home?.name ?? "Por definir"}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums w-5 text-right">
              {match.homeScore ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none" aria-hidden>
              {away?.flag ?? "❓"}
            </span>
            <span className="font-semibold tracking-tight truncate flex-1">
              {away?.name ?? "Por definir"}
            </span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums w-5 text-right">
              {match.awayScore ?? "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{match.venue.stadium}</span>
          <span className="font-mono text-muted-foreground/70 shrink-0 ml-2">
            {match.venue.city}
          </span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
