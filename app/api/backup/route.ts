import { NextResponse } from "next/server";
import { backupPredictions } from "@/lib/backup";
import { isCronAuthorized } from "@/lib/api/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Fuerza una copia de seguridad de los pronósticos (instantánea del día).
// Protegido con CRON_SECRET, igual que /api/sync. Puedes apuntar aquí un cron
// externo diario, además del backup automático que ya hace /api/sync.
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await backupPredictions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
