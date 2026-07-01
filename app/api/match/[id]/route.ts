import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { provider } from "@/lib/providers";
import type { MatchDetail } from "@/lib/providers";
import { MATCHES } from "@/lib/data/matches";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Frescura del detalle según estado: en vivo casi al instante, terminado rara
// vez, programado cada poco (las alineaciones salen ~40 min antes).
function ttlMs(status: string): number {
  if (status === "live") return 60_000;
  if (status === "finished") return 6 * 3_600_000;
  return 10 * 60_000;
}

// Goleadores (home/away) derivados de los eventos del partido.
function scorers(detail: MatchDetail, homeId: string | null, awayId: string | null) {
  const home: string[] = [];
  const away: string[] = [];
  for (const e of detail.events) {
    if (e.type !== "Goal" || e.detail === "Missed Penalty") continue;
    const label = `${e.player ?? "?"} ${e.minute}'`;
    if (e.teamId && e.teamId === homeId) home.push(label);
    else if (e.teamId && e.teamId === awayId) away.push(label);
  }
  return { home, away };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const staticMatch = MATCHES.find((m) => m.id === id);
  // Todo id válido está en el calendario estático (el poller solo escribe ids
  // nuestros): un id desconocido es un 404 sin gastar consultas.
  if (!staticMatch) {
    return NextResponse.json(
      { found: false, error: "Partido desconocido" },
      { status: 404 },
    );
  }
  const supabase = getSupabaseAdmin();

  // Estado + id externo + equipos + marcador en vivo del snapshot (si existe).
  const { data: fix } = await supabase
    .from("mundial_fixtures")
    .select(
      "external_id, status, home_team_id, away_team_id, home_score, away_score, kickoff",
    )
    .eq("match_id", id)
    .maybeSingle();

  const homeId = (fix?.home_team_id as string) ?? staticMatch?.homeTeamId ?? null;
  const awayId = (fix?.away_team_id as string) ?? staticMatch?.awayTeamId ?? null;
  const status = (fix?.status as string) ?? "scheduled";
  const externalId = (fix?.external_id as number) ?? null;
  // Hora real del feed; el calendario estático de eliminatorias es placeholder.
  const kickoff = (fix?.kickoff as string | null) ?? staticMatch?.kickoff ?? null;

  // Caché actual.
  const { data: cached } = await supabase
    .from("mundial_match_detail")
    .select("data, updated_at")
    .eq("match_id", id)
    .maybeSingle();

  let detail = (cached?.data as MatchDetail) ?? null;
  const fresh =
    cached?.updated_at &&
    Date.now() - new Date(cached.updated_at as string).getTime() < ttlMs(status);

  // Si está obsoleto y tenemos id externo + key, refrescamos desde el feed.
  if (!fresh && externalId && process.env.APIFOOTBALL_KEY) {
    try {
      const r = await provider.fetchFixtureDetail(externalId);
      if (r.errors.length === 0) {
        // La previa (pronóstico, forma, H2H, bajas) solo tiene sentido antes de
        // que empiece; si ya está en vivo o terminado, conservamos la cacheada.
        let preview =
          (cached?.data as MatchDetail | undefined)?.preview ?? null;
        if (status === "scheduled") {
          try {
            const pv = await provider.fetchMatchPreview(externalId);
            if (pv.errors.length === 0) preview = pv.data;
          } catch {
            // la previa es opcional; si falla, seguimos con el detalle
          }
        }
        detail = { ...r.data, preview };
        await supabase.from("mundial_match_detail").upsert(
          { match_id: id, data: detail, updated_at: new Date().toISOString() },
          { onConflict: "match_id" },
        );
      }
    } catch {
      // si falla, servimos lo cacheado (si lo hay)
    }
  }

  const sc = detail ? scorers(detail, homeId, awayId) : { home: [], away: [] };
  return NextResponse.json(
    {
      found: Boolean(detail) || Boolean(fix),
      status,
      kickoff,
      homeTeamId: homeId,
      awayTeamId: awayId,
      // Marcador EN VIVO (null si no ha empezado); el final está en mundial_results.
      home: fix?.home_score ?? null,
      away: fix?.away_score ?? null,
      detail: detail ?? null,
      preview: detail?.preview ?? null,
      homeScorers: sc.home,
      awayScorers: sc.away,
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
