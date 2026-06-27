// ============================================================================
// Adaptador de API-Football (API-SPORTS) -> nuestros tipos de dominio.
// ----------------------------------------------------------------------------
// Docs: https://www.api-football.com/documentation-v3
// Auth: cabecera `x-apisports-key`. SOLO servidor (la key nunca llega al cliente).
// Plan Free ~100 req/día: cada método informa cuántas peticiones gastó.
// ============================================================================

import type { MatchStage, MatchStatus } from "@/types";
import { teamIdFromName } from "@/lib/data/team-aliases";
import type {
  LeagueSeason,
  MatchDetail,
  ProviderCall,
  ProviderFixture,
  RateLimit,
  ResultsProvider,
  TeamLineup,
  MatchEvent,
  TeamStat,
} from "./types";

const BASE = "https://v3.football.api-sports.io";
const SEASON = 2026; // año del torneo; la LIGA se resuelve dinámicamente.
const MAX_RETRIES = 3; // reintentos ante errores temporales (red / 5xx / 429)

function key(): string {
  const k = process.env.APIFOOTBALL_KEY;
  if (!k) throw new Error("Falta APIFOOTBALL_KEY (solo servidor)");
  return k;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readRateLimit(res: Response): RateLimit {
  const num = (h: string): number | null => {
    const v = res.headers.get(h);
    return v == null || v === "" ? null : Number(v);
  };
  return {
    remaining: num("x-ratelimit-requests-remaining"),
    limit: num("x-ratelimit-requests-limit"),
  };
}

// Normaliza el campo `errors` de la respuesta (objeto vacío, objeto o array).
function normalizeErrors(errors: unknown): string[] {
  if (!errors) return [];
  if (Array.isArray(errors)) return errors.map(String).filter(Boolean);
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map(String)
      .filter(Boolean);
  }
  return [String(errors)];
}

async function get<T = unknown>(
  path: string,
): Promise<{ response: T[]; errors: string[]; rateLimit?: RateLimit }> {
  let lastErr = "desconocido";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(500 * attempt); // backoff: 0, 500ms, 1000ms
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "x-apisports-key": key() },
        cache: "no-store",
      });
      // 5xx y 429 (rate limit) son temporales: reintentar.
      if (res.status >= 500 || res.status === 429) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const rateLimit = readRateLimit(res);
      if (!res.ok) {
        return { response: [], errors: [`HTTP ${res.status}`], rateLimit };
      }
      const json = (await res.json()) as { response?: T[]; errors?: unknown };
      return {
        response: json.response ?? [],
        errors: normalizeErrors(json.errors),
        rateLimit,
      };
    } catch (e) {
      // Error de red / timeout: reintentar.
      lastErr = String(e);
    }
  }
  return { response: [], errors: [`tras ${MAX_RETRIES} intentos: ${lastErr}`] };
}

// --- Mapeos del proveedor a nuestro dominio -------------------------------

function roundToStage(round: string): MatchStage {
  const r = round.toLowerCase();
  if (r.includes("group")) return "group";
  if (r.includes("round of 32") || r.includes("1/16")) return "round32";
  if (r.includes("round of 16") || r.includes("1/8")) return "round16";
  if (r.includes("quarter")) return "quarterfinal";
  if (r.includes("semi")) return "semifinal";
  if (r.includes("3rd place") || r.includes("third")) return "third_place";
  if (r.includes("final")) return "final";
  return "group";
}

function shortToStatus(short: string): MatchStatus {
  const live = ["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"];
  const done = ["FT", "AET", "PEN"];
  if (done.includes(short)) return "finished";
  if (live.includes(short)) return "live";
  return "scheduled";
}

interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
}

function mapFixture(f: ApiFixture): ProviderFixture {
  return {
    externalId: f.fixture.id,
    stage: roundToStage(f.league.round),
    group: null, // el grupo se infiere por el par de equipos en nuestro lado
    homeTeamId: teamIdFromName(f.teams.home.name),
    awayTeamId: teamIdFromName(f.teams.away.name),
    homeName: f.teams.home.name,
    awayName: f.teams.away.name,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    status: shortToStatus(f.fixture.status.short),
    kickoff: f.fixture.date,
  };
}

interface ApiLeague {
  league: { id: number; name: string; type: string };
  seasons: { year: number; current: boolean }[];
}

export const apiFootball: ResultsProvider = {
  name: "API-Football",

  async resolveLeagueSeason(): Promise<ProviderCall<LeagueSeason | null>> {
    // Buscamos la Copa del Mundo (de SELECCIONES) sin hardcodear el id.
    // Cuidado: existen varias "World Cup" — Mundial de clubes, femenino,
    // clasificación, sub-XX, olímpico… Hay que descartarlas y quedarnos con el
    // Mundial masculino de selecciones (en API-Football es la liga id 1).
    const { response, errors, rateLimit } = await get<ApiLeague>(
      "/leagues?search=World%20Cup",
    );

    const EXCLUDE =
      /club|women|female|girls|qualif|olympic|youth|u-?\d|amateur|beach|futsal/i;

    const candidates = response.filter(
      (l) =>
        l.league.type === "Cup" &&
        /world cup/i.test(l.league.name) &&
        !EXCLUDE.test(l.league.name) &&
        l.seasons.some((s) => s.year === SEASON),
    );

    // Puntuación: nombre exacto "World Cup" mejor; a igualdad, menor id.
    const best = candidates
      .map((l) => ({
        l,
        score:
          (/^world cup$/i.test(l.league.name.trim()) ? 100 : 0) -
          l.league.id / 1000,
      }))
      .sort((a, b) => b.score - a.score)[0]?.l;

    const data = best ? { leagueId: best.league.id, season: SEASON } : null;
    return { data, requests: 1, errors, rateLimit };
  },

  async fetchAllFixtures(ls): Promise<ProviderCall<ProviderFixture[]>> {
    const { response, errors, rateLimit } = await get<ApiFixture>(
      `/fixtures?league=${ls.leagueId}&season=${ls.season}`,
    );
    return { data: response.map(mapFixture), requests: 1, errors, rateLimit };
  },

  async fetchLiveFixtures(ls): Promise<ProviderCall<ProviderFixture[]>> {
    const { response, errors, rateLimit } = await get<ApiFixture>(
      `/fixtures?league=${ls.leagueId}&season=${ls.season}&live=all`,
    );
    return { data: response.map(mapFixture), requests: 1, errors, rateLimit };
  },

  async fetchFixtureDetail(externalId): Promise<ProviderCall<MatchDetail>> {
    const [lineups, events, stats] = await Promise.all([
      get<ApiLineup>(`/fixtures/lineups?fixture=${externalId}`),
      get<ApiEvent>(`/fixtures/events?fixture=${externalId}`),
      get<ApiStat>(`/fixtures/statistics?fixture=${externalId}`),
    ]);
    const errors = [...lineups.errors, ...events.errors, ...stats.errors];
    const data: MatchDetail = {
      lineups: lineups.response.map(mapLineup),
      events: events.response.map(mapEvent),
      statistics: stats.response.map(mapStat),
    };
    return {
      data,
      requests: 3,
      errors,
      rateLimit: stats.rateLimit ?? events.rateLimit ?? lineups.rateLimit,
    };
  },
};

// --- Detalle de partido: tipos crudos y mapeo ------------------------------

interface ApiLineup {
  team: { id: number; name: string };
  formation: string | null;
  coach: { name: string | null } | null;
  startXI: { player: ApiLineupPlayer }[];
  substitutes: { player: ApiLineupPlayer }[];
}
interface ApiLineupPlayer {
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null;
}
interface ApiEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { name: string };
  player: { name: string | null };
  assist: { name: string | null };
  type: string;
  detail: string;
}
interface ApiStat {
  team: { name: string };
  statistics: { type: string; value: string | number | null }[];
}

function mapLineup(l: ApiLineup): TeamLineup {
  const player = (p: ApiLineupPlayer) => ({
    name: p.name,
    number: p.number ?? null,
    pos: p.pos ?? null,
    grid: p.grid ?? null,
  });
  return {
    teamId: teamIdFromName(l.team.name),
    teamName: l.team.name,
    formation: l.formation ?? null,
    coach: l.coach?.name ?? null,
    startXI: (l.startXI ?? []).map((x) => player(x.player)),
    substitutes: (l.substitutes ?? []).map((x) => player(x.player)),
  };
}

function mapEvent(e: ApiEvent): MatchEvent {
  return {
    minute: e.time.elapsed ?? 0,
    extra: e.time.extra ?? null,
    teamId: teamIdFromName(e.team.name),
    teamName: e.team.name,
    player: e.player?.name ?? null,
    assist: e.assist?.name ?? null,
    type: e.type,
    detail: e.detail,
  };
}

function mapStat(s: ApiStat): TeamStat {
  return {
    teamId: teamIdFromName(s.team.name),
    teamName: s.team.name,
    stats: (s.statistics ?? []).map((x) => ({ type: x.type, value: x.value })),
  };
}
