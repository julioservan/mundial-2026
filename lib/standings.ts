import type { GroupId } from "@/types";
import { GROUP_MATCHES } from "@/lib/data/matches";
import { teamsByGroup } from "@/lib/data/teams";
import type { ResultMap } from "@/lib/results";

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// Clasificación de un grupo calculada con los resultados reales.
// 3 pts victoria · 1 pt empate. Orden: puntos, dif. de goles, goles a favor.
export function computeGroupStandings(
  group: GroupId,
  results: ResultMap,
): Standing[] {
  const table = new Map<string, Standing>();
  for (const t of teamsByGroup(group)) {
    table.set(t.id, {
      teamId: t.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const m of GROUP_MATCHES) {
    if (m.group !== group || !m.homeTeamId || !m.awayTeamId) continue;
    const r = results[m.id];
    if (!r || r.home === "" || r.away === "") continue;
    const hs = Number(r.home);
    const as = Number(r.away);
    if (Number.isNaN(hs) || Number.isNaN(as)) continue;

    const H = table.get(m.homeTeamId);
    const A = table.get(m.awayTeamId);
    if (!H || !A) continue;

    H.played++;
    A.played++;
    H.gf += hs;
    H.ga += as;
    A.gf += as;
    A.ga += hs;
    if (hs > as) {
      H.won++;
      H.points += 3;
      A.lost++;
    } else if (hs < as) {
      A.won++;
      A.points += 3;
      H.lost++;
    } else {
      H.drawn++;
      A.drawn++;
      H.points++;
      A.points++;
    }
  }

  const list = [...table.values()];
  for (const s of list) s.gd = s.gf - s.ga;
  return list.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf,
  );
}
