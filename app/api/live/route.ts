import { NextResponse } from "next/server";
import { fetchWorldCupGames, mapLiveScores } from "@/lib/worldcup-api";

export const dynamic = "force-dynamic";

// Marcadores en vivo (partidos en juego o terminados) mapeados a nuestros IDs.
// Lo consume el panel de la home para mostrar el resultado en directo.
export async function GET() {
  try {
    const games = await fetchWorldCupGames();
    const matches = mapLiveScores(games).map((m) => ({
      matchId: m.matchId,
      home: m.home,
      away: m.away,
      live: m.live,
      finished: m.finished,
    }));
    return NextResponse.json(
      { matches },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
