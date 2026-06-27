// ============================================================================
// Motor de sincronización con el proveedor externo (API-Football).
// ----------------------------------------------------------------------------
// Pensado para llamarse desde el cron (/api/sync) y desde el backfill. Cuida la
// cuota del plan gratuito (~100 req/día):
//   · La web NUNCA llama a la API externa: lee de Supabase (snapshot persistido).
//   · Solo consulta "en vivo" durante ventanas de partido activo.
//   · Lleva la cuenta diaria de peticiones; si se agota, no llama y sirve lo
//     último conocido (la UI muestra "datos quizá con retraso").
//   · Resuelve y cachea liga+temporada (no se hardcodean).
// ============================================================================

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { provider, type ProviderFixture } from "@/lib/providers";
import { KNOCKOUT_SLOTS, groupMatchByPair } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";

const DAILY_CAP = Number(process.env.APIFOOTBALL_DAILY_CAP ?? 95);
const FULL_SYNC_INTERVAL_MIN = Number(
  process.env.APIFOOTBALL_FULL_SYNC_MIN ?? 30,
);
// Anti-rebote: ignora llamadas auto/live si la última fue hace menos de esto
// (protege la cuota si el endpoint recibe pings demasiado seguidos).
const MIN_SYNC_INTERVAL_SEC = Number(process.env.APIFOOTBALL_MIN_INTERVAL_SEC ?? 50);
// Goleadores (Bota de Oro): cambia despacio, se refresca como mucho cada X min.
const SCORERS_INTERVAL_MIN = Number(process.env.APIFOOTBALL_SCORERS_MIN ?? 180);
// Un partido se considera "activo" desde 5 min antes hasta 140 min después.
const WINDOW_PRE_MS = 5 * 60_000;
const WINDOW_POST_MS = 140 * 60_000;

export type SyncMode = "auto" | "live" | "full";

export interface SyncSummary {
  ok: boolean;
  mode: SyncMode;
  ranLive: boolean;
  ranFull: boolean;
  requests: number;
  dailyCount: number;
  dailyCap: number;
  fixturesUpserted: number;
  resultsUpserted: number;
  errors: string[];
  note: string;
  providerRemaining: number | null; // cuota que informa el propio proveedor
  unknownTeams: string[]; // nombres del feed que no supimos mapear
}

// --- Metadatos (mundial_meta) ---------------------------------------------

async function getMeta<T>(key: string): Promise<T | null> {
  const { data } = await getSupabaseAdmin()
    .from("mundial_meta")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (data?.value as T) ?? null;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await getSupabaseAdmin()
    .from("mundial_meta")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDailyCount(): Promise<number> {
  const rc = await getMeta<{ date: string; count: number }>("request_count");
  if (!rc || rc.date !== today()) return 0;
  return rc.count;
}

async function addRequests(n: number): Promise<number> {
  const current = await getDailyCount();
  const next = current + n;
  await setMeta("request_count", { date: today(), count: next });
  return next;
}

// --- Liga/temporada (cacheada) --------------------------------------------

// Clave v2: invalida cualquier caché anterior que pudiera haber resuelto la
// liga equivocada (p. ej. el Mundial de clubes).
const LEAGUE_CACHE_KEY = "league_season_v2";

async function ensureLeagueSeason(
  errors: string[],
  refresh = false,
): Promise<{ leagueId: number; season: number } | null> {
  if (!refresh) {
    const cached = await getMeta<{ leagueId: number; season: number }>(
      LEAGUE_CACHE_KEY,
    );
    if (cached) return cached;
  }
  const { data, requests, errors: e } = await provider.resolveLeagueSeason();
  errors.push(...e);
  await addRequests(requests);
  if (data) await setMeta(LEAGUE_CACHE_KEY, data);
  return data;
}

// --- Ventana activa (a partir del calendario estático, sin gastar cuota) ---

export function isActiveWindow(matchKickoffs: string[], now = Date.now()): boolean {
  return matchKickoffs.some((iso) => {
    const k = new Date(iso).getTime();
    return now >= k - WINDOW_PRE_MS && now <= k + WINDOW_POST_MS;
  });
}

// --- Mapeo del feed a nuestras filas --------------------------------------

interface FixtureRow {
  match_id: string;
  external_id: number;
  stage: string;
  group: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff: string;
}

interface ResultRow {
  match_id: string;
  home_score: number;
  away_score: number;
}

// Convierte los partidos del feed en filas para mundial_fixtures (snapshot) y
// mundial_results (marcador final). Las eliminatorias se asignan a nuestras
// llaves por etapa y orden cronológico.
export function mapFixtures(fixtures: ProviderFixture[]): {
  fixtures: FixtureRow[];
  results: ResultRow[];
  unknown: string[];
} {
  const fixtureRows: FixtureRow[] = [];
  const resultRows: ResultRow[] = [];
  const unknown = new Set<string>();

  // Agrupamos las eliminatorias por etapa para asignarlas a nuestros slots.
  const knockoutByStage = new Map<string, ProviderFixture[]>();

  for (const f of fixtures) {
    if (f.stage === "group") {
      // Nombre presente pero sin mapear -> lo anotamos para revisarlo.
      if (f.homeName && !f.homeTeamId) unknown.add(f.homeName);
      if (f.awayName && !f.awayTeamId) unknown.add(f.awayName);
      if (!f.homeTeamId || !f.awayTeamId) continue;
      const ours = groupMatchByPair(f.homeTeamId, f.awayTeamId);
      if (!ours) continue;
      const sameOrientation = ours.home === f.homeTeamId;
      const home = sameOrientation ? f.homeScore : f.awayScore;
      const away = sameOrientation ? f.awayScore : f.homeScore;
      fixtureRows.push({
        match_id: ours.id,
        external_id: f.externalId,
        stage: "group",
        group: groupOf(ours.home),
        home_team_id: ours.home,
        away_team_id: ours.away,
        home_score: home,
        away_score: away,
        status: f.status,
        kickoff: f.kickoff,
      });
      if (f.status === "finished" && home != null && away != null) {
        resultRows.push({ match_id: ours.id, home_score: home, away_score: away });
      }
    } else {
      const list = knockoutByStage.get(f.stage) ?? [];
      list.push(f);
      knockoutByStage.set(f.stage, list);
    }
  }

  // Asignación de eliminatorias a nuestras llaves (orden por kickoff).
  for (const [stage, list] of knockoutByStage) {
    const slots = slotsForStage(stage);
    if (!slots.length) continue;
    list.sort(
      (a, b) =>
        new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime() ||
        a.externalId - b.externalId,
    );
    list.slice(0, slots.length).forEach((f, i) => {
      const id = slots[i];
      fixtureRows.push({
        match_id: id,
        external_id: f.externalId,
        stage,
        group: null,
        home_team_id: f.homeTeamId,
        away_team_id: f.awayTeamId,
        home_score: f.homeScore,
        away_score: f.awayScore,
        status: f.status,
        kickoff: f.kickoff,
      });
      if (f.status === "finished" && f.homeScore != null && f.awayScore != null) {
        resultRows.push({
          match_id: id,
          home_score: f.homeScore,
          away_score: f.awayScore,
        });
      }
    });
  }

  return { fixtures: fixtureRows, results: resultRows, unknown: [...unknown] };
}

function slotsForStage(stage: string): string[] {
  switch (stage) {
    case "round32":
      return KNOCKOUT_SLOTS.round32;
    case "round16":
      return KNOCKOUT_SLOTS.round16;
    case "quarterfinal":
      return KNOCKOUT_SLOTS.quarterfinal;
    case "semifinal":
      return KNOCKOUT_SLOTS.semifinal;
    case "third_place":
      return KNOCKOUT_SLOTS.third_place ? [KNOCKOUT_SLOTS.third_place] : [];
    case "final":
      return KNOCKOUT_SLOTS.final ? [KNOCKOUT_SLOTS.final] : [];
    default:
      return [];
  }
}

// El grupo de un equipo, a partir de su id.
function groupOf(teamId: string): string | null {
  return getTeam(teamId)?.group ?? null;
}

// --- Persistencia ----------------------------------------------------------

async function persist(rows: {
  fixtures: FixtureRow[];
  results: ResultRow[];
}): Promise<{ fixtures: number; results: number; errors: string[] }> {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  if (rows.fixtures.length) {
    const { error } = await supabase
      .from("mundial_fixtures")
      .upsert(
        rows.fixtures.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "match_id" },
      );
    if (error) errors.push(`fixtures: ${error.message}`);
  }
  if (rows.results.length) {
    const { error } = await supabase
      .from("mundial_results")
      .upsert(
        rows.results.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "match_id" },
      );
    if (error) errors.push(`results: ${error.message}`);
  }
  return { fixtures: rows.fixtures.length, results: rows.results.length, errors };
}

// --- Orquestación ----------------------------------------------------------

export async function runSync(
  mode: SyncMode,
  matchKickoffs: string[],
  refresh = false,
): Promise<SyncSummary> {
  const errors: string[] = [];
  let requests = 0;
  let ranLive = false;
  let ranFull = false;
  let fixturesUpserted = 0;
  let resultsUpserted = 0;
  let note = "";
  let providerRemaining: number | null = null;
  let providerLimit: number | null = null;
  const unknownTeams = new Set<string>();

  const dailyBefore = await getDailyCount();

  // Anti-rebote para modos automáticos (no para "full" manual del backfill).
  if (mode !== "full") {
    const last = await getMeta<{ at: string }>("last_sync");
    if (
      last &&
      Date.now() - new Date(last.at).getTime() < MIN_SYNC_INTERVAL_SEC * 1000
    ) {
      return {
        ok: true,
        mode,
        ranLive: false,
        ranFull: false,
        requests: 0,
        dailyCount: dailyBefore,
        dailyCap: DAILY_CAP,
        fixturesUpserted: 0,
        resultsUpserted: 0,
        errors: [],
        note: "Throttled: sincronización muy reciente.",
        providerRemaining: null,
        unknownTeams: [],
      };
    }
  }

  const ls = await ensureLeagueSeason(errors, refresh);
  requests = (await getDailyCount()) - dailyBefore;

  if (!ls) {
    note = "No se pudo resolver liga/temporada del Mundial.";
    const summary = finalize();
    await recordLastSync(summary);
    return summary;
  }

  const active = isActiveWindow(matchKickoffs);
  const lastFull = await getMeta<{ at: string }>("last_full_sync");
  const fullStale =
    !lastFull ||
    Date.now() - new Date(lastFull.at).getTime() >
      FULL_SYNC_INTERVAL_MIN * 60_000;

  const wantFull = mode === "full" || (mode === "auto" && fullStale);
  const wantLive = mode === "live" || (mode === "auto" && active);

  async function capLeft(): Promise<boolean> {
    return (await getDailyCount()) < DAILY_CAP;
  }

  // Sync completa (recoge terminados, nuevos cruces de eliminatoria, etc.).
  if (wantFull) {
    if (await capLeft()) {
      const r = await provider.fetchAllFixtures(ls);
      errors.push(...r.errors);
      await addRequests(r.requests);
      if (r.rateLimit) {
        providerRemaining = r.rateLimit.remaining ?? providerRemaining;
        providerLimit = r.rateLimit.limit ?? providerLimit;
      }
      const rows = mapFixtures(r.data);
      rows.unknown.forEach((u) => unknownTeams.add(u));
      const p = await persist(rows);
      errors.push(...p.errors);
      fixturesUpserted += p.fixtures;
      resultsUpserted += p.results;
      ranFull = true;
      await setMeta("last_full_sync", { at: new Date().toISOString() });

      // Goleadores (Bota de Oro): refresco lento, 1 petición extra.
      const lastScorers = await getMeta<{ at: string }>("last_scorers_sync");
      const scorersStale =
        !lastScorers ||
        Date.now() - new Date(lastScorers.at).getTime() >
          SCORERS_INTERVAL_MIN * 60_000;
      if (scorersStale && (await capLeft())) {
        const sc = await provider.fetchTopScorers(ls);
        errors.push(...sc.errors);
        await addRequests(sc.requests);
        if (sc.rateLimit) {
          providerRemaining = sc.rateLimit.remaining ?? providerRemaining;
          providerLimit = sc.rateLimit.limit ?? providerLimit;
        }
        if (sc.errors.length === 0) {
          await setMeta("top_scorers", {
            at: new Date().toISOString(),
            players: sc.data,
          });
          await setMeta("last_scorers_sync", { at: new Date().toISOString() });
        }
      }
    } else {
      note = "Cuota diaria agotada: se sirve el último dato.";
    }
  }

  // Sync en vivo (barata) durante ventana activa.
  if (wantLive) {
    if (await capLeft()) {
      const r = await provider.fetchLiveFixtures(ls);
      errors.push(...r.errors);
      await addRequests(r.requests);
      if (r.rateLimit) {
        providerRemaining = r.rateLimit.remaining ?? providerRemaining;
        providerLimit = r.rateLimit.limit ?? providerLimit;
      }
      const rows = mapFixtures(r.data);
      rows.unknown.forEach((u) => unknownTeams.add(u));
      const p = await persist(rows);
      errors.push(...p.errors);
      fixturesUpserted += p.fixtures;
      resultsUpserted += p.results;
      ranLive = true;
    } else if (!note) {
      note = "Cuota diaria agotada: se sirve el último dato.";
    }
  }

  if (!ranFull && !ranLive && !note) {
    note = active ? "" : "Fuera de ventana de partidos: sin llamadas.";
  }

  const summary = finalize();
  await recordLastSync(summary);
  return summary;

  function finalize(): SyncSummary {
    return {
      ok: errors.length === 0,
      mode,
      ranLive,
      ranFull,
      requests,
      dailyCount: 0, // se rellena en recordLastSync
      dailyCap: DAILY_CAP,
      fixturesUpserted,
      resultsUpserted,
      errors,
      note,
      providerRemaining,
      unknownTeams: [...unknownTeams],
    };
  }

  async function recordLastSync(s: SyncSummary) {
    const count = await getDailyCount();
    s.dailyCount = count;
    s.requests = requests = count - dailyBefore;
    await setMeta("last_sync", {
      at: new Date().toISOString(),
      ok: s.ok,
      note: s.note,
      requests: s.requests,
      count,
      cap: DAILY_CAP,
      providerRemaining,
      providerLimit,
      errors: s.errors.slice(0, 5),
    });
    // Equipos del feed que no supimos mapear (para revisarlos en el panel).
    if (unknownTeams.size) {
      await setMeta("unknown_teams", {
        at: new Date().toISOString(),
        names: [...unknownTeams],
      });
    }
  }
}
