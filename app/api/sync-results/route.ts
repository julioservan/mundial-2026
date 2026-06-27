import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/data/matches";
import { runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// DEPRECADO: usa /api/sync. Se mantiene como alias para no romper crons ya
// configurados. Ahora delega en el motor de sincronización (API-Football) en
// lugar de leer worldcup26.ir directamente.
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

  try {
    const summary = await runSync("full", MATCHES.map((m) => m.kickoff));
    return NextResponse.json(
      { ok: summary.ok, partidos_terminados: summary.resultsUpserted, summary },
      { status: summary.ok ? 200 : 207 },
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
