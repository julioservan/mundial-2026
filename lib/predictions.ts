import { getSupabase } from "@/lib/supabase/client";
import { type Pick, winnerOf } from "@/lib/scoring";

// Pronóstico de ganador por partido: matchId -> "home" | "draw" | "away".
export type PickMap = Record<string, Pick>;

const STORAGE_KEY = "wc2026:picks";
const LEGACY_SCORE_KEY = "wc2026:predictions"; // formato antiguo (marcadores)

// ----------------------------------------------------------------------------
// localStorage (para usuarios sin sesión, y origen de la migración)
// ----------------------------------------------------------------------------
export function loadLocal(): PickMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Migración del formato antiguo (marcadores) -> ganador.
    const legacy = window.localStorage.getItem(LEGACY_SCORE_KEY);
    if (legacy) {
      const scores = JSON.parse(legacy) as Record<
        string,
        { home: string; away: string }
      >;
      const picks: PickMap = {};
      for (const [id, s] of Object.entries(scores)) {
        if (s.home !== "" && s.away !== "") {
          picks[id] = winnerOf(Number(s.home), Number(s.away));
        }
      }
      return picks;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveLocal(state: PickMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_SCORE_KEY);
}

export function hasAnyPick(map: PickMap): boolean {
  return Object.keys(map).length > 0;
}

// ----------------------------------------------------------------------------
// Supabase (para usuarios con sesión)
// ----------------------------------------------------------------------------
export async function fetchRemote(userId: string): Promise<PickMap> {
  const { data, error } = await getSupabase()
    .from("mundial_predictions")
    .select("match_id, pick, home_score, away_score")
    .eq("user_id", userId);
  if (error) throw error;

  const map: PickMap = {};
  for (const row of data ?? []) {
    if (row.pick) {
      map[row.match_id as string] = row.pick as Pick;
    } else if (row.home_score != null && row.away_score != null) {
      // Predicciones antiguas (marcador) -> se interpretan como ganador.
      map[row.match_id as string] = winnerOf(
        row.home_score as number,
        row.away_score as number,
      );
    }
  }
  return map;
}

export async function upsertRemote(userId: string, matchId: string, pick: Pick) {
  const { error } = await getSupabase().from("mundial_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      pick,
      home_score: null,
      away_score: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  );
  if (error) throw error;
}

export async function deleteRemote(userId: string, matchId: string) {
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .delete()
    .eq("user_id", userId)
    .eq("match_id", matchId);
  if (error) throw error;
}

export async function deleteAllRemote(userId: string) {
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// Sube a la base los pronósticos que el usuario tuviera en local (sin cuenta).
export async function migrateLocalToRemote(userId: string, local: PickMap) {
  const rows = Object.entries(local).map(([matchId, pick]) => ({
    user_id: userId,
    match_id: matchId,
    pick,
    home_score: null,
    away_score: null,
  }));
  if (rows.length === 0) return;
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });
  if (error) throw error;
}
