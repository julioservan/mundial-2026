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
  ProviderCall,
  ProviderFixture,
  ResultsProvider,
} from "./types";

const BASE = "https://v3.football.api-sports.io";
const SEASON = 2026; // año del torneo; la LIGA se resuelve dinámicamente.

function key(): string {
  const k = process.env.APIFOOTBALL_KEY;
  if (!k) throw new Error("Falta APIFOOTBALL_KEY (solo servidor)");
  return k;
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
): Promise<{ response: T[]; errors: string[] }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key() },
    cache: "no-store",
  });
  if (!res.ok) {
    return { response: [], errors: [`HTTP ${res.status}`] };
  }
  const json = (await res.json()) as {
    response?: T[];
    errors?: unknown;
  };
  return {
    response: json.response ?? [],
    errors: normalizeErrors(json.errors),
  };
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
    // Buscamos la Copa del Mundo sin hardcodear el id; filtramos por nombre,
    // tipo "Cup" y disponibilidad de la temporada del torneo.
    const { response, errors } = await get<ApiLeague>(
      "/leagues?search=World%20Cup",
    );
    const match = response.find(
      (l) =>
        l.league.type === "Cup" &&
        /world cup/i.test(l.league.name) &&
        !/women|qualif|u-?\d/i.test(l.league.name) &&
        l.seasons.some((s) => s.year === SEASON),
    );
    const data = match ? { leagueId: match.league.id, season: SEASON } : null;
    return { data, requests: 1, errors };
  },

  async fetchAllFixtures(ls): Promise<ProviderCall<ProviderFixture[]>> {
    const { response, errors } = await get<ApiFixture>(
      `/fixtures?league=${ls.leagueId}&season=${ls.season}`,
    );
    return { data: response.map(mapFixture), requests: 1, errors };
  },

  async fetchLiveFixtures(ls): Promise<ProviderCall<ProviderFixture[]>> {
    const { response, errors } = await get<ApiFixture>(
      `/fixtures?league=${ls.leagueId}&season=${ls.season}&live=all`,
    );
    return { data: response.map(mapFixture), requests: 1, errors };
  },
};
