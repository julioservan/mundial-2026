"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { scorePick, scoreKnockout, winnerOf, type Pick } from "@/lib/scoring";
import type { ProfileLite } from "@/lib/profiles";

// ============================================================================
// Pronósticos de la gente: barra de reparto de votos (1/X/2) + tarjetas por
// opción con cada jugador, su marcador exacto (KO) y, tras el partido, quién
// acertó y cuántos puntos ganó.
// ============================================================================

// Pronóstico de un jugador para un partido, con todo lo que guarda la base:
// ganador (1/X/2), marcador exacto (KO) y "quién pasa" si pronosticó empate.
export interface VoterPick {
  userId: string;
  pick: Pick;
  home: string;
  away: string;
  advance: "home" | "away" | null;
}

export function mapVoterPicks(rows: Record<string, unknown>[]): VoterPick[] {
  return rows
    .filter((r) => r.pick)
    .map((r) => ({
      userId: r.user_id as string,
      pick: r.pick as Pick,
      home: r.home_score != null ? String(r.home_score) : "",
      away: r.away_score != null ? String(r.away_score) : "",
      advance: (r.advance as "home" | "away" | null) ?? null,
    }));
}

type TeamLite = { name: string; flag: string } | null;

// Colores del reparto: los dos polos usan los acentos de la marca (lima/rosa,
// CVD-seguros entre sí) y el empate es gris neutro a propósito — es el punto
// medio. La identidad nunca depende solo del color: cada tarjeta lleva punto
// de color + bandera + nombre, y la barra lleva título por segmento.
const PICK_COLORS: Record<Pick, string> = {
  home: "var(--accent)",
  draw: "var(--muted-foreground)",
  away: "var(--pink)",
};

export function PeoplePicks({
  picks,
  players,
  meId,
  home,
  away,
  knockout,
  result,
  loading,
}: {
  picks: VoterPick[];
  players: Record<string, ProfileLite>;
  meId: string | null;
  home: TeamLite;
  away: TeamLite;
  knockout: boolean;
  result: { home: string; away: string } | null; // solo si terminó
  loading: boolean;
}) {
  const total = picks.length;
  const groups: { key: Pick; team: TeamLite; voters: VoterPick[] }[] = [
    { key: "home", team: home, voters: picks.filter((p) => p.pick === "home") },
    { key: "draw", team: null, voters: picks.filter((p) => p.pick === "draw") },
    { key: "away", team: away, voters: picks.filter((p) => p.pick === "away") },
  ];
  // Resultado que puntúa (a los 90'): marca el grupo ganador y los puntos.
  const actual: Pick | null = result
    ? winnerOf(Number(result.home), Number(result.away))
    : null;

  const pointsOf = (e: VoterPick): number => {
    if (!result) return 0;
    return knockout
      ? scoreKnockout(e.pick, e.home, e.away, result).points
      : scorePick(e.pick, result).points;
  };

  // Titular: favorito de la votación antes del partido; aciertos después.
  let headline: ReactNode = null;
  if (total > 0) {
    if (actual) {
      const hitters = groups.find((g) => g.key === actual)?.voters.length ?? 0;
      headline = (
        <>
          Lo {hitters === 1 ? "acertó" : "acertaron"}{" "}
          <span className="font-semibold text-foreground">{hitters}</span> de{" "}
          {total}.
        </>
      );
    } else {
      const sorted = [...groups].sort(
        (a, b) => b.voters.length - a.voters.length,
      );
      if (sorted[0].voters.length > sorted[1].voters.length) {
        const pct = Math.round((sorted[0].voters.length / total) * 100);
        headline = sorted[0].team ? (
          <>
            La peña va con{" "}
            <span className="font-semibold text-foreground">
              <span aria-hidden>{sorted[0].team.flag}</span>{" "}
              {sorted[0].team.name}
            </span>{" "}
            ({pct}%).
          </>
        ) : (
          <>
            La peña huele{" "}
            <span className="font-semibold text-foreground">empate</span> (
            {pct}%).
          </>
        );
      } else {
        headline = <>Votación repartida: no hay favorito claro.</>;
      }
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight">
          Pronósticos de la gente
        </h2>
        {total > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {total} {total === 1 ? "pronóstico" : "pronósticos"}
          </span>
        )}
      </div>
      {headline && (
        <p className="text-sm text-muted-foreground mt-1">{headline}</p>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando…</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground mt-3">
          Nadie ha pronosticado este partido todavía. ¡Sé el primero!
        </p>
      ) : (
        <>
          {/* Barra de reparto 1/X/2 (el grupo ganador se queda encendido) */}
          <div
            className="flex gap-[3px] h-3 mt-4 mb-4"
            role="img"
            aria-label={groups
              .map(
                (g) =>
                  `${g.team ? `Gana ${g.team.name}` : "Empate"}: ${g.voters.length}`,
              )
              .join(" · ")}
          >
            {groups
              .filter((g) => g.voters.length > 0)
              .map((g) => (
                <div
                  key={g.key}
                  title={`${g.team ? `Gana ${g.team.name}` : "Empate"}: ${g.voters.length} (${Math.round((g.voters.length / total) * 100)}%)`}
                  className="rounded-full transition-opacity"
                  style={{
                    width: `${(g.voters.length / total) * 100}%`,
                    background: PICK_COLORS[g.key],
                    opacity: actual && g.key !== actual ? 0.3 : 1,
                  }}
                />
              ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {groups.map((g) => {
              const isWin = actual === g.key;
              const pct = Math.round((g.voters.length / total) * 100);
              const sortedVoters = [...g.voters].sort((a, b) => {
                if (result) {
                  const d = pointsOf(b) - pointsOf(a);
                  if (d !== 0) return d;
                }
                const an = players[a.userId]?.username ?? "";
                const bn = players[b.userId]?.username ?? "";
                return an.localeCompare(bn, "es", { sensitivity: "base" });
              });
              return (
                <div
                  key={g.key}
                  className={`bg-surface border rounded-2xl p-3 ${
                    isWin ? "border-accent/60" : "border-border"
                  } ${actual && !isWin ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: PICK_COLORS[g.key] }}
                        aria-hidden
                      />
                      {g.team ? (
                        <>
                          <span className="text-sm" aria-hidden>
                            {g.team.flag}
                          </span>
                          <span className="truncate">{g.team.name}</span>
                        </>
                      ) : (
                        <span>Empate</span>
                      )}
                    </div>
                    {isWin && (
                      <span className="text-accent text-[10px] font-bold uppercase tracking-wider shrink-0">
                        ✓ resultado
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="font-display text-3xl leading-none">
                      {g.voters.length}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sortedVoters.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/40">
                        Nadie
                      </span>
                    ) : (
                      sortedVoters.map((v) => (
                        <VoterRow
                          key={v.userId}
                          v={v}
                          p={players[v.userId]}
                          isMe={v.userId === meId}
                          knockout={knockout}
                          points={result ? pointsOf(v) : null}
                          home={home}
                          away={away}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Fila de un jugador: avatar + nombre (+ "tú"), marcador exacto pronosticado
// (KO), "quién pasa" si pronosticó empate y, tras el partido, sus puntos.
function VoterRow({
  v,
  p,
  isMe,
  knockout,
  points,
  home,
  away,
}: {
  v: VoterPick;
  p: ProfileLite | undefined;
  isMe: boolean;
  knockout: boolean;
  points: number | null; // null hasta que haya resultado
  home: TeamLite;
  away: TeamLite;
}) {
  // +4 en KO = clavó también el marcador exacto: fila destacada.
  const exactHit = points != null && points >= 4;
  const advanceTeam =
    v.pick === "draw" && v.advance
      ? v.advance === "home"
        ? home
        : away
      : null;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
        exactHit ? "bg-accent-soft" : ""
      } ${isMe ? "ring-1 ring-accent/40" : ""}`}
    >
      <Avatar
        url={p?.avatar_url ?? null}
        name={p?.username ?? "?"}
        size={20}
        className="text-[7px] shrink-0"
      />
      <span className="text-xs font-medium truncate flex-1 min-w-0">
        {p?.username ?? "?"}
        {isMe && <span className="text-accent font-bold"> · tú</span>}
      </span>
      {knockout && v.home !== "" && v.away !== "" && (
        <span
          title="Marcador pronosticado"
          className={`font-mono text-[11px] tabular-nums border rounded-md px-1.5 py-0.5 shrink-0 ${
            exactHit
              ? "border-accent/60 text-accent font-bold"
              : "border-border text-muted-foreground"
          }`}
        >
          {v.home}–{v.away}
        </span>
      )}
      {advanceTeam && (
        <span
          className="text-[11px] text-muted-foreground shrink-0"
          title={`Si empate, pasa ${advanceTeam.name}`}
          aria-label={`Si empate, pasa ${advanceTeam.name}`}
        >
          →<span aria-hidden>{advanceTeam.flag}</span>
        </span>
      )}
      {points != null &&
        (points > 0 ? (
          <span className="text-[11px] font-bold text-accent shrink-0 tabular-nums">
            +{points}
          </span>
        ) : (
          <span
            className="text-[11px] text-muted-foreground/60 shrink-0"
            aria-label="falló"
          >
            ✗
          </span>
        ))}
    </div>
  );
}
