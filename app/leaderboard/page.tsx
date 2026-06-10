"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { fetchLeaderboard, type LiveLeaderboardEntry } from "@/lib/leaderboard";

const MEDAL_COLORS = ["text-accent", "text-cyan", "text-pink"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LiveLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchLeaderboard();
        if (active) setEntries(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tabla
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          El <span className="font-display text-accent">ranking.</span>
        </h1>
        <p className="text-muted-foreground mt-4">
          Quién acierta más. Se actualiza al cargar los resultados de los
          partidos. <span className="text-foreground">3 pts</span> marcador
          exacto · <span className="text-foreground">1 pt</span> acertar el
          resultado.
        </p>
      </header>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Cargando ranking…</p>
      ) : error ? (
        <p className="text-center text-pink py-12">No se pudo cargar el ranking.</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          Aún no hay jugadores. ¡Sé el primero en registrarte y predecir!
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 w-12">#</th>
                <th className="text-left px-5 py-3">Jugador</th>
                <th className="text-center px-3 py-3 w-16">Exact.</th>
                <th className="text-center px-3 py-3 w-16">Result.</th>
                <th className="text-right px-5 py-3 w-20">Pts</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
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
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={entry.avatarUrl}
                        name={entry.username}
                        size={32}
                        className="text-sm shrink-0"
                      />
                      <span className="font-semibold tracking-tight truncate">
                        {entry.username}
                      </span>
                    </div>
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
      )}
    </div>
  );
}
