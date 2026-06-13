import Link from "next/link";
import type { Match, MatchStage } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { stageLabel } from "@/lib/utils/format";
import { LocalTime } from "@/components/LocalTime";

interface Props {
  match: Match;
  href?: string;
  result?: { home: string; away: string } | null;
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

export function MatchCard({ match, href, result }: Props) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  const stripe = STAGE_STRIPE[match.stage];

  const finished = Boolean(result && result.home !== "" && result.away !== "");
  const homeGoals = finished ? result!.home : (match.homeScore ?? "—");
  const awayGoals = finished ? result!.away : (match.awayScore ?? "—");
  const homeWon = finished && Number(result!.home) > Number(result!.away);
  const awayWon = finished && Number(result!.away) > Number(result!.home);

  const body = (
    <div
      className={`relative bg-surface border rounded-xl overflow-hidden transition-all hover:translate-y-[-2px] ${
        finished
          ? "border-accent/50 shadow-[0_0_0_1px] shadow-accent/10"
          : "border-border hover:border-border-strong"
      }`}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${stripe}`} aria-hidden />
      <div className="p-4 pl-5">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4">
          <span className="font-semibold">
            {match.group ? `Grupo ${match.group}` : stageLabel(match.stage)}
            {match.matchday ? ` · J${match.matchday}` : ""}
          </span>
          {finished ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-accent bg-accent-soft border border-accent/30 rounded-full px-2 py-0.5">
              ● Final
            </span>
          ) : (
            <span className="font-mono">
              <LocalTime iso={match.kickoff} />
            </span>
          )}
        </div>

        {finished ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <div className="flex-1 min-w-0 text-right">
              <div className="text-3xl leading-none" aria-hidden>
                {home?.flag ?? "❓"}
              </div>
              <div
                className={`text-xs tracking-tight truncate mt-1 ${
                  homeWon ? "font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                {home?.name ?? "Por definir"}
              </div>
            </div>
            <div className="shrink-0 font-display leading-none flex items-end gap-1 px-1">
              <span className={homeWon ? "text-accent text-5xl" : "text-foreground/80 text-4xl"}>
                {homeGoals}
              </span>
              <span className="text-2xl text-muted-foreground/50 pb-1">–</span>
              <span className={awayWon ? "text-accent text-5xl" : "text-foreground/80 text-4xl"}>
                {awayGoals}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-3xl leading-none" aria-hidden>
                {away?.flag ?? "❓"}
              </div>
              <div
                className={`text-xs tracking-tight truncate mt-1 ${
                  awayWon ? "font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                {away?.name ?? "Por definir"}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                {home?.flag ?? "❓"}
              </span>
              <span className="font-semibold tracking-tight truncate flex-1">
                {home?.name ?? "Por definir"}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums w-5 text-right">
                {homeGoals}
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
                {awayGoals}
              </span>
            </div>
          </div>
        )}

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
