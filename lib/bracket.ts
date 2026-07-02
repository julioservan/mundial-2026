// ============================================================================
// Motor de eliminatoria (puro y testeable). Resuelve qué equipos ocupan cada
// llave y propaga los ganadores ronda a ronda, dejando "TBD" donde no se sepa.
// ----------------------------------------------------------------------------
// Fuentes, por prioridad, para los equipos de cada partido:
//   1. `assignments` — equipos REALES publicados por el proveedor (API-Football),
//      persistidos en `mundial_fixtures`. Es la verdad oficial.
//   2. Propagación — ganador/perdedor de la ronda anterior cuando ya hay marcador.
//   3. `seed` (solo R32) — PROYECCIÓN a partir de los clasificados de la fase de
//      grupos (ver lib/data/bracket-layout.ts). Es orientativa hasta que el
//      proveedor publique los cruces oficiales.
//
// Los marcadores vienen de `mundial_results` (igual que el resto de la app).
// El árbol de progresión es secuencial (1&2→A, 3&4→B…); cuando el proveedor
// publica los cruces reales, esos equipos mandan sobre la proyección.
// ============================================================================

import type { MatchStage, MatchStatus } from "@/types";
import type { ResultMap } from "@/lib/fifa";

export interface KnockoutSlots {
  round32: string[]; // 16 ids, en orden
  round16: string[]; // 8
  quarterfinal: string[]; // 4
  semifinal: string[]; // 2
  third_place: string; // 1
  final: string; // 1
}

export interface SlotAssignment {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  status?: MatchStatus;
  externalId?: number | null;
  // Hora real del partido desde el feed (las de eliminatoria del calendario
  // estático son solo placeholders hasta que se conoce el cruce).
  kickoff?: string | null;
  // Marcador del feed (en vivo, o final CON prórroga al terminar). Ojo:
  // mundial_results guarda el resultado a los 90' (el que puntúa), que en un
  // partido con prórroga NO dice quién pasó; para eso está este.
  homeScore?: number | null;
  awayScore?: number | null;
  // Tanda de penales (feed): desempata cuando el marcador queda igualado.
  penHome?: number | null;
  penAway?: number | null;
}

export interface BracketMatch {
  id: string;
  stage: MatchStage;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  // Tanda de penales, si la hubo (para mostrarla y para decidir el ganador).
  homePen: number | null;
  awayPen: number | null;
  winnerTeamId: string | null;
  /** Etiqueta de origen cuando el equipo aún no se conoce (p. ej. "G16avos 3"). */
  homeFrom: string | null;
  awayFrom: string | null;
  /** true si los equipos provienen de la proyección, no del proveedor oficial. */
  projected: boolean;
}

export interface BracketInput {
  slots: KnockoutSlots;
  results: ResultMap;
  assignments?: Record<string, SlotAssignment>;
  /** Proyección R32: matchId -> { home, away } (ids nuestros). */
  seed?: Record<string, { home: string | null; away: string | null }>;
}

function scoreOf(results: ResultMap, id: string): { h: number | null; a: number | null } {
  const r = results[id];
  if (!r) return { h: null, a: null };
  const h = Number(r.home);
  const a = Number(r.away);
  return { h: Number.isNaN(h) ? null : h, a: Number.isNaN(a) ? null : a };
}

function decide(
  home: string | null,
  away: string | null,
  h: number | null,
  a: number | null,
  penH: number | null = null,
  penA: number | null = null,
): { winner: string | null; loser: string | null } {
  if (home == null || away == null || h == null || a == null) {
    return { winner: null, loser: null };
  }
  // Empate: en eliminatorias se resuelve con la tanda de penales (si la
  // conocemos); si no, el ganador queda pendiente.
  if (h === a) {
    if (penH == null || penA == null || penH === penA) {
      return { winner: null, loser: null };
    }
    return penH > penA
      ? { winner: home, loser: away }
      : { winner: away, loser: home };
  }
  return h > a
    ? { winner: home, loser: away }
    : { winner: away, loser: home };
}

export function computeBracket(input: BracketInput): {
  byStage: Record<MatchStage, BracketMatch[]>;
  byId: Record<string, BracketMatch>;
  champion: string | null;
} {
  const { slots, results } = input;
  const assignments = input.assignments ?? {};
  const seed = input.seed ?? {};
  const byId: Record<string, BracketMatch> = {};

  function build(
    id: string,
    stage: MatchStage,
    fallbackHome: string | null,
    fallbackAway: string | null,
    homeFrom: string | null,
    awayFrom: string | null,
    projectedHint: boolean,
  ): BracketMatch {
    const asg = assignments[id];
    // Prioridad: proveedor oficial > propagación/seed.
    const home = asg?.homeTeamId ?? fallbackHome ?? null;
    const away = asg?.awayTeamId ?? fallbackAway ?? null;
    const projected =
      projectedHint && !(asg?.homeTeamId || asg?.awayTeamId);
    const { h, a } = scoreOf(results, id);
    // Marcador a mostrar y con el que decidir: el del feed (final con prórroga)
    // si existe; si no, el oficial de results (que es el de los 90').
    const sh = asg?.homeScore ?? null;
    const sa = asg?.awayScore ?? null;
    const dh = sh != null && sa != null ? sh : h;
    const da = sh != null && sa != null ? sa : a;
    const penH = asg?.penHome ?? null;
    const penA = asg?.penAway ?? null;
    // El ganador solo se decide con el partido terminado (el snapshot del feed
    // también trae marcadores EN VIVO, que no deben propagar a nadie).
    const decisive = asg?.status == null || asg.status === "finished";
    const { winner } = decide(
      home,
      away,
      decisive ? dh : null,
      decisive ? da : null,
      penH,
      penA,
    );
    const status: MatchStatus =
      asg?.status ?? (winner ? "finished" : "scheduled");
    const m: BracketMatch = {
      id,
      stage,
      homeTeamId: home,
      awayTeamId: away,
      homeScore: dh,
      awayScore: da,
      homePen: penH,
      awayPen: penA,
      status,
      winnerTeamId: winner,
      homeFrom: home ? null : homeFrom,
      awayFrom: away ? null : awayFrom,
      projected,
    };
    byId[id] = m;
    return m;
  }

  // --- Dieciseisavos (R32): equipos desde proveedor o proyección (seed). ---
  const r32 = slots.round32.map((id) => {
    const s = seed[id];
    return build(
      id,
      "round32",
      s?.home ?? null,
      s?.away ?? null,
      `1.º/2.º/3.º grupo`,
      `1.º/2.º/3.º grupo`,
      Boolean(s),
    );
  });

  // --- Octavos (R16): ganadores de pares consecutivos de R32. ---
  const r16 = slots.round16.map((id, i) => {
    const hSrc = r32[2 * i];
    const aSrc = r32[2 * i + 1];
    return build(
      id,
      "round16",
      hSrc?.winnerTeamId ?? null,
      aSrc?.winnerTeamId ?? null,
      `Ganador ${stageNum("16avos", 2 * i + 1)}`,
      `Ganador ${stageNum("16avos", 2 * i + 2)}`,
      Boolean(hSrc?.projected || aSrc?.projected),
    );
  });

  // --- Cuartos. ---
  const qf = slots.quarterfinal.map((id, i) => {
    const hSrc = r16[2 * i];
    const aSrc = r16[2 * i + 1];
    return build(
      id,
      "quarterfinal",
      hSrc?.winnerTeamId ?? null,
      aSrc?.winnerTeamId ?? null,
      `Ganador ${stageNum("Octavos", 2 * i + 1)}`,
      `Ganador ${stageNum("Octavos", 2 * i + 2)}`,
      Boolean(hSrc?.projected || aSrc?.projected),
    );
  });

  // --- Semifinales. ---
  const sf = slots.semifinal.map((id, i) => {
    const hSrc = qf[2 * i];
    const aSrc = qf[2 * i + 1];
    return build(
      id,
      "semifinal",
      hSrc?.winnerTeamId ?? null,
      aSrc?.winnerTeamId ?? null,
      `Ganador ${stageNum("Cuartos", 2 * i + 1)}`,
      `Ganador ${stageNum("Cuartos", 2 * i + 2)}`,
      Boolean(hSrc?.projected || aSrc?.projected),
    );
  });

  // --- Tercer puesto: perdedores de las semifinales. ---
  // El ganador ya viene decidido en cada BracketMatch (con prórroga y penales
  // incluidos); el perdedor es, simplemente, el otro equipo.
  const winnerLoser = (m?: BracketMatch) => {
    if (!m?.winnerTeamId) return { winner: null, loser: null };
    return {
      winner: m.winnerTeamId,
      loser: m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId,
    };
  };
  const sf0 = winnerLoser(sf[0]);
  const sf1 = winnerLoser(sf[1]);
  const third = build(
    slots.third_place,
    "third_place",
    sf0.loser,
    sf1.loser,
    "Perdedor Semifinal 1",
    "Perdedor Semifinal 2",
    Boolean(sf[0]?.projected || sf[1]?.projected),
  );

  // --- Final: ganadores de las semifinales. ---
  const final = build(
    slots.final,
    "final",
    sf0.winner,
    sf1.winner,
    "Ganador Semifinal 1",
    "Ganador Semifinal 2",
    Boolean(sf[0]?.projected || sf[1]?.projected),
  );

  return {
    byStage: {
      group: [],
      round32: r32,
      round16: r16,
      quarterfinal: qf,
      semifinal: sf,
      third_place: [third],
      final: [final],
    },
    byId,
    champion: final.winnerTeamId,
  };
}

function stageNum(label: string, n: number): string {
  return `${label} ${n}`;
}
