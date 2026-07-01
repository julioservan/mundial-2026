import { NextResponse, type NextRequest } from "next/server";
import { MATCHES } from "@/lib/data/matches";
import { runSync, isSyncMode } from "@/lib/sync";
import { maybeBackup } from "@/lib/backup";
import { isCronAuthorized } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Endpoint del poller. Lo llama Vercel Cron (que envía Authorization: Bearer
// <CRON_SECRET> automáticamente si CRON_SECRET está definido) o un cron externo
// con ?secret=. Modos: ?mode=auto (def.) | live | full.
//
//   auto -> sync completa si toca (cada ~30 min) + en vivo si hay partidos
//   live -> solo marcadores en vivo
//   full -> recarga todos los partidos (terminados, nuevos cruces…)
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const mode = params.get("mode") ?? "auto";
  if (!isSyncMode(mode)) {
    return NextResponse.json(
      { error: `mode inválido: "${mode}" (usa auto | live | full)` },
      { status: 400 },
    );
  }
  const refresh = params.get("refresh") === "1";
  const kickoffs = MATCHES.map((m) => m.kickoff);

  try {
    const summary = await runSync(mode, kickoffs, refresh);
    // Copia de seguridad diaria de los pronósticos (best-effort, gated a 1/día).
    await maybeBackup();
    return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}
