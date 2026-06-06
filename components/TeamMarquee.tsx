import { TEAMS } from "@/lib/data/teams";

export function TeamMarquee() {
  const items = [...TEAMS, ...TEAMS];

  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      <div className="flex animate-marquee py-4 whitespace-nowrap">
        {items.map((team, idx) => (
          <div
            key={`${team.id}-${idx}`}
            className="inline-flex items-center gap-2 px-5 text-sm shrink-0"
          >
            <span className="text-xl" aria-hidden>
              {team.flag}
            </span>
            <span className="font-semibold tracking-tight">{team.name}</span>
            <span className="text-muted-foreground/60 font-mono text-xs">
              {team.code}
            </span>
            <span className="text-muted-foreground/30 ml-3">/</span>
          </div>
        ))}
      </div>
    </div>
  );
}
