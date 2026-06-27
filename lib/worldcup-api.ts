import { GROUP_MATCHES } from "@/lib/data/matches";
import { NAME_TO_ID } from "@/lib/data/team-aliases";

// Adaptador LEGACY: API pública worldcup26.ir (datos del Mundial 2026).
// El proveedor principal ahora es API-Football (lib/providers/). Esto se
// conserva como respaldo opcional y mapea por grupo + equipos.

const API_URL = "https://worldcup26.ir/get/games";

// Índice de nuestros partidos de grupo por grupo + pareja de equipos.
const matchByTeams = new Map<
  string,
  { id: string; home: string; away: string }
>();
for (const m of GROUP_MATCHES) {
  if (!m.homeTeamId || !m.awayTeamId || !m.group) continue;
  const key = `${m.group}|${[m.homeTeamId, m.awayTeamId].sort().join("-")}`;
  matchByTeams.set(key, { id: m.id, home: m.homeTeamId, away: m.awayTeamId });
}

interface ApiGame {
  group?: string;
  type?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_score?: string;
  away_score?: string;
  home_scorers?: string;
  away_scorers?: string;
  finished?: string; // "TRUE" | "FALSE"
  time_elapsed?: string; // "notstarted" | "live" | "finished" | minuto
}

export interface MappedGame {
  matchId: string;
  home: number; // goles del LOCAL nuestro (orientación corregida)
  away: number;
  finished: boolean;
  live: boolean;
  status: string;
  homeScorers: string[];
  awayScorers: string[];
}

// Los goleadores vienen como un texto tipo {"R. Jiménez 67'","..."} con
// comillas variadas; lo limpiamos y separamos en una lista.
function parseScorers(raw?: string): string[] {
  if (!raw || raw.toLowerCase() === "null") return [];
  return raw
    .replace(/[{}"“”„\\]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function fetchWorldCupGames(): Promise<ApiGame[]> {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return (data?.games ?? []) as ApiGame[];
}

// Mapea un partido de la API a uno nuestro, corrigiendo la orientación
// local/visitante por identidad de equipo.
function mapGame(game: ApiGame): MappedGame | null {
  if (game.type !== "group" || !game.group) return null;
  const apiHome = game.home_team_name_en
    ? NAME_TO_ID[game.home_team_name_en]
    : undefined;
  const apiAway = game.away_team_name_en
    ? NAME_TO_ID[game.away_team_name_en]
    : undefined;
  if (!apiHome || !apiAway) return null;

  const key = `${game.group}|${[apiHome, apiAway].sort().join("-")}`;
  const ours = matchByTeams.get(key);
  if (!ours) return null;

  const hs = Number(game.home_score ?? 0);
  const as = Number(game.away_score ?? 0);
  if (Number.isNaN(hs) || Number.isNaN(as)) return null;

  // Orientación: si nuestro local coincide con el local de la API, directo.
  const sameOrientation = ours.home === apiHome;
  const hScorers = parseScorers(game.home_scorers);
  const aScorers = parseScorers(game.away_scorers);
  return {
    matchId: ours.id,
    home: sameOrientation ? hs : as,
    away: sameOrientation ? as : hs,
    finished: String(game.finished).toUpperCase() === "TRUE",
    live: game.time_elapsed === "live",
    status: game.time_elapsed ?? "",
    homeScorers: sameOrientation ? hScorers : aScorers,
    awayScorers: sameOrientation ? aScorers : hScorers,
  };
}

// Todos los partidos de grupo mapeados (para buscar uno concreto).
export function mapAllGames(games: ApiGame[]): MappedGame[] {
  return games.map(mapGame).filter((g): g is MappedGame => g !== null);
}

// Solo los partidos TERMINADOS (para guardar como resultado oficial).
export function mapFinishedResults(games: ApiGame[]): MappedGame[] {
  return games
    .map(mapGame)
    .filter((g): g is MappedGame => g !== null && g.finished);
}

// Partidos en juego o terminados, para mostrar el marcador en vivo.
export function mapLiveScores(games: ApiGame[]): MappedGame[] {
  return games
    .map(mapGame)
    .filter((g): g is MappedGame => g !== null && (g.live || g.finished));
}
