"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchStage } from "@/types";
import { KNOCKOUT_SLOTS } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";
import { stageLabel } from "@/lib/utils/format";

type Side = "home" | "away";
type Picks = Record<string, Side>;

interface SimMatch {
  id: string;
  stage: MatchStage;
  home: string | null;
  away: string | null;
}

interface SimRound {
  stage: MatchStage;
  label: string;
  matches: SimMatch[];
}

const STORAGE_KEY = "wc2026:simulador";

// Orden fijo de los 31 cruces (sin 3er puesto) para codificar el estado.
const ORDER: string[] = [
  ...KNOCKOUT_SLOTS.round32,
  ...KNOCKOUT_SLOTS.round16,
  ...KNOCKOUT_SLOTS.quarterfinal,
  ...KNOCKOUT_SLOTS.semifinal,
  KNOCKOUT_SLOTS.final,
];

// --- Codificación compacta del estado para compartir (2 bits por cruce) ----
function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function encodePicks(picks: Picks): string {
  const bytes = new Uint8Array(Math.ceil((ORDER.length * 2) / 8));
  ORDER.forEach((id, idx) => {
    const v = picks[id] === "home" ? 1 : picks[id] === "away" ? 2 : 0;
    const i = idx * 2;
    if (v & 1) bytes[i >> 3] |= 1 << (i & 7);
    if (v & 2) bytes[(i + 1) >> 3] |= 1 << ((i + 1) & 7);
  });
  return toB64url(bytes);
}
function decodePicks(s: string): Picks {
  try {
    const bytes = fromB64url(s);
    const picks: Picks = {};
    ORDER.forEach((id, idx) => {
      const i = idx * 2;
      const b0 = (bytes[i >> 3] >> (i & 7)) & 1;
      const b1 = (bytes[(i + 1) >> 3] >> ((i + 1) & 7)) & 1;
      const v = b0 | (b1 << 1);
      if (v === 1) picks[id] = "home";
      else if (v === 2) picks[id] = "away";
    });
    return picks;
  } catch {
    return {};
  }
}

// Estado inicial: del enlace (?b=) o de localStorage. Devuelve {} en servidor.
function readInitialPicks(): Picks {
  if (typeof window === "undefined") return {};
  const param = new URLSearchParams(window.location.search).get("b");
  if (param) return decodePicks(param);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Picks;
  } catch {
    // sin estado guardado
  }
  return {};
}

export function SimuladorBracket() {
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>(
    {},
  );
  const [picks, setPicks] = useState<Picks>(readInitialPicks);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Equipos reales de 16avos desde el feed. Al resolver (o fallar) marcamos
  // hidratado para pintar el cuadro real solo en cliente y evitar desajustes.
  useEffect(() => {
    let active = true;
    fetchFixtureAssignments()
      .then((a) => {
        if (active) setAssignments(a);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: Picks) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora si no hay almacenamiento
    }
  }, []);

  const winnerOf = useCallback(
    (m: SimMatch): string | null => {
      if (!m.home || !m.away) return null;
      const p = picks[m.id];
      return p === "home" ? m.home : p === "away" ? m.away : null;
    },
    [picks],
  );

  // Construye las rondas propagando los ganadores elegidos.
  const rounds = useMemo<SimRound[]>(() => {
    const r32: SimMatch[] = KNOCKOUT_SLOTS.round32.map((id) => {
      const a = assignments[id];
      return {
        id,
        stage: "round32",
        home: a?.homeTeamId ?? null,
        away: a?.awayTeamId ?? null,
      };
    });
    const next = (
      ids: string[],
      stage: MatchStage,
      prev: SimMatch[],
    ): SimMatch[] =>
      ids.map((id, i) => ({
        id,
        stage,
        home: prev[2 * i] ? winnerOf(prev[2 * i]) : null,
        away: prev[2 * i + 1] ? winnerOf(prev[2 * i + 1]) : null,
      }));

    const r16 = next(KNOCKOUT_SLOTS.round16, "round16", r32);
    const qf = next(KNOCKOUT_SLOTS.quarterfinal, "quarterfinal", r16);
    const sf = next(KNOCKOUT_SLOTS.semifinal, "semifinal", qf);
    const fin = next([KNOCKOUT_SLOTS.final], "final", sf);

    return [
      { stage: "round32", label: "16avos", matches: r32 },
      { stage: "round16", label: "Octavos", matches: r16 },
      { stage: "quarterfinal", label: "Cuartos", matches: qf },
      { stage: "semifinal", label: "Semis", matches: sf },
      { stage: "final", label: "Final", matches: fin },
    ];
  }, [assignments, winnerOf]);

  const champion = winnerOf(rounds[4].matches[0]);
  const championTeam = getTeam(champion);

  const pickedCount = ORDER.filter((id) => picks[id]).length;

  function choose(m: SimMatch, side: Side) {
    if (!m.home || !m.away) return;
    setPicks((prev) => {
      const next = { ...prev, [m.id]: side };
      persist(next);
      return next;
    });
  }

  function reset() {
    setPicks({});
    persist({});
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  async function share() {
    const url = `${window.location.origin}/simulador?b=${encodePicks(picks)}`;
    window.history.replaceState(null, "", `/simulador?b=${encodePicks(picks)}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // si no se puede copiar, al menos queda en la URL
    }
  }

  if (!hydrated) {
    return (
      <div className="h-64 rounded-2xl bg-surface border border-border animate-pulse" />
    );
  }

  return (
    <div>
      {/* Campeón + acciones */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏆
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Tu campeón
            </div>
            <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {championTeam ? (
                <>
                  <span aria-hidden>{championTeam.flag}</span>
                  {championTeam.name}
                </>
              ) : (
                <span className="text-muted-foreground">Por decidir</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={share}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
          >
            {copied ? "¡Enlace copiado!" : "Compartir"}
          </button>
          <button
            onClick={reset}
            disabled={pickedCount === 0}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-muted-foreground hover:bg-surface-muted transition-colors disabled:opacity-40"
          >
            Reiniciar
          </button>
        </div>
      </div>

      {/* Cuadro (scroll horizontal en móvil) */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {rounds.map((round) => (
            <div
              key={round.stage}
              className="flex flex-col justify-around gap-3 w-[180px] shrink-0"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center sticky top-16">
                {round.label}
              </div>
              {round.matches.map((m) => {
                const winner = winnerOf(m);
                return (
                  <div
                    key={m.id}
                    className="bg-surface border border-border rounded-xl overflow-hidden text-sm"
                  >
                    <TeamRow
                      teamId={m.home}
                      selected={picks[m.id] === "home"}
                      isWinner={winner != null && winner === m.home}
                      disabled={!m.home || !m.away}
                      onClick={() => choose(m, "home")}
                    />
                    <div className="h-px bg-border" />
                    <TeamRow
                      teamId={m.away}
                      selected={picks[m.id] === "away"}
                      isWinner={winner != null && winner === m.away}
                      disabled={!m.home || !m.away}
                      onClick={() => choose(m, "away")}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* Campeón al final del cuadro */}
          <div className="flex flex-col justify-around w-[150px] shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent text-center">
              Campeón
            </div>
            <div className="bg-surface border border-accent/50 rounded-xl p-3 text-center">
              <div className="text-3xl leading-none" aria-hidden>
                {championTeam?.flag ?? "🏆"}
              </div>
              <div className="text-sm font-bold tracking-tight mt-1 truncate">
                {championTeam?.name ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4">
        Toca el equipo que crees que pasa en cada cruce; el cuadro avanza solo
        hasta el campeón. Tu quiniela se guarda en este navegador y puedes
        compartirla con el botón. {pickedCount}/{ORDER.length} cruces elegidos.
      </p>
    </div>
  );
}

function TeamRow({
  teamId,
  selected,
  isWinner,
  disabled,
  onClick,
}: {
  teamId: string | null;
  selected: boolean;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const team = getTeam(teamId);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors disabled:cursor-default ${
        selected || isWinner
          ? "bg-accent/15 font-semibold"
          : "hover:bg-surface-muted disabled:hover:bg-transparent"
      }`}
    >
      <span className="text-base shrink-0" aria-hidden>
        {team?.flag ?? "•"}
      </span>
      <span
        className={`truncate ${team ? "" : "text-muted-foreground/60 text-xs"}`}
      >
        {team?.name ?? "Por definir"}
      </span>
      {(selected || isWinner) && (
        <span className="ml-auto text-accent text-xs shrink-0" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}

// Etiqueta legible de la ronda (reutiliza el formateador del proyecto).
export function roundLabel(stage: MatchStage): string {
  return stageLabel(stage);
}
