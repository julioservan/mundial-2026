import { getSupabase } from "@/lib/supabase/client";
import { type Pick, winnerOf } from "@/lib/scoring";

// Una predicción por partido:
//   · pick    -> ganador (1/X/2). En grupos es lo único que cuenta.
//   · home/away -> marcador exacto (solo eliminatorias; "" si no se rellena).
//   · advance -> "quién pasa" (penaltis), obligatorio en KO si pick === "draw".
export interface PredEntry {
  pick: Pick;
  home: string;
  away: string;
  advance: "home" | "away" | null;
}

export type PredMap = Record<string, PredEntry>;

const STORAGE_KEY = "wc2026:picks";
const LEGACY_PICK_KEY = "wc2026:picks"; // mismo key, formato antiguo (string)
const LEGACY_SCORE_KEY = "wc2026:predictions"; // aún más antiguo (marcadores)

function entry(partial: Partial<PredEntry> & { pick: Pick }): PredEntry {
  return {
    pick: partial.pick,
    home: partial.home ?? "",
    away: partial.away ?? "",
    advance: partial.advance ?? null,
  };
}

export function isEmptyEntry(e: PredEntry | undefined): boolean {
  return !e || (!e.pick && e.home === "" && e.away === "" && !e.advance);
}

// ----------------------------------------------------------------------------
// localStorage (para usuarios sin sesión, y origen de la migración)
// ----------------------------------------------------------------------------
export function loadLocal(): PredMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: PredMap = {};
      for (const [id, v] of Object.entries(parsed)) {
        if (typeof v === "string") {
          // Formato antiguo: matchId -> "home"|"draw"|"away".
          out[id] = entry({ pick: v as Pick });
        } else if (v && typeof v === "object") {
          const o = v as Partial<PredEntry>;
          if (o.pick) out[id] = entry({ pick: o.pick, home: o.home, away: o.away, advance: o.advance ?? null });
        }
      }
      return out;
    }
    // Formato más antiguo (marcadores) -> ganador derivado.
    const legacy = window.localStorage.getItem(LEGACY_SCORE_KEY);
    if (legacy) {
      const scores = JSON.parse(legacy) as Record<string, { home: string; away: string }>;
      const out: PredMap = {};
      for (const [id, s] of Object.entries(scores)) {
        if (s.home !== "" && s.away !== "") {
          out[id] = entry({ pick: winnerOf(Number(s.home), Number(s.away)) });
        }
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveLocal(state: PredMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_PICK_KEY);
  window.localStorage.removeItem(LEGACY_SCORE_KEY);
}

export function hasAnyPick(map: PredMap): boolean {
  return Object.keys(map).length > 0;
}

// ----------------------------------------------------------------------------
// Supabase (para usuarios con sesión)
// ----------------------------------------------------------------------------
export async function fetchRemote(userId: string): Promise<PredMap> {
  const { data, error } = await getSupabase()
    .from("mundial_predictions")
    .select("match_id, pick, home_score, away_score, advance")
    .eq("user_id", userId);
  if (error) throw error;

  const map: PredMap = {};
  for (const row of data ?? []) {
    const id = row.match_id as string;
    const pick =
      (row.pick as Pick | null) ??
      (row.home_score != null && row.away_score != null
        ? winnerOf(row.home_score as number, row.away_score as number)
        : null);
    if (!pick) continue;
    map[id] = entry({
      pick,
      home: row.home_score != null ? String(row.home_score) : "",
      away: row.away_score != null ? String(row.away_score) : "",
      advance: (row.advance as "home" | "away" | null) ?? null,
    });
  }
  return map;
}

function toRow(userId: string, matchId: string, e: PredEntry) {
  return {
    user_id: userId,
    match_id: matchId,
    pick: e.pick,
    home_score: e.home === "" ? null : Number(e.home),
    away_score: e.away === "" ? null : Number(e.away),
    // Solo incluimos `advance` si hay valor, para no depender de esa columna
    // (la añade knockout-scoring.sql) salvo cuando de verdad hace falta.
    ...(e.advance ? { advance: e.advance } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertRemote(userId: string, matchId: string, e: PredEntry) {
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .upsert(toRow(userId, matchId, e), { onConflict: "user_id,match_id" });
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

// Borra solo los pronósticos indicados (p. ej. los de partidos sin empezar);
// los de partidos ya jugados se conservan porque quedan registrados.
export async function deleteManyRemote(userId: string, matchIds: string[]) {
  if (matchIds.length === 0) return;
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .delete()
    .eq("user_id", userId)
    .in("match_id", matchIds);
  if (error) throw error;
}

// Sube (upsert) todos los pronósticos del mapa de golpe. Lo usa tanto la
// migración de local→cuenta como el botón de "Guardar" manual.
export async function saveAllRemote(userId: string, map: PredMap) {
  const rows = Object.entries(map).map(([matchId, e]) => toRow(userId, matchId, e));
  if (rows.length === 0) return;
  const { error } = await getSupabase()
    .from("mundial_predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });
  if (error) throw error;
}

// Sube a la base los pronósticos que el usuario tuviera en local (sin cuenta).
export async function migrateLocalToRemote(userId: string, local: PredMap) {
  await saveAllRemote(userId, local);
}
