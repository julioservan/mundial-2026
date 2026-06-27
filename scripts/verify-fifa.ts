// Verificación de la lógica de clasificación FIFA (lib/fifa.ts).
// Ejecuta: npm test
import {
  rankGroup,
  rankThirdPlaced,
  resolveQualified,
  type TeamInput,
  type MatchInput,
  type ResultMap,
  type Standing,
} from "@/lib/fifa";

let failed = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    failed++;
    console.error(`✗ ${name}\n   got:  ${g}\n   want: ${w}`);
  } else {
    console.log(`✓ ${name}`);
  }
}

// Orden básico por puntos en un grupo de 4.
const teams: TeamInput[] = ["a", "b", "c", "d"].map((id) => ({ id, group: "A" }));
const matches: MatchInput[] = [
  { id: "m1", group: "A", homeTeamId: "a", awayTeamId: "c" },
  { id: "m2", group: "A", homeTeamId: "a", awayTeamId: "d" },
  { id: "m3", group: "A", homeTeamId: "b", awayTeamId: "c" },
  { id: "m4", group: "A", homeTeamId: "b", awayTeamId: "d" },
  { id: "m5", group: "A", homeTeamId: "a", awayTeamId: "b" },
  { id: "m6", group: "A", homeTeamId: "c", awayTeamId: "d" },
];
const results: ResultMap = {
  m1: { home: 2, away: 0 },
  m2: { home: 2, away: 0 },
  m3: { home: 2, away: 0 },
  m4: { home: 2, away: 0 },
  m5: { home: 1, away: 0 },
  m6: { home: 0, away: 0 },
};
eq(
  "orden por puntos",
  rankGroup(teams, matches, results).map((s) => s.teamId),
  ["a", "b", "c", "d"],
);

// El ganador del enfrentamiento directo va por delante.
const t2: TeamInput[] = ["x", "y", "z"].map((id) => ({ id, group: "B" }));
const m2arr: MatchInput[] = [
  { id: "p1", group: "B", homeTeamId: "x", awayTeamId: "z" },
  { id: "p2", group: "B", homeTeamId: "y", awayTeamId: "z" },
  { id: "p3", group: "B", homeTeamId: "x", awayTeamId: "y" },
];
const r2: ResultMap = {
  p1: { home: 1, away: 0 },
  p2: { home: 1, away: 0 },
  p3: { home: 1, away: 0 },
};
eq("ganador directo delante", rankGroup(t2, m2arr, r2)[0].teamId, "x");

// Ranking de terceros por criterios globales (DG y pts).
function mk(id: string, group: string, points: number, gd: number): Standing {
  return {
    teamId: id,
    group,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: Math.max(gd, 0) + 2,
    ga: 2 - Math.min(gd, 0),
    gd,
    points,
    fairPlay: 0,
  };
}
const tables = [
  { group: "A", standings: [mk("a1", "A", 9, 5), mk("a2", "A", 6, 2), mk("a3", "A", 3, 0)] },
  { group: "B", standings: [mk("b1", "B", 9, 6), mk("b2", "B", 4, 1), mk("b3", "B", 4, 1)] },
  { group: "C", standings: [mk("c1", "C", 7, 3), mk("c2", "C", 5, 2), mk("c3", "C", 3, 3)] },
];
eq(
  "terceros ordenados",
  rankThirdPlaced(tables, 2).ranked.map((s) => s.teamId),
  ["b3", "c3", "a3"],
);
const q = resolveQualified(tables);
eq("winners", q.winners, { A: "a1", B: "b1", C: "c1" });
eq("runnersUp", q.runnersUp, { A: "a2", B: "b2", C: "c2" });

console.log(failed === 0 ? "\nFIFA: TODO OK" : `\nFIFA: ${failed} FALLOS`);
if (failed) process.exit(1);
