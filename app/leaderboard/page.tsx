import { LEADERBOARD } from "@/lib/data/leaderboard";

export const metadata = {
  title: "Ranking · Mundial 2026",
};

const MEDAL_COLORS = ["text-accent", "text-cyan", "text-pink"];

export default function LeaderboardPage() {
  const sorted = [...LEADERBOARD].sort((a, b) => b.points - a.points);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tabla
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          El{" "}
          <span className="font-display text-accent">ranking.</span>
        </h1>
        <p className="text-muted-foreground mt-4">
          Tabla de líderes. Se actualiza cuando los partidos terminen.
        </p>
      </header>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-5 py-3 w-12">#</th>
              <th className="text-left px-5 py-3">Usuario</th>
              <th className="text-center px-3 py-3 w-16">Exact.</th>
              <th className="text-center px-3 py-3 w-16">Gan.</th>
              <th className="text-right px-5 py-3 w-20">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => (
              <tr
                key={entry.userId}
                className="border-t border-border/60 hover:bg-surface-muted/40"
              >
                <td className="px-5 py-4">
                  <span
                    className={`font-display text-2xl leading-none ${
                      MEDAL_COLORS[idx] ?? "text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold tracking-tight">
                  {entry.username}
                </td>
                <td className="px-3 py-4 text-center tabular-nums text-muted-foreground">
                  {entry.exactScores}
                </td>
                <td className="px-3 py-4 text-center tabular-nums text-muted-foreground">
                  {entry.correctOutcomes}
                </td>
                <td className="px-5 py-4 text-right font-display text-2xl text-accent tabular-nums">
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-muted-foreground text-center">
        Los puntos aparecerán cuando los partidos comiencen el{" "}
        <span className="text-foreground">11 de junio</span>.
      </p>
    </div>
  );
}
