import { getSupabase } from "@/lib/supabase/client";

export interface LiveLeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  correct: number;
  predictionsScored: number;
}

// Lee la vista de ranking (cruza pronósticos con resultados) y junta el avatar
// de cada jugador desde su perfil. Ordena por puntos desc.
export async function fetchLeaderboard(): Promise<LiveLeaderboardEntry[]> {
  const supabase = getSupabase();
  const [rankRes, profileRes] = await Promise.all([
    supabase
      .from("mundial_leaderboard")
      .select("user_id, username, points, correct, predictions_scored"),
    supabase.from("mundial_profiles").select("id, avatar_url"),
  ]);
  if (rankRes.error) throw rankRes.error;
  if (profileRes.error) throw profileRes.error;

  const avatars = new Map<string, string | null>(
    (profileRes.data ?? []).map((p) => [
      p.id as string,
      p.avatar_url as string | null,
    ]),
  );

  return (rankRes.data ?? [])
    .map((r) => ({
      userId: r.user_id as string,
      username: r.username as string,
      avatarUrl: avatars.get(r.user_id as string) ?? null,
      points: r.points as number,
      correct: r.correct as number,
      predictionsScored: r.predictions_scored as number,
    }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct);
}
