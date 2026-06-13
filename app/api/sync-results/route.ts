import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchWorldCupGames, mapFinishedResults } from "@/lib/worldcup-api";

export const dynamic = "force-dynamic";

// Sincroniza los resultados TERMINADOS desde worldcup26.ir hacia mundial_results.
// Pensado para llamarse desde un cron (Vercel Cron o cron-job.org).
// Si CRON_SECRET está definido, exige Authorization: Bearer <secret> o ?secret=.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const provided =
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      url.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  let results;
  try {
    const games = await fetchWorldCupGames();
    results = mapFinishedResults(games);
  } catch (e) {
    return NextResponse.json(
      { error: "No se pudo leer la API de resultados", detail: String(e) },
      { status: 502 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const rows = results.map((r) => ({
    match_id: r.matchId,
    home_score: r.home,
    away_score: r.away,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("mundial_results")
      .upsert(rows, { onConflict: "match_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, partidos_terminados: rows.length });
}
