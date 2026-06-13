import { NextResponse } from "next/server";
import { fetchWorldCupGames, mapAllGames } from "@/lib/worldcup-api";

export const dynamic = "force-dynamic";

// Devuelve marcador, estado y goleadores de un partido concreto (mapeado).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const games = await fetchWorldCupGames();
    const m = mapAllGames(games).find((g) => g.matchId === id);
    if (!m) return NextResponse.json({ found: false });
    return NextResponse.json(
      {
        found: true,
        home: m.home,
        away: m.away,
        finished: m.finished,
        live: m.live,
        homeScorers: m.homeScorers,
        awayScorers: m.awayScorers,
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ found: false });
  }
}
