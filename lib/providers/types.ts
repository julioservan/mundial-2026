// ============================================================================
// Contrato del proveedor de datos externo, en NUESTROS tipos de dominio.
// ----------------------------------------------------------------------------
// Toda la app habla con esta interfaz; el proveedor concreto (API-Football) se
// elige en lib/providers/index.ts. Para cambiar de proveedor basta con escribir
// otro adaptador que implemente `ResultsProvider` y referenciarlo allí.
// ============================================================================

import type { MatchStage, MatchStatus } from "@/types";

export interface LeagueSeason {
  leagueId: number;
  season: number;
}

// Un partido tal y como lo entendemos nosotros, ya mapeado desde el proveedor.
export interface ProviderFixture {
  externalId: number;
  stage: MatchStage; // "group" | "round32" | ... | "final"
  group: string | null; // "A".."L" o null en eliminatorias
  homeTeamId: string | null; // id nuestro, o null si no se reconoce/TBD
  awayTeamId: string | null;
  homeName: string | null; // nombre crudo del proveedor (diagnóstico)
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoff: string; // ISO 8601
}

// Límite de cuota informado por el PROPIO proveedor (cabeceras de la respuesta),
// como red de seguridad además de nuestro contador interno.
export interface RateLimit {
  remaining: number | null; // peticiones que te quedan hoy
  limit: number | null; // tope diario del plan
}

// Resultado de cualquier llamada: datos + nº de peticiones consumidas + errores
// (el campo `errors` de API-Football: cuota agotada, parámetros, etc.).
export interface ProviderCall<T> {
  data: T;
  requests: number;
  errors: string[];
  rateLimit?: RateLimit;
}

// --- Detalle de un partido (alineaciones, eventos, estadísticas) ----------

export interface LineupPlayer {
  id: number | null; // id del proveedor (para casar foto desde players)
  name: string;
  number: number | null;
  pos: string | null; // G/D/M/F
  grid: string | null; // "fila:columna" para dibujar la formación
}

export interface TeamLineup {
  teamId: string | null; // id nuestro
  teamName: string;
  formation: string | null; // p. ej. "4-3-3"
  coach: string | null;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface MatchEvent {
  minute: number;
  extra: number | null;
  teamId: string | null;
  teamName: string;
  player: string | null;
  playerId: number | null; // id del proveedor (para casar foto)
  assist: string | null;
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string; // "Normal Goal" | "Yellow Card" | ...
}

export interface TeamStat {
  teamId: string | null;
  teamName: string;
  stats: { type: string; value: string | number | null }[];
}

// Valoración de un jugador en el partido (para el MVP / mejor del partido).
export interface PlayerRating {
  id: number | null; // id del proveedor (para casar foto en eventos/alineaciones)
  name: string;
  photo: string | null;
  teamId: string | null;
  teamName: string;
  rating: number; // 0-10 (API-Football)
  goals: number;
  assists: number;
}

export interface MatchDetail {
  lineups: TeamLineup[];
  events: MatchEvent[];
  statistics: TeamStat[];
  // Valoraciones de jugadores (para el MVP). Opcional: aparece al jugarse.
  players?: PlayerRating[];
  // Previa (pronóstico, forma, cara a cara, bajas). Opcional: solo pre-partido.
  preview?: MatchPreview | null;
}

// --- Previa del partido (pronóstico, forma, H2H, bajas) -------------------

export interface PreviewPrediction {
  homePct: number; // probabilidad de victoria local (0-100)
  drawPct: number;
  awayPct: number;
  advice: string | null; // "consejo" de la API
  winnerName: string | null; // favorito según la API
  winnerComment: string | null;
}

export interface PreviewForm {
  home: string; // racha reciente, p. ej. "WWDLW" (V/E/D)
  away: string;
}

export interface H2HMatch {
  date: string; // ISO
  homeName: string;
  awayName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

export interface InjuryItem {
  teamId: string | null;
  teamName: string;
  player: string;
  reason: string; // motivo, p. ej. "Knee Injury", "Suspended"
  type: string; // "Missing Fixture" | "Questionable"
}

export interface MatchPreview {
  prediction: PreviewPrediction | null;
  form: PreviewForm | null;
  h2h: H2HMatch[];
  injuries: InjuryItem[];
}

// --- Goleadores (Bota de Oro) ---------------------------------------------

export interface TopScorer {
  name: string;
  teamId: string | null; // selección, mapeada a nuestro id
  teamName: string;
  photo: string | null;
  goals: number;
  assists: number;
  penalties: number;
}

export interface ResultsProvider {
  readonly name: string;
  // Resuelve liga+temporada del Mundial 2026 (NO se hardcodea; se cachea).
  resolveLeagueSeason(): Promise<ProviderCall<LeagueSeason | null>>;
  // Todos los partidos de la liga/temporada (para backfill y sync general).
  fetchAllFixtures(ls: LeagueSeason): Promise<ProviderCall<ProviderFixture[]>>;
  // Solo partidos en juego ahora mismo (barato, para ventanas activas).
  fetchLiveFixtures(ls: LeagueSeason): Promise<ProviderCall<ProviderFixture[]>>;
  // Detalle de un partido por su id externo (3 llamadas: 11s, eventos, stats).
  fetchFixtureDetail(externalId: number): Promise<ProviderCall<MatchDetail>>;
  // Previa: pronóstico + forma + cara a cara (1 llamada) y bajas (1 llamada).
  fetchMatchPreview(externalId: number): Promise<ProviderCall<MatchPreview>>;
  // Máximos goleadores de la liga/temporada (Bota de Oro).
  fetchTopScorers(ls: LeagueSeason): Promise<ProviderCall<TopScorer[]>>;
}
