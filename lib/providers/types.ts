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

// Resultado de cualquier llamada: datos + nº de peticiones consumidas + errores
// (el campo `errors` de API-Football: cuota agotada, parámetros, etc.).
export interface ProviderCall<T> {
  data: T;
  requests: number;
  errors: string[];
}

export interface ResultsProvider {
  readonly name: string;
  // Resuelve liga+temporada del Mundial 2026 (NO se hardcodea; se cachea).
  resolveLeagueSeason(): Promise<ProviderCall<LeagueSeason | null>>;
  // Todos los partidos de la liga/temporada (para backfill y sync general).
  fetchAllFixtures(ls: LeagueSeason): Promise<ProviderCall<ProviderFixture[]>>;
  // Solo partidos en juego ahora mismo (barato, para ventanas activas).
  fetchLiveFixtures(ls: LeagueSeason): Promise<ProviderCall<ProviderFixture[]>>;
}
