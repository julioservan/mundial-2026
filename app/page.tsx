import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { MatchCard } from "@/components/MatchCard";
import { TeamMarquee } from "@/components/TeamMarquee";
import { GROUP_MATCHES } from "@/lib/data/matches";

const STATS = [
  {
    label: "Equipos",
    value: "48",
    note: "histórico",
    color: "text-accent",
    rotate: "-rotate-1",
  },
  {
    label: "Grupos",
    value: "12",
    note: "de 4",
    color: "text-cyan",
    rotate: "rotate-1",
  },
  {
    label: "Partidos",
    value: "104",
    note: "en 39 días",
    color: "text-pink",
    rotate: "-rotate-1",
  },
  {
    label: "Sedes",
    value: "16",
    note: "ciudades",
    color: "text-violet",
    rotate: "rotate-1",
  },
];

export default function HomePage() {
  const upcomingMatches = GROUP_MATCHES.slice(0, 6);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-20 sm:pt-20 sm:pb-28 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.15em] uppercase text-accent border border-accent/30 bg-accent-soft px-3 py-1.5 rounded-full mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                11 junio · Estadio Azteca
              </div>
              <h1 className="text-5xl sm:text-7xl lg:text-[7.5rem] font-bold tracking-[-0.04em] leading-[0.9]">
                Predice
                <br />
                el{" "}
                <span className="font-display text-accent">mundial.</span>
              </h1>
              <p className="text-lg text-muted-foreground mt-8 max-w-md leading-relaxed">
                48 equipos. 104 partidos. Una quiniela.{" "}
                <span className="text-foreground">¿Tienes ojo futbolero?</span>{" "}
                Demuéstralo.
              </p>
              <div className="flex flex-wrap gap-3 mt-10">
                <Link
                  href="/predictions"
                  className="group inline-flex items-center gap-2 px-6 py-3.5 bg-accent text-accent-foreground font-semibold rounded-full hover:bg-accent-bold transition-colors"
                >
                  Empezar a predecir
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                    →
                  </span>
                </Link>
                <Link
                  href="/matches"
                  className="inline-flex items-center px-6 py-3.5 border border-border-strong font-semibold rounded-full hover:bg-surface transition-colors"
                >
                  Ver calendario
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 lg:justify-self-end">
              <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3">
                — Faltan
              </div>
              <Countdown />
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden>🇲🇽</span>
                <span>MEX</span>
                <span className="font-mono">vs</span>
                <span aria-hidden>🇿🇦</span>
                <span>RSA</span>
                <span className="text-muted-foreground/50">·</span>
                <span>Partido inaugural · 11 jun · Azteca</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEAM TICKER */}
      <TeamMarquee />

      {/* STATS — sticker style */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
            El torneo en{" "}
            <span className="font-display text-accent">cifras</span>
          </h2>
          <span className="hidden sm:block text-xs text-muted-foreground tracking-widest uppercase">
            — 2026
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className={`group bg-surface border border-border rounded-2xl p-6 sm:p-8 transition-transform hover:rotate-0 ${stat.rotate}`}
            >
              <div
                className={`font-display text-7xl sm:text-8xl leading-none ${stat.color}`}
              >
                {stat.value}
              </div>
              <div className="mt-4">
                <div className="font-bold text-lg tracking-tight">
                  {stat.label}
                </div>
                <div className="text-xs text-muted-foreground tracking-wide uppercase mt-0.5">
                  {stat.note}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* UPCOMING MATCHES */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-2">
              — Próximos
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Partidos{" "}
              <span className="font-display">de apertura</span>
            </h2>
          </div>
          <Link
            href="/matches"
            className="text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-accent text-accent-foreground rounded-3xl p-10 sm:p-16 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-[20rem] leading-none opacity-10 select-none" aria-hidden>
              ⚽
            </div>
            <div className="relative max-w-xl">
              <h3 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
                Compite con tus{" "}
                <span className="font-display">amigos.</span>
              </h3>
              <p className="mt-4 text-lg opacity-80">
                Crea tu cuenta, predice cada partido y sube en el ranking. Solo
                uno se lleva la gloria.
              </p>
              <Link
                href="/predictions"
                className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 bg-background text-foreground font-semibold rounded-full hover:bg-surface transition-colors"
              >
                Empezar ahora
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
