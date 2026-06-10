"use client";

import { useEffect, useRef, useState } from "react";
import type { Match } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { LocalTime } from "@/components/LocalTime";

const STORAGE_KEY = "wc2026:predictions";

function loadFromStorage(): Record<string, { home: string; away: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(state: Record<string, { home: string; away: string }>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface Props {
  matches: Match[];
}

export function PredictionForm({ matches }: Props) {
  const [predictions, setPredictions] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [hydrated, setHydrated] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setPredictions(loadFromStorage());
    setHydrated(true);
  }, []);

  function updateScore(
    matchId: string,
    side: "home" | "away",
    value: string,
    inputIndex: number,
  ) {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 2);
    const previous = predictions[matchId]?.[side] ?? "";
    const next = {
      ...predictions,
      [matchId]: {
        home: side === "home" ? sanitized : predictions[matchId]?.home ?? "",
        away: side === "away" ? sanitized : predictions[matchId]?.away ?? "",
      },
    };
    setPredictions(next);
    saveToStorage(next);
    // Salta al siguiente campo al teclear un dígito (no al borrar). Para un
    // marcador de dos cifras basta volver al campo y añadir el segundo dígito.
    if (sanitized.length > previous.length) {
      inputsRef.current[inputIndex + 1]?.focus();
    }
  }

  const completed = hydrated
    ? Object.values(predictions).filter((p) => p.home !== "" && p.away !== "")
        .length
    : 0;
  const progress = matches.length > 0 ? (completed / matches.length) * 100 : 0;

  return (
    <div>
      <div className="bg-surface border border-border rounded-2xl p-5 mb-8 sticky top-16 z-10 backdrop-blur">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Progreso
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl text-accent leading-none">
                {completed}
              </span>
              <span className="text-muted-foreground text-sm">
                / {matches.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm("¿Borrar todas las predicciones?")) {
                setPredictions({});
                saveToStorage({});
              }
            }}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Resetear
          </button>
        </div>
        <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-3">
        {matches.map((match, matchIndex) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          const homeInputIndex = matchIndex * 2;
          const p = predictions[match.id] ?? { home: "", away: "" };
          const filled = p.home !== "" && p.away !== "";

          return (
            <li
              key={match.id}
              className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-colors ${
                filled ? "border-accent/60" : "border-border"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4 flex justify-between font-semibold">
                <span>
                  Grupo {match.group} · J{match.matchday}
                </span>
                <span className="font-mono">
                  <LocalTime iso={match.kickoff} />
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-semibold tracking-tight truncate text-sm sm:text-base">
                    {home?.name}
                  </span>
                  <span className="text-2xl shrink-0" aria-hidden>
                    {home?.flag}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    ref={(el) => {
                      inputsRef.current[homeInputIndex] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={p.home}
                    onChange={(e) =>
                      updateScore(match.id, "home", e.target.value, homeInputIndex)
                    }
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
                    placeholder="—"
                    aria-label={`Goles de ${home?.name}`}
                  />
                  <span className="text-muted-foreground text-xs font-mono">vs</span>
                  <input
                    ref={(el) => {
                      inputsRef.current[homeInputIndex + 1] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={p.away}
                    onChange={(e) =>
                      updateScore(match.id, "away", e.target.value, homeInputIndex + 1)
                    }
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center font-display text-2xl sm:text-3xl bg-background border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
                    placeholder="—"
                    aria-label={`Goles de ${away?.name}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl shrink-0" aria-hidden>
                    {away?.flag}
                  </span>
                  <span className="font-semibold tracking-tight truncate text-sm sm:text-base">
                    {away?.name}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
