"use client";

import { useEffect, useState } from "react";
import { getTeam } from "@/lib/data/teams";
import { fetchResults, type ResultMap } from "@/lib/results";
import { computeThirdPlaced } from "@/lib/standings";

// Ranking de los terceros de cada grupo. Los 8 mejores avanzan a dieciseisavos.
// Es el desempate más fácil de equivocar del nuevo formato de 48 equipos.
export function ThirdPlaceTable() {
  const [results, setResults] = useState<ResultMap>({});

  useEffect(() => {
    let active = true;
    fetchResults()
      .then((r) => active && setResults(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const { ranked } = computeThirdPlaced(results);
  if (ranked.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-baseline justify-between">
        <h3 className="font-bold tracking-tight">Mejores terceros</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Avanzan los 8 primeros
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Equipo</th>
            <th className="text-center px-1 py-2 font-medium w-8">Gr</th>
            <th className="text-center px-1 py-2 font-medium w-7">PJ</th>
            <th className="text-center px-1 py-2 font-medium w-7">DG</th>
            <th className="text-right px-4 py-2 font-medium w-10">Pts</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((s, pos) => {
            const team = getTeam(s.teamId);
            const advances = pos < 8;
            return (
              <tr
                key={s.teamId}
                className={`border-t border-border/60 ${
                  advances ? "bg-accent-soft/40" : "opacity-60"
                }`}
              >
                <td className="px-4 py-2.5">
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
                  {s.group}
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
}
