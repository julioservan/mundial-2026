import { MatchesView } from "@/components/MatchesView";
import { MATCHES } from "@/lib/data/matches";

export const metadata = {
  title: "Calendario de partidos · Mundialistas2026",
};

export default function MatchesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — 11 jun · 19 jul
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          El{" "}
          <span className="font-display text-accent">calendario.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          104 partidos repartidos en 16 ciudades de USA, Canadá y México.
        </p>
      </header>
      <MatchesView matches={MATCHES} />
    </div>
  );
}
