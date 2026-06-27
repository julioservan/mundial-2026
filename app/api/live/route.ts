import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Marcadores en vivo (y terminados) para el panel de la home. Lee el snapshot
// que el poller (/api/sync) ya persistió en `mundial_fixtures`, de modo que una
// carga de página NUNCA llama a la API externa.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ matches: [] });

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("mundial_fixtures")
      .select("match_id, home_score, away_score, status")
      .in("status", ["live", "finished"]);

    const matches = (data ?? [])
      .filter((m) => m.home_score != null && m.away_score != null)
      .map((m) => ({
        matchId: m.match_id as string,
        home: m.home_score as number,
        away: m.away_score as number,
        live: m.status === "live",
        finished: m.status === "finished",
      }));

    return NextResponse.json(
      { matches },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
