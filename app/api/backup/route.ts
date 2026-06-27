import { NextResponse } from "next/server";
import { backupPredictions } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Fuerza una copia de seguridad de los pronósticos (instantánea del día).
// Protegido con CRON_SECRET, igual que /api/sync. Puedes apuntar aquí un cron
// externo diario, además del backup automático que ya hace /api/sync.
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
    const result = await backupPredictions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
