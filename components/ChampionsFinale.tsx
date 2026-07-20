"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { getTeam } from "@/lib/data/teams";
import { Avatar } from "@/components/Avatar";
import type { LiveLeaderboardEntry } from "@/lib/leaderboard";

// ============================================================================
// Home especial de fin de Mundial: hero con parallax 3D y confetti, podio de
// la quiniela con contadores animados, ranking con barras que se llenan al
// hacer scroll y tabla de aciertos por partido. Todo respeta
// prefers-reduced-motion (los keyframes se apagan desde globals.css).
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

// --- Utilidades de animación ------------------------------------------------

// ¿El elemento ya entró en pantalla? (dispara barras y contadores una vez)
function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Número que cuenta de 0 al valor cuando `go` se activa.
function CountUp({
  value,
  go,
  duration = 1300,
  suffix = "",
}: {
  value: number;
  go: boolean;
  duration?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!go) return;
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, value, duration]);
  return (
    <>
      {display}
      {suffix}
    </>
  );
}

// --- Confetti ----------------------------------------------------------------

const CONFETTI_COLORS = [
  "var(--accent)",
  "var(--pink)",
  "var(--cyan)",
  "var(--amber)",
  "var(--violet)",
  "#ffffff",
];

// Lluvia permanente y tranquila; delay negativo = ya está cayendo al entrar.
const CONFETTI = Array.from({ length: 140 }, (_, i) => ({
  left: (i * 31) % 100,
  delay: -(((i * 47) % 700) / 100),
  duration: 7 + ((i * 29) % 50) / 10,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 7 + (i % 6) * 2,
  round: i % 3 === 0,
  drift: ((i * 53) % 220) - 110,
  spin: 540 + ((i * 67) % 540),
}));

// Ráfaga extra al hacer clic en el hero: rápida y de una sola pasada.
const BURST = Array.from({ length: 50 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 13) % 40) / 100,
  duration: 1.6 + ((i * 29) % 14) / 10,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 8 + (i % 6) * 2,
  round: i % 2 === 0,
  drift: ((i * 71) % 260) - 130,
  spin: 720 + ((i * 67) % 720),
}));

function ConfettiLayer({
  pieces,
  loop,
}: {
  pieces: typeof CONFETTI;
  loop: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10" aria-hidden>
      {pieces.map((c, i) => (
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
              animationIterationCount: loop ? "infinite" : 1,
              "--dx": `${c.drift}px`,
              "--spin": `${c.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// --- Podio: estilos oro / plata / bronce ------------------------------------

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

  const byAccuracy = board
    .filter((e) => e.predictionsScored > 0)
    .map((e) => ({ ...e, acc: e.correct / e.predictionsScored }))
    .sort((a, b) => b.acc - a.acc || b.correct - a.correct);
  const bestAcc = byAccuracy[0] ?? null;

  // Parallax 3D del hero: en escritorio lo inclina el ratón; en el móvil, el
  // GIROSCOPIO (inclinar el teléfono inclina la tarjeta, como una ventana).
  const heroRef = useRef<HTMLElement | null>(null);
  function onHeroMove(ev: MouseEvent<HTMLElement>) {
    const el = heroRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width - 0.5;
    const py = (ev.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 7).toFixed(2)}deg`);
  }
  function onHeroLeave() {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  // Giroscopio (solo pantallas táctiles): la primera lectura fija la postura
  // "neutra" de la mano y se inclina en relativo, con topes suaves.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) return; // escritorio: ratón
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let base: { b: number; g: number } | null = null;
    const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
    const handler = (e: DeviceOrientationEvent) => {
      const el = heroRef.current;
      if (!el || e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      const rx = clamp((e.beta - base.b) / 6, 6);
      const ry = clamp((e.gamma - base.g) / 6, 8);
      el.style.setProperty("--rx", `${(-rx).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  // Clic en el hero = ráfaga extra de confetti (remonta la capa con otra key).
  // En iOS el giroscopio exige permiso tras un gesto: se pide con el primer
  // toque, aprovechando el del confetti (en Android no hace falta).
  const [burst, setBurst] = useState(0);
  const gyroAsked = useRef(false);
  function onHeroClick() {
    setBurst((b) => b + 1);
    const D = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof D?.requestPermission === "function" && !gyroAsked.current) {
      gyroAsked.current = true;
      D.requestPermission().catch(() => {});
    }
  }

  // Secciones que animan al entrar en pantalla.
  const { ref: podiumRef, inView: podiumIn } = useInView<HTMLDivElement>(0.3);
  const { ref: standingsRef, inView: standingsIn } =
    useInView<HTMLDivElement>(0.2);
  const { ref: accRef, inView: accIn } = useInView<HTMLDivElement>(0.2);

  // Barra con relleno animado (se llena al entrar en pantalla, escalonada).
  const bar = (pct: number, color: string, on: boolean, idx: number) => (
    <div
      className="h-full rounded-full"
      style={{
        width: on ? `${pct}%` : "0%",
        background: color,
        transition: `width 1.1s cubic-bezier(0.22, 1, 0.36, 1) ${idx * 90}ms`,
      }}
    />
  );

  return (
    <div style={{ perspective: "1200px" }}>
      {/* ---- Campeona del Mundo ---- */}
      <section
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
        onClick={onHeroClick}
        title="🎉 Toca para más confetti"
        className="relative overflow-hidden bg-surface border border-border rounded-3xl px-6 py-10 sm:py-14 text-center mb-10 cursor-pointer select-none"
        style={{
          transform:
            "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          transformStyle: "preserve-3d",
          transition: "transform 0.18s ease-out",
        }}
      >
        {/* Halo de luz que respira, en los colores de la marca */}
        <div
          className="finale-glow absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(196,245,56,0.16), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(255,92,138,0.10), transparent 70%)",
          }}
        />
        <ConfettiLayer pieces={CONFETTI} loop />
        {burst > 0 && <ConfettiLayer key={burst} pieces={BURST} loop={false} />}

        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          <div
            className="finale-in text-[11px] font-semibold tracking-[0.3em] uppercase text-amber mb-5"
            style={{ animationDelay: "0.05s" }}
          >
            🏆 Mundial 2026 · Se acabó
          </div>
          <div
            className="finale-in mb-3"
            style={{ animationDelay: "0.25s", transform: "translateZ(50px)" }}
          >
            <span className="finale-float inline-block text-6xl sm:text-7xl leading-none" aria-hidden>
              {champ?.flag ?? "🏆"}
            </span>
          </div>
          <h2
            className="finale-in text-5xl sm:text-7xl font-bold tracking-tight"
            style={{ animationDelay: "0.45s", transform: "translateZ(34px)" }}
          >
            <span className="font-display finale-shimmer">
              {champ?.name ?? "—"}
            </span>
          </h2>
          <div
            className="finale-in text-lg sm:text-xl font-semibold tracking-tight mt-2"
            style={{ animationDelay: "0.65s" }}
          >
            Campeona del Mundo
          </div>
          <p
            className="finale-in text-sm text-muted-foreground mt-3"
            style={{ animationDelay: "0.8s" }}
          >
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
          <div
            className="finale-in flex items-center justify-center gap-3 sm:gap-6 mt-6 text-sm flex-wrap"
            style={{ animationDelay: "0.95s", transform: "translateZ(18px)" }}
          >
            <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5 transition-transform hover:scale-105">
              <span aria-hidden>🥇</span>
              <span aria-hidden>{champ?.flag}</span>
              <span className="font-semibold">{champ?.name}</span>
            </span>
            {silver && (
              <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5 transition-transform hover:scale-105">
                <span aria-hidden>🥈</span>
                <span aria-hidden>{silver.flag}</span>
                <span className="font-semibold">{silver.name}</span>
              </span>
            )}
            {bronze && (
              <span className="inline-flex items-center gap-1.5 bg-surface-muted border border-border rounded-full px-3 py-1.5 transition-transform hover:scale-105">
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
          <div
            className="finale-in text-center mb-6"
            style={{ animationDelay: "1.1s" }}
          >
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-1">
              — La quiniela
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Campeón de{" "}
              <span className="font-display text-accent">pronósticos</span>
            </h2>
          </div>
          <div
            ref={podiumRef}
            className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto"
          >
            {podium.map(({ e, rank }) => {
              const style = PODIUM[rank - 1];
              const isMe = e.userId === meId;
              const first = rank === 1;
              // El 2.º entra primero, luego el 3.º y el 1.º al final (clímax).
              const entryDelay = first ? "1.7s" : rank === 2 ? "1.25s" : "1.45s";
              return (
                <div
                  key={e.userId}
                  className={`finale-in relative overflow-hidden border ${style.ring} ${style.bg} rounded-2xl text-center px-2 sm:px-4 transition-transform duration-300 hover:-translate-y-1.5 ${
                    first ? "pt-8 pb-6 sm:pt-10" : "pt-5 pb-4"
                  }`}
                  style={{ animationDelay: entryDelay }}
                >
                  {/* Destello dorado que barre al campeón */}
                  {first && (
                    <div
                      className="finale-shine absolute inset-y-0 w-1/3 pointer-events-none"
                      aria-hidden
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(252,211,77,0.22), transparent)",
                      }}
                    />
                  )}
                  {first && (
                    <div className="finale-float absolute -top-1 inset-x-0 text-3xl" aria-hidden>
                      👑
                    </div>
                  )}
                  <div className={`flex justify-center mb-2 ${first ? "mt-4" : ""}`}>
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
                    {isMe && <span className="text-accent font-bold"> · tú</span>}
                  </div>
                  <div
                    className={`font-display leading-none mt-1 tabular-nums ${
                      first ? "text-5xl text-accent" : "text-3xl"
                    }`}
                  >
                    <CountUp value={e.points} go={podiumIn} />
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

      {/* ---- Clasificación final ---- */}
      {board.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xl font-bold tracking-tight mb-4">
            Clasificación final
          </h3>
          <div
            ref={standingsRef}
            className="bg-surface border border-border rounded-2xl p-4 space-y-1"
          >
            {board.map((e, idx) => {
              const isMe = e.userId === meId;
              const pct = maxPoints > 0 ? (e.points / maxPoints) * 100 : 0;
              return (
                <div
                  key={e.userId}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted/50"
                >
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
                        <CountUp value={e.points} go={standingsIn} />
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-surface-muted overflow-hidden"
                      role="img"
                      aria-label={`${e.username}: ${e.points} puntos`}
                    >
                      {bar(pct, "var(--accent)", standingsIn, idx)}
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
          <div
            ref={accRef}
            className="bg-surface border border-border rounded-2xl p-4 space-y-1"
          >
            {byAccuracy.map((e, idx) => {
              const isMe = e.userId === meId;
              return (
                <div
                  key={e.userId}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-muted/50"
                >
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
                          <CountUp
                            value={Math.round(e.acc * 100)}
                            go={accIn}
                            suffix="%"
                          />
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
                      {bar(e.acc * 100, "var(--cyan)", accIn, idx)}
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
