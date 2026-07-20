"use client";

import type { CSSProperties } from "react";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import type { LiveLeaderboardEntry } from "@/lib/leaderboard";

// ============================================================================
// Home especial de fin de Mundial: campeón del mundo a toda página, podio de
// la quiniela, ranking completo y tabla de aciertos por partido.
// ============================================================================

export interface FinalSummary {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null; // final (con prórroga)
  awayScore: number | null;
  r90Home: number | null; // resultado a los 90'
  r90Away: number | null;
  penHome: number | null;
  penAway: number | null;
}

// Confetti determinista (misma receta que el Simulador; sin Math.random para
// no romper la pureza del render).
const CONFETTI_COLORS = [
  "var(--accent)",
  "var(--pink)",
  "var(--cyan)",
  "var(--amber)",
  "var(--violet)",
  "#ffffff",
];
const CONFETTI = Array.from({ length: 140 }, (_, i) => ({
  left: (i * 31) % 100,
  // Delay NEGATIVO: al abrir la página la lluvia ya está en marcha (cada pieza
  // arranca en un punto distinto de su caída, no todas desde arriba).
  delay: -(((i * 47) % 700) / 100),
  // Caída tranquila (7–12 s); la receta del Simulador (2–4 s) era un vendaval.
  duration: 7 + ((i * 29) % 50) / 10,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 7 + (i % 6) * 2,
  round: i % 3 === 0,
  drift: ((i * 53) % 220) - 110,
  spin: 540 + ((i * 67) % 540),
}));

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10" aria-hidden>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="sim-confetti absolute top-0 block"
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.4,
              background: c.color,
              borderRadius: c.round ? "9999px" : "1px",
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              // A diferencia del Simulador (una sola pasada), aquí la fiesta
              // no para: el confetti cae en bucle mientras mires la página.
              animationIterationCount: "infinite",
              "--dx": `${c.drift}px`,
              "--spin": `${c.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// Estilos del podio de la quiniela: oro / plata / bronce.
const PODIUM = [
  {
    ring: "border-amber/60",
    bg: "bg-gradient-to-b from-amber/15 to-surface",
    medal: "🥇",
  },
  {
    ring: "border-border-strong",
    bg: "bg-gradient-to-b from-white/5 to-surface",
    medal: "🥈",
  },
  {
    ring: "border-pink/40",
    bg: "bg-gradient-to-b from-pink/10 to-surface",
    medal: "🥉",
  },
];

export function ChampionsFinale({
  champion,
  runnerUp,
  third,
  final,
  board,
  meId,
}: {
  champion: string;
  runnerUp: string | null;
  third: string | null;
  final: FinalSummary;
  board: LiveLeaderboardEntry[];
  meId: string | null;
}) {
  const champ = getTeam(champion);
  const silver = getTeam(runnerUp);
  const bronze = getTeam(third);

  const wentExtra =
    final.homeScore != null &&
    final.r90Home != null &&
    (final.homeScore !== final.r90Home || final.awayScore !== final.r90Away);
  const hasPens = final.penHome != null && final.penAway != null;
  const loser = champion === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
  const loserTeam = getTeam(loser);
  // Marcador desde el punto de vista del campeón.
  const champGoals =
    champion === final.homeTeamId ? final.homeScore : final.awayScore;
  const loserGoals =
    champion === final.homeTeamId ? final.awayScore : final.homeScore;
  const champPens = champion === final.homeTeamId ? final.penHome : final.penAway;
  const loserPens = champion === final.homeTeamId ? final.penAway : final.penHome;

  const top3 = board.slice(0, 3);
  // Orden visual del podio: 2.º — 1.º — 3.º.
  const podium = [
    top3[1] ? { e: top3[1], rank: 2 } : null,
    top3[0] ? { e: top3[0], rank: 1 } : null,
    top3[2] ? { e: top3[2], rank: 3 } : null,
  ].filter(Boolean) as { e: LiveLeaderboardEntry; rank: number }[];

  const maxPoints = board[0]?.points ?? 0;

  // Aciertos por partido: % de partidos puntuados acertados (otro campeón).
  const byAccuracy = board
    .filter((e) => e.predictionsScored > 0)
    .map((e) => ({ ...e, acc: e.correct / e.predictionsScored }))
    .sort((a, b) => b.acc - a.acc || b.correct - a.correct);
  const bestAcc = byAccuracy[0] ?? null;

  return (
    <div>
      {/* ---- Campeón del Mundo ---- */}
      <section className="relative overflow-hidden bg-surface border border-border rounded-3xl px-6 py-10 sm:py-14 text-center mb-10">
        <Confetti />
        <div className="relative">
          <div className="text-[11px] font-semibold tracking-[0.3em] uppercase text-amber mb-4">
            🏆 Mundial 2026 · Se acabó
          </div>
          <div className="text-6xl sm:text-7xl leading-none mb-3" aria-hidden>
            {champ?.flag ?? "🏆"}
          </div>
          <h2 className="text-5xl sm:text-7xl font-bold tracking-tight">
            <span className="font-display text-accent">{champ?.name ?? "—"}</span>
          </h2>
          <div className="text-lg sm:text-xl font-semibold tracking-tight mt-2">
            Campeona del Mundo
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {champGoals}–{loserGoals} a {loserTeam?.name ?? "—"} en la final
            {hasPens ? (
              <> · {champPens}–{loserPens} en penales</>
            ) : wentExtra ? (
              <>
                {" "}
                · tras prórroga ({final.r90Home}–{final.r90Away} a los 90&apos;)
              </>
            ) : null}
          </p>

          {/* Podio del torneo */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 mt-6 text-sm flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5">
              <span aria-hidden>🥇</span>
              <span aria-hidden>{champ?.flag}</span>
              <span className="font-semibold">{champ?.name}</span>
            </span>
            {silver && (
              <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5">
                <span aria-hidden>🥈</span>
                <span aria-hidden>{silver.flag}</span>
                <span className="font-semibold">{silver.name}</span>
              </span>
            )}
            {bronze && (
              <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5">
                <span aria-hidden>🥉</span>
                <span aria-hidden>{bronze.flag}</span>
                <span className="font-semibold">{bronze.name}</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ---- Podio de la quiniela ---- */}
      {top3.length > 0 && (
        <section className="mb-10">
          <div className="text-center mb-6">
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-1">
              — La quiniela
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Campeón de <span className="font-display text-accent">pronósticos</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto">
            {podium.map(({ e, rank }) => {
              const style = PODIUM[rank - 1];
              const isMe = e.userId === meId;
              const first = rank === 1;
              return (
                <div
                  key={e.userId}
                  className={`relative border ${style.ring} ${style.bg} rounded-2xl text-center px-2 sm:px-4 ${
                    first ? "pt-8 pb-6 sm:pt-10" : "pt-5 pb-4"
                  }`}
                >
                  {first && (
                    <div
                      className="absolute -top-4 inset-x-0 text-3xl"
                      aria-hidden
                    >
                      👑
                    </div>
                  )}
                  <div className="flex justify-center mb-2">
                    <Avatar
                      url={e.avatarUrl}
                      name={e.username}
                      size={first ? 72 : 52}
                      className={first ? "text-2xl" : "text-lg"}
                    />
                  </div>
                  <div className="text-2xl leading-none mb-1" aria-hidden>
                    {style.medal}
                  </div>
                  <div className="font-semibold tracking-tight truncate">
                    {e.username}
                    {isMe && (
                      <span className="text-accent font-bold"> · tú</span>
                    )}
                  </div>
                  <div
                    className={`font-display leading-none mt-1 ${
                      first ? "text-5xl text-accent" : "text-3xl"
                    }`}
                  >
                    {e.points}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    puntos
                  </div>
                  {first && (
                    <div className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wider text-amber border border-amber/50 rounded-full px-2 py-0.5">
                      Campeón de pronósticos
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Todos los participantes (puntos) ---- */}
      {board.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xl font-bold tracking-tight mb-4">
            Clasificación final
          </h3>
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            {board.map((e, idx) => {
              const isMe = e.userId === meId;
              const pct = maxPoints > 0 ? (e.points / maxPoints) * 100 : 0;
              return (
                <div key={e.userId} className="flex items-center gap-3">
                  <span className="font-display text-lg w-6 text-center text-muted-foreground shrink-0">
                    {idx + 1}
                  </span>
                  <Avatar
                    url={e.avatarUrl}
                    name={e.username}
                    size={28}
                    className="text-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold truncate">
                        {e.username}
                        {isMe && (
                          <span className="text-accent font-bold"> · tú</span>
                        )}
                      </span>
                      <span className="font-display text-lg text-accent tabular-nums shrink-0">
                        {e.points}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-surface-muted overflow-hidden"
                      role="img"
                      aria-label={`${e.username}: ${e.points} puntos`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "var(--accent)" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Aciertos por partido ---- */}
      {byAccuracy.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
            <h3 className="text-xl font-bold tracking-tight">
              Aciertos por partido
            </h3>
          </div>
          {bestAcc && (
            <p className="text-sm text-muted-foreground mb-4">
              El más fino fue{" "}
              <span className="font-semibold text-foreground">
                🎯 {bestAcc.username}
              </span>
              : acertó el {Math.round(bestAcc.acc * 100)}% de sus partidos.
            </p>
          )}
          <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
            {byAccuracy.map((e, idx) => {
              const isMe = e.userId === meId;
              return (
                <div key={e.userId} className="flex items-center gap-3">
                  <span className="font-display text-lg w-6 text-center text-muted-foreground shrink-0">
                    {idx + 1}
                  </span>
                  <Avatar
                    url={e.avatarUrl}
                    name={e.username}
                    size={28}
                    className="text-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold truncate">
                        {e.username}
                        {isMe && (
                          <span className="text-accent font-bold"> · tú</span>
                        )}
                        {idx === 0 && (
                          <span className="ml-1.5" aria-hidden>
                            🎯
                          </span>
                        )}
                      </span>
                      <span className="text-sm tabular-nums shrink-0">
                        <span className="font-bold text-cyan">
                          {Math.round(e.acc * 100)}%
                        </span>{" "}
                        <span className="text-[11px] text-muted-foreground">
                          {e.correct}/{e.predictionsScored}
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-surface-muted overflow-hidden"
                      role="img"
                      aria-label={`${e.username}: ${e.correct} aciertos de ${e.predictionsScored} partidos`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${e.acc * 100}%`,
                          background: "var(--cyan)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
