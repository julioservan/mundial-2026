"use client";

import type { Team } from "@/types";
import type {
  MatchDetail,
  TeamLineup,
  LineupPlayer,
  MatchEvent,
  TeamStat,
} from "@/lib/providers";

interface Props {
  detail: MatchDetail;
  homeId: string | null;
  awayId: string | null;
  home?: Team;
  away?: Team;
}

// Icono según el tipo de evento.
function eventIcon(e: MatchEvent): string {
  const t = e.type.toLowerCase();
  if (t === "goal") return e.detail === "Own Goal" ? "🥅" : "⚽";
  if (t === "card") return e.detail === "Red Card" ? "🟥" : "🟨";
  if (t === "subst") return "🔁";
  if (t === "var") return "📺";
  return "•";
}

function minuteLabel(e: MatchEvent): string {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

function Timeline({
  events,
  homeId,
}: {
  events: MatchEvent[];
  homeId: string | null;
}) {
  if (events.length === 0) return null;
  const sorted = [...events].sort(
    (a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0),
  );
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold tracking-tight mb-4">Cronología</h2>
      <ol className="space-y-2">
        {sorted.map((e, i) => {
          const isHome = e.teamId != null && e.teamId === homeId;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 text-sm ${
                isHome ? "" : "flex-row-reverse text-right"
              }`}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                {minuteLabel(e)}
              </span>
              <span className="text-lg shrink-0" aria-hidden>
                {eventIcon(e)}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{e.player ?? "—"}</span>
                {e.type.toLowerCase() === "goal" && e.assist && (
                  <span className="text-muted-foreground"> (asist. {e.assist})</span>
                )}
                {e.type.toLowerCase() === "subst" && e.assist && (
                  <span className="text-muted-foreground"> ◀ {e.assist}</span>
                )}
                {e.type.toLowerCase() === "card" && (
                  <span className="text-muted-foreground"> · {e.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Agrupa el XI por filas de la formación (grid "fila:columna").
function rowsFromGrid(players: LineupPlayer[]): LineupPlayer[][] {
  const byRow = new Map<number, LineupPlayer[]>();
  for (const p of players) {
    const row = p.grid ? Number(p.grid.split(":")[0]) : 0;
    const list = byRow.get(row) ?? [];
    list.push(p);
    byRow.set(row, list);
  }
  // Dentro de cada fila ordena por columna.
  for (const list of byRow.values()) {
    list.sort((a, b) => {
      const ca = a.grid ? Number(a.grid.split(":")[1]) : 0;
      const cb = b.grid ? Number(b.grid.split(":")[1]) : 0;
      return ca - cb;
    });
  }
  return [...byRow.keys()].sort((a, b) => a - b).map((r) => byRow.get(r)!);
}

function Pitch({ lineup, team }: { lineup: TeamLineup; team?: Team }) {
  const hasGrid = lineup.startXI.some((p) => p.grid);
  const rows = hasGrid ? rowsFromGrid(lineup.startXI) : [lineup.startXI];
  // Portero (fila 1) abajo: invertimos para que el ataque quede arriba.
  const display = [...rows].reverse();

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-semibold tracking-tight flex items-center gap-2">
          <span aria-hidden>{team?.flag}</span>
          {team?.name ?? lineup.teamName}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {lineup.formation ?? "—"}
        </span>
      </div>

      {/* Campo */}
      <div className="bg-gradient-to-b from-emerald-900/30 to-emerald-950/20 p-3 space-y-3">
        {display.map((row, ri) => (
          <div key={ri} className="flex justify-around gap-1">
            {row.map((p, pi) => (
              <div key={pi} className="flex flex-col items-center w-16 text-center">
                <span className="w-7 h-7 rounded-full bg-background/80 border border-border flex items-center justify-center text-xs font-bold tabular-nums">
                  {p.number ?? "–"}
                </span>
                <span className="text-[10px] leading-tight mt-1 truncate w-full">
                  {p.name.split(" ").slice(-1)[0]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Suplentes + entrenador */}
      <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
        {lineup.coach && (
          <p className="mb-1">
            <span className="font-semibold text-foreground">DT:</span> {lineup.coach}
          </p>
        )}
        {lineup.substitutes.length > 0 && (
          <p>
            <span className="font-semibold text-foreground">Suplentes:</span>{" "}
            {lineup.substitutes.map((s) => s.name.split(" ").slice(-1)[0]).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

function Lineups({
  lineups,
  homeId,
  home,
  away,
}: {
  lineups: TeamLineup[];
  homeId: string | null;
  home?: Team;
  away?: Team;
}) {
  if (lineups.length === 0) return null;
  // Ordena: local primero.
  const ordered = [...lineups].sort((a) => (a.teamId === homeId ? -1 : 1));
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold tracking-tight mb-4">Alineaciones</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {ordered.map((l, i) => (
          <Pitch key={i} lineup={l} team={l.teamId === homeId ? home : away} />
        ))}
      </div>
    </section>
  );
}

function num(v: string | number | null): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", ""));
  return Number.isNaN(n) ? 0 : n;
}

function Stats({
  statistics,
  homeId,
}: {
  statistics: TeamStat[];
  homeId: string | null;
}) {
  if (statistics.length < 2) return null;
  const homeStat = statistics.find((s) => s.teamId === homeId) ?? statistics[0];
  const awayStat = statistics.find((s) => s !== homeStat) ?? statistics[1];

  const types = homeStat.stats.map((s) => s.type);
  const get = (t: TeamStat, type: string) =>
    t.stats.find((s) => s.type === type)?.value ?? null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold tracking-tight mb-4">Estadísticas</h2>
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
        {types.map((type) => {
          const hv = get(homeStat, type);
          const av = get(awayStat, type);
          const hn = num(hv);
          const an = num(av);
          const total = hn + an || 1;
          return (
            <div key={type}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold tabular-nums">{hv ?? "0"}</span>
                <span className="text-muted-foreground">{type}</span>
                <span className="font-semibold tabular-nums">{av ?? "0"}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-border">
                <div
                  className="bg-accent"
                  style={{ width: `${(hn / total) * 100}%` }}
                />
                <div
                  className="bg-cyan"
                  style={{ width: `${(an / total) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MatchDetailView({ detail, homeId, home, away }: Props) {
  const hasContent =
    detail.events.length > 0 ||
    detail.lineups.length > 0 ||
    detail.statistics.length > 0;
  if (!hasContent) return null;

  return (
    <div>
      <Timeline events={detail.events} homeId={homeId} />
      <Lineups lineups={detail.lineups} homeId={homeId} home={home} away={away} />
      <Stats statistics={detail.statistics} homeId={homeId} />
    </div>
  );
}
