import type { GroupId } from "@/types";
import { GROUP_MATCHES } from "@/lib/data/matches";
import { teamsByGroup, GROUPS } from "@/lib/data/teams";
import type { ResultMap as RawResults } from "@/lib/results";
import {
  rankGroup,
  rankAllGroups,
  rankThirdPlaced,
  resolveQualified,
  type Standing,
  type MatchInput,
  type ResultMap,
  type GroupTable,
  type Qualified,
} from "@/lib/fifa";

export type { Standing } from "@/lib/fifa";

// Convierte el mapa de resultados de la app (marcadores como string) al formato
// numérico que espera la lógica pura FIFA.
function toScores(results: RawResults): ResultMap {
  const out: ResultMap = {};
  for (const [id, r] of Object.entries(results)) {
    if (r.home === "" || r.away === "") continue;
    const home = Number(r.home);
    const away = Number(r.away);
    if (Number.isNaN(home) || Number.isNaN(away)) continue;
    out[id] = { home, away };
  }
  return out;
}

// Partidos de grupo con ambos equipos definidos, en formato de la lógica pura.
function groupMatchInputs(): MatchInput[] {
  return GROUP_MATCHES.filter(
    (m) => m.homeTeamId && m.awayTeamId && m.group,
  ).map((m) => ({
    id: m.id,
    group: m.group,
    homeTeamId: m.homeTeamId as string,
    awayTeamId: m.awayTeamId as string,
  }));
}

// Clasificación de un grupo, con todos los desempates FIFA aplicados.
// (Nota: el fair play queda a 0 mientras el feed no aporte tarjetas.)
export function computeGroupStandings(
  group: GroupId,
  results: RawResults,
): Standing[] {
  const teams = teamsByGroup(group).map((t) => ({ id: t.id, group: t.group }));
  const matches = groupMatchInputs().filter((m) => m.group === group);
  return rankGroup(teams, matches, toScores(results));
}

// Clasificación de los 12 grupos.
export function computeAllGroups(results: RawResults): GroupTable[] {
  const teams = GROUPS.flatMap((g) =>
    teamsByGroup(g).map((t) => ({ id: t.id, group: t.group })),
  );
  return rankAllGroups(teams, groupMatchInputs(), toScores(results));
}

// Ranking de los terceros de cada grupo; los 8 mejores avanzan a dieciseisavos.
export function computeThirdPlaced(results: RawResults): {
  ranked: Standing[];
  qualified: Standing[];
} {
  return rankThirdPlaced(computeAllGroups(results), 8);
}

// Los 32 clasificados (primeros, segundos y 8 mejores terceros).
export function computeQualified(results: RawResults): Qualified {
  return resolveQualified(computeAllGroups(results));
}
