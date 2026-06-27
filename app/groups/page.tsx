import { GroupsStandings } from "@/components/GroupsStandings";
import { ThirdPlaceTable } from "@/components/ThirdPlaceTable";
import { DataFreshness } from "@/components/DataFreshness";

export const metadata = {
  title: "Grupos · Mundialistas2026",
};

export default function GroupsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-12">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Fase 1
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          Los 12 <span className="font-display text-accent">grupos.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          Clasificación en directo según los resultados. Los 2 primeros (y los 8
          mejores terceros) avanzan a dieciseisavos.
        </p>
        <div className="mt-5">
          <DataFreshness />
        </div>
      </header>

      <GroupsStandings />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight mb-5">
          La pelea por los <span className="font-display text-accent">terceros</span>
        </h2>
        <ThirdPlaceTable />
      </section>
    </div>
  );
}
