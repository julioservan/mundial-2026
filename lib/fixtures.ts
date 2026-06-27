import { getSupabase } from "@/lib/supabase/client";
import type { SlotAssignment } from "@/lib/bracket";
import type { TopScorer } from "@/lib/providers";

// Snapshot de partidos desde el feed (mundial_fixtures), indexado por match_id.
// Lo usa el cuadro de eliminatoria para mostrar equipos reales y estado en vivo.
export async function fetchFixtureAssignments(): Promise<
  Record<string, SlotAssignment>
> {
  const { data, error } = await getSupabase()
    .from("mundial_fixtures")
    .select("match_id, home_team_id, away_team_id, status, external_id");
  if (error) throw error;

  const map: Record<string, SlotAssignment> = {};
  for (const row of data ?? []) {
    map[row.match_id as string] = {
      homeTeamId: (row.home_team_id as string | null) ?? null,
      awayTeamId: (row.away_team_id as string | null) ?? null,
      status: (row.status as SlotAssignment["status"]) ?? "scheduled",
      externalId: (row.external_id as number | null) ?? null,
    };
  }
  return map;
}

export interface DataFreshness {
  at: string;
  ok: boolean;
  note: string;
  count: number;
  cap: number;
}

// Lee el estado de la última sincronización (mundial_meta) para el indicador.
export async function fetchFreshness(): Promise<DataFreshness | null> {
  const { data, error } = await getSupabase()
    .from("mundial_meta")
    .select("value")
    .eq("key", "last_sync")
    .maybeSingle();
  if (error || !data) return null;
  const v = data.value as Partial<DataFreshness>;
  return {
    at: v.at ?? "",
    ok: v.ok ?? true,
    note: v.note ?? "",
    count: v.count ?? 0,
    cap: v.cap ?? 0,
  };
}

// Máximos goleadores (Bota de Oro) desde mundial_meta.
export async function fetchTopScorers(): Promise<{
  at: string;
  players: TopScorer[];
}> {
  const { data, error } = await getSupabase()
    .from("mundial_meta")
    .select("value")
    .eq("key", "top_scorers")
    .maybeSingle();
  if (error || !data) return { at: "", players: [] };
  const v = data.value as { at?: string; players?: TopScorer[] };
  return { at: v.at ?? "", players: v.players ?? [] };
}
