// Compara una predicción con el resultado real y devuelve el acierto y los puntos.
// 3 pts = marcador exacto · 1 pt = acertar el resultado (1X2) · 0 = fallo.
export type Outcome = "exact" | "outcome" | "miss";

export interface ScoreResult {
  outcome: Outcome;
  points: number;
}

export function scorePrediction(
  pred: { home: string; away: string },
  result: { home: string; away: string },
): ScoreResult {
  const ph = Number(pred.home);
  const pa = Number(pred.away);
  const rh = Number(result.home);
  const ra = Number(result.away);

  if (ph === rh && pa === ra) return { outcome: "exact", points: 3 };
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) {
    return { outcome: "outcome", points: 1 };
  }
  return { outcome: "miss", points: 0 };
}
