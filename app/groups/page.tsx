import { GROUPS, teamsByGroup } from "@/lib/data/teams";

export const metadata = {
  title: "Grupos · Mundialistas2026",
};

const GROUP_TINTS = [
  "from-accent/10",
  "from-cyan/10",
  "from-pink/10",
  "from-violet/10",
  "from-amber/10",
  "from-accent/10",
  "from-cyan/10",
  "from-pink/10",
  "from-violet/10",
  "from-amber/10",
  "from-accent/10",
  "from-cyan/10",
];

const GROUP_ACCENTS = [
  "text-accent",
  "text-cyan",
  "text-pink",
  "text-violet",
  "text-amber",
  "text-accent",
  "text-cyan",
  "text-pink",
  "text-violet",
  "text-amber",
  "text-accent",
  "text-cyan",
];

export default function GroupsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-12">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Fase 1
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          Los 12{" "}
          <span className="font-display text-accent">grupos.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          48 equipos en 12 grupos de 4. Los 2 primeros y los 8 mejores terceros
          avanzan a dieciseisavos.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {GROUPS.map((group, idx) => {
          const teams = teamsByGroup(group);
          const tint = GROUP_TINTS[idx];
          const accent = GROUP_ACCENTS[idx];
          return (
            <div
              key={group}
              className={`bg-gradient-to-b ${tint} to-surface border border-border rounded-2xl overflow-hidden`}
            >
              <div className="px-5 py-4 flex items-baseline justify-between border-b border-border">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Grupo
                  </span>
                  <span className={`font-display text-4xl ${accent}`}>
                    {group}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  4 equipos
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium"></th>
                    <th className="text-center px-1 py-2 font-medium w-7">PJ</th>
                    <th className="text-center px-1 py-2 font-medium w-7">GF</th>
                    <th className="text-center px-1 py-2 font-medium w-7">GC</th>
                    <th className="text-right px-5 py-2 font-medium w-10">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr
                      key={team.id}
                      className="border-t border-border/60 hover:bg-surface-muted/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl" aria-hidden>
                            {team.flag}
                          </span>
                          <span className="font-semibold tracking-tight">
                            {team.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-center text-muted-foreground tabular-nums">
                        0
                      </td>
                      <td className="text-center text-muted-foreground tabular-nums">
                        0
                      </td>
                      <td className="text-center text-muted-foreground tabular-nums">
                        0
                      </td>
                      <td className="text-right px-5 font-bold tabular-nums">
                        0
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
