import { getSupabase } from "@/lib/supabase/client";

// Resultado real de un partido (marcador), indexado por match_id.
export type ResultMap = Record<string, { home: string; away: string }>;

export async function fetchResults(): Promise<ResultMap> {
  const { data, error } = await getSupabase()
    .from("mundial_results")
    .select("match_id, home_score, away_score");
  if (error) throw error;

  const map: ResultMap = {};
  for (const row of data ?? []) {
    map[row.match_id as string] = {
      home: String(row.home_score),
      away: String(row.away_score),
    };
  }
  return map;
}

export async function upsertResult(
  matchId: string,
  home: number,
  away: number,
) {
  const { error } = await getSupabase()
    .from("mundial_results")
    .upsert(
      {
        match_id: matchId,
        home_score: home,
        away_score: away,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "match_id" },
    );
  if (error) throw error;
}

export async function deleteResult(matchId: string) {
  const { error } = await getSupabase()
    .from("mundial_results")
    .delete()
    .eq("match_id", matchId);
  if (error) throw error;
}
