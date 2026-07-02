import { NextResponse } from "next/server";
import { MATCHES } from "@/lib/data/matches";
import { runSync } from "@/lib/sync";
import { isCronAuthorized } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// DEPRECADO: usa /api/sync. Se mantiene como alias para no romper crons ya
// configurados. Ahora delega en el motor de sincronización (API-Football) en
// lugar de leer worldcup26.ir directamente.
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
