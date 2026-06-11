import { KnockoutBracket } from "@/components/KnockoutBracket";
import { KNOCKOUT_MATCHES } from "@/lib/data/matches";

export const metadata = {
  title: "Eliminatoria · Mundialistas2026",
};

const ROUNDS_SUMMARY = [
  { label: "16avos", count: 16, date: "28 jun – 3 jul", color: "text-cyan" },
  { label: "Octavos", count: 8, date: "4 – 7 jul", color: "text-violet" },
  { label: "Cuartos", count: 4, date: "9 – 11 jul", color: "text-pink" },
  { label: "Semis", count: 2, date: "14 – 15 jul", color: "text-amber" },
  { label: "3er puesto", count: 1, date: "18 jul", color: "text-muted-foreground" },
  { label: "Final", count: 1, date: "19 jul", color: "text-accent" },
];

export default function EliminatoriaPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-12">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Fase 2
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          A vida o{" "}
          <span className="font-display text-accent">muerte.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          32 partidos a eliminación directa. Una derrota y te vas a casa. El
          campeón se decide el 19 de julio en MetLife Stadium.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
        {ROUNDS_SUMMARY.map((round) => (
          <div
            key={round.label}
            className="bg-surface border border-border rounded-2xl p-5"
          >
            <div className={`font-display text-5xl leading-none ${round.color}`}>
              {round.count}
            </div>
            <div className="mt-3 font-bold text-sm tracking-tight">
              {round.label}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-wide uppercase mt-0.5">
              {round.date}
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            El <span className="font-display">cuadro</span>
          </h2>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Desliza horizontalmente →
          </p>
        </div>
        <KnockoutBracket matches={KNOCKOUT_MATCHES} />
      </section>

      <section className="mt-16 bg-surface border border-border rounded-2xl p-8 sm:p-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — El camino
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
          Cómo se llega al <span className="font-display text-accent">título</span>
        </h3>
        <ol className="space-y-3 text-sm">
          {[
            ["Fase de grupos", "12 grupos de 4 → avanzan 1º, 2º y los 8 mejores 3º (32 equipos)"],
            ["Dieciseisavos", "16 partidos a un solo encuentro → 16 equipos"],
            ["Octavos", "8 partidos → 8 equipos"],
            ["Cuartos", "4 partidos → 4 equipos"],
            ["Semifinales", "2 partidos → 2 finalistas"],
            ["Final", "Campeón 🏆"],
          ].map(([title, desc], idx) => (
            <li key={title} className="flex gap-4">
              <span className="font-mono text-xs text-muted-foreground tabular-nums w-6 shrink-0 mt-0.5">
                0{idx + 1}
              </span>
              <span>
                <span className="font-semibold">{title}.</span>{" "}
                <span className="text-muted-foreground">{desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
