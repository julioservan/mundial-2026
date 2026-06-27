import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Lista usuarios con su nº de pronósticos y puntos. Protegido con CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      new URL(req.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  const [{ data: profs }, { data: preds }, { data: lb }] = await Promise.all([
    supabase.from("mundial_profiles").select("id, username"),
    supabase.from("mundial_predictions").select("user_id"),
    supabase.from("mundial_leaderboard").select("user_id, points"),
  ]);

  const counts = new Map<string, number>();
  for (const p of preds ?? []) {
    const k = p.user_id as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const points = new Map(
    (lb ?? []).map((r) => [r.user_id as string, r.points as number]),
  );

  const users = (profs ?? [])
    .map((p) => ({
      id: p.id as string,
      username: p.username as string,
      predicciones: counts.get(p.id as string) ?? 0,
      puntos: points.get(p.id as string) ?? 0,
    }))
    .sort((a, b) => b.puntos - a.puntos);

  return NextResponse.json({ total: users.length, users });
}
