// ============================================================================
// Lógica pura de clasificación FIFA (Mundial 2026, 48 equipos).
// ----------------------------------------------------------------------------
// Sin dependencias de datos ni de red: todo entra por parámetros para poder
// testearlo en aislamiento (ver scripts/verify-fifa.ts). Los archivos de la app
// (lib/standings.ts) envuelven estas funciones inyectando los datos reales.
//
// Reglas de desempate (FIFA, reglamento del torneo, en orden):
//   1. Puntos
//   2. Diferencia de goles (global)
//   3. Goles a favor (global)
//   Si persiste el empate, SOLO entre los equipos empatados:
//   4. Puntos en los enfrentamientos directos
//   5. Diferencia de goles en los enfrentamientos directos
//   6. Goles a favor en los enfrentamientos directos
//   7. Puntos de juego limpio (fair play) — menos tarjetas, mejor
//   8. Sorteo
//
// El ranking de mejores terceros usa solo criterios globales (1-3, 7-8): no hay
// enfrentamientos directos entre equipos de grupos distintos.
// ============================================================================

export interface TeamInput {
  id: string;
  group: string;
  /** Puntos de juego limpio (tarjetas). Menos = mejor. 0 si no hay dato. */
  fairPlay?: number;
}

export interface MatchInput {
  id: string;
  group?: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface Score {
  home: number;
  away: number;
}

export type ResultMap = Record<string, Score>;

export interface Standing {
  teamId: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  fairPlay: number;
}

function blank(teamId: string, group: string, fairPlay = 0): Standing {
  return {
    teamId,
    group,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    fairPlay,
  };
}

function applyMatch(H: Standing, A: Standing, hs: number, as: number) {
  H.played++;
  A.played++;
  H.gf += hs;
  H.ga += as;
  A.gf += as;
  A.ga += hs;
  H.gd = H.gf - H.ga;
  A.gd = A.gf - A.ga;
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

/** Acumula estadísticas crudas (sin ordenar) de un conjunto de equipos. */
function accumulate(
  teams: TeamInput[],
  matches: MatchInput[],
  results: ResultMap,
): Map<string, Standing> {
  const table = new Map<string, Standing>();
  for (const t of teams) {
    table.set(t.id, blank(t.id, t.group, t.fairPlay ?? 0));
  }
  for (const m of matches) {
    const r = results[m.id];
    if (!r) continue;
    const hs = Number(r.home);
    const as = Number(r.away);
    if (Number.isNaN(hs) || Number.isNaN(as)) continue;
    const H = table.get(m.homeTeamId);
    const A = table.get(m.awayTeamId);
    if (!H || !A) continue;
    applyMatch(H, A, hs, as);
  }
  return table;
}

/** Compara por criterios globales: puntos → DG → GF. 0 si empatan en los tres. */
function compareGlobal(a: Standing, b: Standing): number {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf;
}

/** Compara por desempates finales: fair play (menos = mejor) → id (sorteo). */
function compareFinal(a: Standing, b: Standing): number {
  // Menos puntos de fair play (tarjetas) es mejor.
  if (a.fairPlay !== b.fairPlay) return a.fairPlay - b.fairPlay;
  // Sorteo: usamos el id como desempate determinista y reproducible.
  return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
}

/**
 * Mini-tabla de enfrentamientos directos entre un subconjunto de equipos.
 * Solo cuenta partidos donde AMBOS equipos están en el subconjunto.
 */
function headToHead(
  tied: Standing[],
  matches: MatchInput[],
  results: ResultMap,
): Map<string, Standing> {
  const ids = new Set(tied.map((s) => s.teamId));
  const sub = accumulate(
    tied.map((s) => ({ id: s.teamId, group: s.group, fairPlay: s.fairPlay })),
    matches.filter((m) => ids.has(m.homeTeamId) && ids.has(m.awayTeamId)),
    results,
  );
  return sub;
}

/**
 * Ordena los equipos de UN grupo aplicando todos los desempates FIFA.
 * `matches` deben ser los del grupo (o todos; se filtran por pertenencia).
 */
export function rankGroup(
  teams: TeamInput[],
  matches: MatchInput[],
  results: ResultMap,
): Standing[] {
  const table = accumulate(teams, matches, results);
  const list = [...table.values()];

  // Orden primario global.
  list.sort(compareGlobal);

  // Resuelve clústeres de equipos empatados en (puntos, DG, GF).
  const out: Standing[] = [];
  let i = 0;
  while (i < list.length) {
    let j = i + 1;
    while (j < list.length && compareGlobal(list[i], list[j]) === 0) j++;
    const cluster = list.slice(i, j);
    if (cluster.length === 1) {
      out.push(cluster[0]);
    } else {
      out.push(...breakTie(cluster, matches, results));
    }
    i = j;
  }
  return out;
}

/** Desempata un clúster: enfrentamientos directos → fair play → sorteo. */
function breakTie(
  cluster: Standing[],
  matches: MatchInput[],
  results: ResultMap,
): Standing[] {
  const h2h = headToHead(cluster, matches, results);
  return [...cluster].sort((a, b) => {
    const ha = h2h.get(a.teamId)!;
    const hb = h2h.get(b.teamId)!;
    const byH2H = compareGlobal(ha, hb);
    if (byH2H !== 0) return byH2H;
    return compareFinal(a, b);
  });
}

export interface GroupTable {
  group: string;
  standings: Standing[];
}

/** Clasificación de todos los grupos. */
export function rankAllGroups(
  teams: TeamInput[],
  matches: MatchInput[],
  results: ResultMap,
): GroupTable[] {
  const groups = [...new Set(teams.map((t) => t.group))].sort();
  return groups.map((group) => ({
    group,
    standings: rankGroup(
      teams.filter((t) => t.group === group),
      matches.filter((m) => m.group === group),
      results,
    ),
  }));
}

/**
 * Ranking de los terceros de cada grupo (criterios globales + fair play + sorteo).
 * Devuelve los terceros ordenados de mejor a peor. Los `qualifying` primeros
 * (8 en el formato 2026) avanzan a dieciseisavos.
 */
export function rankThirdPlaced(
  tables: GroupTable[],
  qualifying = 8,
): { ranked: Standing[]; qualified: Standing[] } {
  const thirds = tables
    .map((t) => t.standings[2])
    .filter((s): s is Standing => Boolean(s));
  const ranked = [...thirds].sort(
    (a, b) => compareGlobal(a, b) || compareFinal(a, b),
  );
  return { ranked, qualified: ranked.slice(0, qualifying) };
}

export interface Qualified {
  /** group -> teamId del primero */
  winners: Record<string, string>;
  /** group -> teamId del segundo */
  runnersUp: Record<string, string>;
  /** terceros clasificados (los 8 mejores), en orden de ranking */
  bestThirds: Standing[];
  /** grupos cuyo tercero clasifica, ordenados alfabéticamente */
  bestThirdGroups: string[];
}

/** Resuelve los 32 clasificados a partir de las tablas de grupo. */
export function resolveQualified(tables: GroupTable[]): Qualified {
  const winners: Record<string, string> = {};
  const runnersUp: Record<string, string> = {};
  for (const t of tables) {
    if (t.standings[0]) winners[t.group] = t.standings[0].teamId;
    if (t.standings[1]) runnersUp[t.group] = t.standings[1].teamId;
  }
  const { qualified } = rankThirdPlaced(tables);
  const bestThirdGroups = qualified.map((s) => s.group).sort();
  return { winners, runnersUp, bestThirds: qualified, bestThirdGroups };
}
