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
