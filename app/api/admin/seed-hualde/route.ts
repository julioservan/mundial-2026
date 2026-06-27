import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Recuperación puntual de los pronósticos de Hualde + diagnóstico.
// Protegido con CRON_SECRET. Insertar = GET con ?secret=...
const USER_ID = "11d70e92-5de6-4346-9447-793deeae4542";

const PICKS: [string, string][] = [
  ["wc-A-1", "home"], ["wc-A-2", "home"], ["wc-B-1", "draw"], ["wc-D-1", "home"],
  ["wc-D-2", "home"], ["wc-B-2", "draw"], ["wc-C-1", "draw"], ["wc-C-2", "away"],
  ["wc-E-1", "home"], ["wc-F-1", "draw"], ["wc-E-2", "home"], ["wc-F-2", "home"],
  ["wc-H-1", "draw"], ["wc-G-1", "draw"], ["wc-H-2", "draw"], ["wc-G-2", "draw"],
  ["wc-I-1", "home"], ["wc-I-2", "away"], ["wc-J-1", "home"], ["wc-J-2", "home"],
  ["wc-K-1", "draw"], ["wc-L-1", "home"], ["wc-L-2", "home"], ["wc-K-2", "away"],
  ["wc-A-3", "draw"], ["wc-B-3", "home"], ["wc-B-4", "home"], ["wc-A-4", "home"],
  ["wc-D-3", "home"], ["wc-C-3", "away"], ["wc-C-4", "home"], ["wc-D-4", "away"],
  ["wc-F-4", "away"], ["wc-F-3", "home"], ["wc-E-3", "home"], ["wc-E-4", "draw"],
  ["wc-H-3", "home"], ["wc-G-3", "draw"], ["wc-H-4", "draw"], ["wc-G-4", "away"],
  ["wc-J-3", "home"], ["wc-I-3", "home"], ["wc-I-4", "home"], ["wc-J-4", "away"],
  ["wc-K-3", "home"], ["wc-L-3", "draw"], ["wc-L-4", "away"], ["wc-K-4", "home"],
  ["wc-B-5", "home"], ["wc-B-6", "home"], ["wc-C-5", "away"], ["wc-C-6", "home"],
  ["wc-A-5", "away"], ["wc-A-6", "home"], ["wc-E-5", "away"], ["wc-E-6", "home"],
  ["wc-F-5", "draw"], ["wc-F-6", "away"], ["wc-D-5", "home"], ["wc-D-6", "draw"],
  ["wc-I-5", "away"], ["wc-I-6", "home"], ["wc-H-5", "draw"], ["wc-H-6", "away"],
  ["wc-G-5", "draw"], ["wc-G-6", "away"],
];

function actualOf(h: number, a: number): string {
  return h > a ? "home" : h < a ? "away" : "draw";
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      new URL(req.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  const rows = PICKS.map(([match_id, pick]) => ({
    user_id: USER_ID,
    match_id,
    pick,
    home_score: null,
    away_score: null,
  }));

  const { error: insErr } = await supabase
    .from("mundial_predictions")
    .upsert(rows, { onConflict: "user_id,match_id" });

  // Diagnóstico tras el intento.
  const { data: preds } = await supabase
    .from("mundial_predictions")
    .select("match_id, pick")
    .eq("user_id", USER_ID);
  const { data: results } = await supabase
    .from("mundial_results")
    .select("match_id, home_score, away_score");
  const { data: lb } = await supabase
    .from("mundial_leaderboard")
    .select("points, correct, predictions_scored")
    .eq("user_id", USER_ID)
    .maybeSingle();

  const resMap = new Map(
    (results ?? []).map((r) => [r.match_id as string, r]),
  );
  let crossing = 0;
  let correctComputed = 0;
  for (const p of preds ?? []) {
    const r = resMap.get(p.match_id as string);
    if (!r) continue;
    crossing++;
    if (
      p.pick ===
      actualOf(r.home_score as number, r.away_score as number)
    ) {
      correctComputed++;
    }
  }

  // Desglose partido a partido: pick vs marcador real guardado.
  const breakdown = (preds ?? []).map((p) => {
    const r = resMap.get(p.match_id as string);
    const actual = r
      ? actualOf(r.home_score as number, r.away_score as number)
      : null;
    return {
      match: p.match_id,
      pick: p.pick,
      resultado: r ? `${r.home_score}-${r.away_score}` : null,
      actual,
      ok: actual ? p.pick === actual : null,
    };
  });

  return NextResponse.json({
    insertError: insErr?.message ?? null,
    totalPredicciones: preds?.length ?? 0,
    cruzanConResultado: crossing,
    aciertosCalculados: correctComputed,
    rankingView: lb ?? null,
    breakdown,
  });
}
