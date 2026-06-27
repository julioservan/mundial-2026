// Verificación del motor de eliminatoria (lib/bracket.ts).
// Ejecuta: npm test
import { computeBracket, type KnockoutSlots, type BracketInput } from "@/lib/bracket";

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

const slots: KnockoutSlots = {
  round32: Array.from({ length: 16 }, (_, i) => `R32-${i + 1}`),
  round16: Array.from({ length: 8 }, (_, i) => `R16-${i + 1}`),
  quarterfinal: Array.from({ length: 4 }, (_, i) => `QF-${i + 1}`),
  semifinal: ["SF-1", "SF-2"],
  third_place: "TP",
  final: "F",
};

const seed: Record<string, { home: string | null; away: string | null }> = {};
for (let i = 0; i < 16; i++) {
  seed[`R32-${i + 1}`] = { home: `t${2 * i + 1}`, away: `t${2 * i + 2}` };
}
// En cada partido gana el local 1-0, en todas las rondas.
const results: BracketInput["results"] = {};
for (const id of [
  ...slots.round32,
  ...slots.round16,
  ...slots.quarterfinal,
  ...slots.semifinal,
  slots.third_place,
  slots.final,
]) {
  results[id] = { home: 1, away: 0 };
}

const b = computeBracket({ slots, results, seed });
eq("R16-1 enfrenta ganadores", [b.byId["R16-1"].homeTeamId, b.byId["R16-1"].awayTeamId], ["t1", "t3"]);
eq("propaga hasta la final", [b.byId["F"].homeTeamId, b.byId["F"].awayTeamId], ["t1", "t17"]);
eq("campeón", b.champion, "t1");
eq("tercer puesto = perdedores SF", [b.byId["TP"].homeTeamId, b.byId["TP"].awayTeamId], ["t9", "t25"]);

// El proveedor manda sobre la proyección.
const b2 = computeBracket({
  slots,
  results,
  seed,
  assignments: { "R16-1": { homeTeamId: "REAL_A", awayTeamId: "REAL_B" } },
});
eq("assignment override", b2.byId["R16-1"].homeTeamId, "REAL_A");
eq("override no es proyección", b2.byId["R16-1"].projected, false);

// Sin datos -> TBD con etiqueta de origen.
const b3 = computeBracket({ slots, results: {} });
eq("R32 sin datos = TBD", b3.byId["R32-1"].homeTeamId, null);
eq("etiqueta de origen", b3.byId["R16-1"].homeFrom, "Ganador 16avos 1");

console.log(failed === 0 ? "\nBRACKET: TODO OK" : `\nBRACKET: ${failed} FALLOS`);
if (failed) process.exit(1);
