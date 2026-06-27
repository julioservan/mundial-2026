"use client";

import { useEffect, useState } from "react";
import { getTeam } from "@/lib/data/teams";
import { fetchTopScorers } from "@/lib/fixtures";
import type { TopScorer } from "@/lib/providers";

export function TopScorers() {
  const [players, setPlayers] = useState<TopScorer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTopScorers()
      .then((d) => {
        if (!active) return;
        setPlayers(d.players);
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  if (loaded && players.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aún no hay datos de goleadores. Aparecerán en cuanto se jueguen partidos.
      </p>
    );
  }

  const max = players[0]?.goals || 1;

  return (
    <ol className="space-y-2">
      {players.map((p, i) => {
        const team = getTeam(p.teamId);
        const podium = i < 3;
        return (
          <li
            key={`${p.name}-${i}`}
            className={`flex items-center gap-3 bg-surface border rounded-2xl p-3 sm:p-4 ${
              podium ? "border-accent/50" : "border-border"
            }`}
          >
            <span
              className={`font-display text-2xl w-8 text-center shrink-0 ${
                podium ? "text-accent" : "text-muted-foreground/60"
              }`}
            >
              {i + 1}
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.photo ?? ""}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="w-10 h-10 rounded-full object-cover bg-surface-muted shrink-0"
            />

            <div className="min-w-0 flex-1">
              <div className="font-semibold tracking-tight truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span aria-hidden>{team?.flag ?? "🏳️"}</span>
                <span className="truncate">{team?.name ?? p.teamName}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-display text-2xl leading-none text-foreground">
                {p.goals}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                gol{p.goals === 1 ? "" : "es"}
                {p.assists > 0 && ` · ${p.assists} as.`}
              </div>
            </div>

            {/* Barra proporcional al máximo goleador */}
            <div className="hidden sm:block w-24 shrink-0">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(p.goals / max) * 100}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
