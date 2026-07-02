import { NextResponse } from "next/server";
import { getSupabaseAnonServer } from "@/lib/supabase/anon-server";

export const dynamic = "force-dynamic";

// Marcadores en vivo (y terminados) para el panel de la home. Lee el snapshot
// que el poller (/api/sync) ya persistió en `mundial_fixtures`, de modo que una
// carga de página NUNCA llama a la API externa.
export async function GET() {
  const supabase = getSupabaseAnonServer();
  if (!supabase) return NextResponse.json({ matches: [] });

  try {
    const { data, error } = await supabase
      .from("mundial_fixtures")
      .select("match_id, home_score, away_score, status")
      .in("status", ["live", "finished"]);
    if (error) throw new Error(error.message);

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
      {
        headers: {
          // Cacheable también en el CDN (s-maxage) y con "sirve lo viejo
          // mientras revalida": absorbe ráfagas sin dar datos rancios.
          "Cache-Control":
            "public, max-age=15, s-maxage=15, stale-while-revalidate=30",
        },
      },
    );
  } catch {
    // Fallo transitorio: respuesta vacía sin cachear, para reintentar pronto.
    return NextResponse.json(
      { matches: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
