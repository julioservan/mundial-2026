import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Copia los pronósticos de un usuario a otro.
//   /api/admin/copy-predictions?from=peix&to=hualde&secret=...
// Reemplaza por completo los del destino por los del origen. Protegido con
// CRON_SECRET. Solo toca las filas del usuario DESTINO.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      url.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const fromName = url.searchParams.get("from");
  const toName = url.searchParams.get("to");
  if (!fromName || !toName) {
    return NextResponse.json({ error: "faltan parámetros from/to" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: profs } = await supabase
    .from("mundial_profiles")
    .select("id, username");

  const find = (q: string) => {
    const ql = q.toLowerCase();
    const list = profs ?? [];
    return (
      list.find((p) => (p.username as string).toLowerCase() === ql) ??
      list.find((p) => (p.username as string).toLowerCase().includes(ql))
    );
  };

  const fromP = find(fromName);
  const toP = find(toName);
  if (!fromP) return NextResponse.json({ error: `no encontrado: ${fromName}` }, { status: 404 });
  if (!toP) return NextResponse.json({ error: `no encontrado: ${toName}` }, { status: 404 });
  if (fromP.id === toP.id) {
    return NextResponse.json({ error: "origen y destino son el mismo" }, { status: 400 });
  }

  const { data: fromPreds, error: readErr } = await supabase
    .from("mundial_predictions")
    .select("match_id, pick, home_score, away_score, advance")
    .eq("user_id", fromP.id);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  // Reemplaza por completo los del destino.
  const { error: delErr } = await supabase
    .from("mundial_predictions")
    .delete()
    .eq("user_id", toP.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const rows = (fromPreds ?? []).map((p) => ({ ...p, user_id: toP.id }));
  let inserted = 0;
  if (rows.length) {
    const { error: insErr } = await supabase
      .from("mundial_predictions")
      .insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    inserted = rows.length;
  }

  return NextResponse.json({
    ok: true,
    from: { id: fromP.id, username: fromP.username, predicciones: fromPreds?.length ?? 0 },
    to: { id: toP.id, username: toP.username, copiadas: inserted },
  });
}
