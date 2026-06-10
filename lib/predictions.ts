import { getSupabase } from "@/lib/supabase/client";

// Marcador como strings (lo que se teclea); "" = sin rellenar.
export type ScoreMap = Record<string, { home: string; away: string }>;

const STORAGE_KEY = "wc2026:predictions";

// ----------------------------------------------------------------------------
// localStorage (para usuarios sin sesión, y como origen de la migración)
// ----------------------------------------------------------------------------
export function loadLocal(): ScoreMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocal(state: ScoreMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isFilled(s: { home: string; away: string }): boolean {
  return s.home !== "" && s.away !== "";
}

function hasAnyFilled(map: ScoreMap): boolean {
  return Object.values(map).some(isFilled);
}

// ----------------------------------------------------------------------------
// Supabase (para usuarios con sesión)
// ----------------------------------------------------------------------------
export async function fetchRemote(userId: string): Promise<ScoreMap> {
  const { data, error } = await getSupabase()
    .from("mundial_predictions")
    .select("match_id, home_score, away_score")
    .eq("user_id", userId);
  if (error) throw error;

  const map: ScoreMap = {};
  for (const row of data ?? []) {
    map[row.match_id as string] = {
      home: String(row.home_score),
      away: String(row.away_score),
    };
  }
  return map;
}

export async function upsertRemote(
  userId: string,
  matchId: string,
  home: number,
  away: number,
) {
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .upsert(
      {
        user_id: userId,
        match_id: matchId,
        home_score: home,
        away_score: away,
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

// Sube a la base las predicciones que el usuario tuviera guardadas localmente
// (de cuando jugaba sin cuenta) y limpia el localStorage.
export async function migrateLocalToRemote(userId: string, local: ScoreMap) {
  const rows = Object.entries(local)
    .filter(([, v]) => isFilled(v))
    .map(([matchId, v]) => ({
      user_id: userId,
      match_id: matchId,
      home_score: Number(v.home),
      away_score: Number(v.away),
    }));
  if (rows.length === 0) return;
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });
  if (error) throw error;
}

export { hasAnyFilled };
