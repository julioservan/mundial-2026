"use client";

import { useEffect, useState } from "react";
import { GROUPS, getTeam } from "@/lib/data/teams";
import { fetchResults, type ResultMap } from "@/lib/results";
import { computeGroupStandings } from "@/lib/standings";

const GROUP_TINTS = [
  "from-accent/10",
  "from-cyan/10",
  "from-pink/10",
  "from-violet/10",
  "from-amber/10",
];
const GROUP_ACCENTS = [
  "text-accent",
  "text-cyan",
  "text-pink",
  "text-violet",
  "text-amber",
];

export function GroupsStandings() {
  const [results, setResults] = useState<ResultMap>({});

  useEffect(() => {
    let active = true;
    fetchResults()
      .then((r) => {
        if (active) setResults(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {GROUPS.map((group, idx) => {
        const tint = GROUP_TINTS[idx % GROUP_TINTS.length];
        const accent = GROUP_ACCENTS[idx % GROUP_ACCENTS.length];
        const standings = computeGroupStandings(group, results);

        return (
          <div
            key={group}
            className={`bg-gradient-to-b ${tint} to-surface border border-border rounded-2xl overflow-hidden`}
          >
            <div className="px-5 py-4 flex items-baseline justify-between border-b border-border">
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Grupo
                </span>
                <span className={`font-display text-4xl ${accent}`}>{group}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Clasificación
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium"></th>
                  <th className="text-center px-1 py-2 font-medium w-7">PJ</th>
                  <th className="text-center px-1 py-2 font-medium w-7">DG</th>
                  <th className="text-right px-4 py-2 font-medium w-10">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, pos) => {
                  const team = getTeam(s.teamId);
                  // Los 2 primeros clasifican directos.
                  const top2 = pos < 2;
                  return (
                    <tr
                      key={s.teamId}
                      className={`border-t border-border/60 ${
                        top2 ? "bg-accent-soft/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground/60 tabular-nums w-3 text-xs">
                            {pos + 1}
                          </span>
                          <span className="text-lg" aria-hidden>
                            {team?.flag}
                          </span>
                          <span className="font-semibold tracking-tight truncate">
                            {team?.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-center text-muted-foreground tabular-nums">
                        {s.played}
                      </td>
                      <td className="text-center text-muted-foreground tabular-nums">
                        {s.gd > 0 ? `+${s.gd}` : s.gd}
                      </td>
                      <td className="text-right px-4 font-bold tabular-nums">
                        {s.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
