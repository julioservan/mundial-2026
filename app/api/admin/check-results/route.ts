import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { provider } from "@/lib/providers";
import { mapFixtures } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Compara los resultados GUARDADOS (mundial_results) con los que devuelve la API
// ahora mismo, para detectar resultados incorrectos. Protegido con CRON_SECRET.
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

  // Liga/temporada (cacheada o resuelta).
  const { data: meta } = await supabase
    .from("mundial_meta")
    .select("value")
    .eq("key", "league_season_v2")
    .maybeSingle();
  let ls = (meta?.value as { leagueId: number; season: number } | null) ?? null;
  if (!ls) {
    const r = await provider.resolveLeagueSeason();
    ls = r.data;
  }
  if (!ls) return NextResponse.json({ error: "no se resolvió liga" }, { status: 500 });

  const r = await provider.fetchAllFixtures(ls);
  const apiResults = mapFixtures(r.data).results; // resultados FINALIZADOS según la API

  const { data: stored } = await supabase
    .from("mundial_results")
    .select("match_id, home_score, away_score");

  const apiMap = new Map(
    apiResults.map((m) => [m.match_id, `${m.home_score}-${m.away_score}`]),
  );
  const storedMap = new Map(
    (stored ?? []).map((s) => [
      s.match_id as string,
      `${s.home_score}-${s.away_score}`,
    ]),
  );

  // Discrepancias: la API dice un marcador y lo guardado dice otro (o falta).
  const mismatches: { match: string; api: string; guardado: string | null }[] = [];
  for (const [id, apiScore] of apiMap) {
    const st = storedMap.get(id) ?? null;
    if (st !== apiScore) mismatches.push({ match: id, api: apiScore, guardado: st });
  }
  // Guardados que la API NO da como finalizados (posibles resultados inventados).
  const extraStored: { match: string; guardado: string }[] = [];
  for (const [id, st] of storedMap) {
    if (!apiMap.has(id)) extraStored.push({ match: id, guardado: st });
  }

  return NextResponse.json({
    apiErrors: r.errors,
    apiFinalizados: apiResults.length,
    guardados: storedMap.size,
    discrepancias: mismatches.length,
    soloEnGuardados: extraStored.length,
    detalleDiscrepancias: mismatches.slice(0, 40),
    detalleSoloGuardados: extraStored.slice(0, 40),
  });
}
