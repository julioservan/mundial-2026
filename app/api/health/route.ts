import { NextResponse } from "next/server";
import { getSupabaseAnonServer } from "@/lib/supabase/anon-server";

export const dynamic = "force-dynamic";

// Estado de salud del pipeline de datos. Público y barato: solo lee mundial_meta.
// status: "green" todo bien · "amber" datos viejos o cuota baja · "red" fallo.
// El código HTTP acompaña al estado (red -> 503) para que un monitor de uptime
// pueda alertar sin parsear el JSON.
const NO_STORE = { "Cache-Control": "no-store" };

function respond(body: Record<string, unknown>, red: boolean) {
  return NextResponse.json(body, {
    status: red ? 503 : 200,
    headers: NO_STORE,
  });
}

export async function GET() {
  const supabase = getSupabaseAnonServer();
  if (!supabase) {
    return respond({ status: "red", reason: "Sin configurar Supabase" }, true);
  }

  try {
    const { data } = await supabase
      .from("mundial_meta")
      .select("key, value")
      .in("key", ["last_sync", "league_season_v2", "unknown_teams"]);

    const meta = new Map((data ?? []).map((r) => [r.key as string, r.value]));
    const last = meta.get("last_sync") as
      | {
          at?: string;
          ok?: boolean;
          note?: string;
          count?: number;
          cap?: number;
          providerRemaining?: number | null;
          errors?: string[];
        }
      | undefined;
    const league = meta.get("league_season_v2") as
      | { leagueId?: number; season?: number }
      | undefined;
    const unknown = (meta.get("unknown_teams") as { names?: string[] })?.names ?? [];

    if (!last?.at) {
      return respond(
        { status: "red", reason: "El robot aún no ha sincronizado nunca." },
        true,
      );
    }

    const ageMin = Math.floor((Date.now() - new Date(last.at).getTime()) / 60000);
    let status: "green" | "amber" | "red" = "green";
    const reasons: string[] = [];

    if (last.ok === false || (last.errors?.length ?? 0) > 0) {
      status = "red";
      reasons.push("Último sync con errores.");
    }
    if (ageMin > 24 * 60) {
      status = status === "red" ? "red" : "amber";
      reasons.push("Datos con más de 24 h.");
    }
    if (last.providerRemaining != null && last.providerRemaining < 50) {
      status = status === "red" ? "red" : "amber";
      reasons.push("Cuota del proveedor baja.");
    }
    if (unknown.length > 0) {
      status = status === "red" ? "red" : "amber";
      reasons.push(`${unknown.length} equipo(s) sin reconocer.`);
    }

    return respond(
      {
        status,
        reasons,
        lastSyncAt: last.at,
        ageMinutes: ageMin,
        dailyCount: last.count ?? null,
        dailyCap: last.cap ?? null,
        providerRemaining: last.providerRemaining ?? null,
        league: league ?? null,
        unknownTeams: unknown,
        lastErrors: last.errors ?? [],
      },
      status === "red",
    );
  } catch (e) {
    return NextResponse.json(
      { status: "red", reason: String(e) },
      { status: 500, headers: NO_STORE },
    );
  }
}
