// Pronóstico de fase de grupos: solo el ganador (1, X, 2), no el marcador.
export type Pick = "home" | "draw" | "away";

export type Outcome = "correct" | "miss";

export interface PickResult {
  outcome: Outcome;
  points: number;
}

// Ganador real (o empate) a partir de un marcador.
export function winnerOf(home: number, away: number): Pick {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

// 1 punto si aciertas quién gana (o el empate); 0 si fallas.
export function scorePick(
  pick: Pick,
  result: { home: string; away: string },
): PickResult {
  const actual = winnerOf(Number(result.home), Number(result.away));
  return pick === actual
    ? { outcome: "correct", points: 1 }
    : { outcome: "miss", points: 0 };
}

// Eliminatorias: 1 punto por acertar el ganador (1/X/2) + 3 por clavar el
// resultado exacto (total 4). "Quién pasa" no puntúa.
export function scoreKnockout(
  pick: Pick | null,
  predHome: string,
  predAway: string,
  result: { home: string; away: string },
): PickResult {
  const actual = winnerOf(Number(result.home), Number(result.away));
  let points = pick && pick === actual ? 1 : 0;
  const exact =
    predHome !== "" &&
    predAway !== "" &&
    Number(predHome) === Number(result.home) &&
    Number(predAway) === Number(result.away);
  if (exact) points += 3;
  return { outcome: points > 0 ? "correct" : "miss", points };
}
