import { TopScorers } from "@/components/TopScorers";
import { DataFreshness } from "@/components/DataFreshness";

export const metadata = {
  title: "Bota de Oro · Mundialistas2026",
};

export default function GoleadoresPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Bota de Oro
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          Los <span className="font-display text-accent">goleadores.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          Máximos goleadores del Mundial 2026, actualizados automáticamente. La
          Bota de Oro la gana quien más goles marque.
        </p>
        <div className="mt-5">
          <DataFreshness />
        </div>
      </header>

      <TopScorers />
    </div>
  );
}
