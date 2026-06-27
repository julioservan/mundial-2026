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
  assist: string | null;
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string; // "Normal Goal" | "Yellow Card" | ...
}

export interface TeamStat {
  teamId: string | null;
  teamName: string;
  stats: { type: string; value: string | number | null }[];
}

export interface MatchDetail {
  lineups: TeamLineup[];
  events: MatchEvent[];
  statistics: TeamStat[];
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
  // Máximos goleadores de la liga/temporada (Bota de Oro).
  fetchTopScorers(ls: LeagueSeason): Promise<ProviderCall<TopScorer[]>>;
}
