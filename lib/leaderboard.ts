import { getSupabase } from "@/lib/supabase/client";

export interface LiveLeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  exactScores: number;
  correctOutcomes: number;
  predictionsScored: number;
}

// Lee la vista de ranking (cruza predicciones con resultados) y junta el avatar
// de cada jugador desde su perfil. Ordena por puntos desc.
export async function fetchLeaderboard(): Promise<LiveLeaderboardEntry[]> {
  const supabase = getSupabase();
  const [rankRes, profileRes] = await Promise.all([
    supabase
      .from("mundial_leaderboard")
      .select(
        "user_id, username, points, exact_scores, correct_outcomes, predictions_scored",
      ),
    supabase.from("mundial_profiles").select("id, avatar_url"),
  ]);
  if (rankRes.error) throw rankRes.error;
  if (profileRes.error) throw profileRes.error;

  const avatars = new Map<string, string | null>(
    (profileRes.data ?? []).map((p) => [p.id as string, p.avatar_url as string | null]),
  );

  return (rankRes.data ?? [])
    .map((r) => ({
      userId: r.user_id as string,
      username: r.username as string,
      avatarUrl: avatars.get(r.user_id as string) ?? null,
      points: r.points as number,
      exactScores: r.exact_scores as number,
      correctOutcomes: r.correct_outcomes as number,
      predictionsScored: r.predictions_scored as number,
    }))
    .sort((a, b) => b.points - a.points || b.exactScores - a.exactScores);
}
