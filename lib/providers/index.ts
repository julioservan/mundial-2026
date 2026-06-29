// Selector del proveedor de datos. Para cambiar de proveedor, importa otro
// adaptador que implemente `ResultsProvider` y expórtalo aquí como `provider`.
// El resto de la app (poller, backfill) solo importa `provider` desde aquí.
import type { ResultsProvider } from "./types";
import { apiFootball } from "./api-football";

export const provider: ResultsProvider = apiFootball;

export type {
  ResultsProvider,
  ProviderFixture,
  LeagueSeason,
  ProviderCall,
  MatchDetail,
  TeamLineup,
  LineupPlayer,
  MatchEvent,
  TeamStat,
  TopScorer,
  PlayerRating,
  MatchPreview,
  PreviewPrediction,
  PreviewForm,
  H2HMatch,
  InjuryItem,
} from "./types";
