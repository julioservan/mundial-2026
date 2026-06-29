"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchStage } from "@/types";
import { KNOCKOUT_SLOTS } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";

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

// --- Geometría del cuadro radial -------------------------------------------
const CX = 500;
const CY = 500;
const DEG = Math.PI / 180;
const SEG = 360 / 32; // 32 selecciones alrededor del círculo
// Radios de cada anillo (de fuera hacia dentro).
const R_LEAF = 450; // 32 selecciones
const R_R32 = 358; // 16 ganadores de 16avos
const R_R16 = 268; // 8 ganadores de octavos
const R_QF = 180; // 4 de cuartos
const R_SF = 98; // 2 finalistas
const FLAG_LEAF = 27;
const FLAG_WIN = 20;
const FLAG_CHAMP = 34;

function pos(r: number, deg: number): [number, number] {
  return [CX + r * Math.cos(deg * DEG), CY + r * Math.sin(deg * DEG)];
}

// Conector en codo (polar): radial hacia dentro + arco hasta el ángulo padre.
function elbow(rC: number, aC: number, rP: number, aP: number): string {
  const [x1, y1] = pos(rC, aC);
  const [x2, y2] = pos(rP, aC);
  const [x3, y3] = pos(rP, aP);
  const sweep = aP >= aC ? 1 : 0;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${rP} ${rP} 0 0 ${sweep} ${x3.toFixed(1)} ${y3.toFixed(1)}`;
}

const leafAngle = (k: number) => -90 + (k + 0.5) * SEG;
const avg = (a: number, b: number) => (a + b) / 2;

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

interface BNode {
  id: string;
  x: number;
  y: number;
  r: number;
  teamId: string | null;
  parent: SimMatch | null; // cruce al que alimenta (null = campeón)
  side: Side;
  kind: "leaf" | "win" | "champion";
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
      { stage: "round32", matches: r32 },
      { stage: "round16", matches: r16 },
      { stage: "quarterfinal", matches: qf },
      { stage: "semifinal", matches: sf },
      { stage: "final", matches: fin },
    ];
  }, [assignments, winnerOf]);

  // Posiciona conectores y nodos del cuadro radial.
  const graph = useMemo(() => {
    const r32 = rounds[0].matches; // 16
    const r16 = rounds[1].matches; // 8
    const qf = rounds[2].matches; // 4
    const sf = rounds[3].matches; // 2
    const fin = rounds[4].matches[0];

    const la = Array.from({ length: 32 }, (_, k) => leafAngle(k));
    const a32 = r32.map((_, i) => avg(la[2 * i], la[2 * i + 1]));
    const a16 = r16.map((_, i) => avg(a32[2 * i], a32[2 * i + 1]));
    const aQf = qf.map((_, i) => avg(a16[2 * i], a16[2 * i + 1]));
    const aSf = sf.map((_, i) => avg(aQf[2 * i], aQf[2 * i + 1]));

    const lines: string[] = [];
    r32.forEach((_, i) => {
      lines.push(elbow(R_LEAF, la[2 * i], R_R32, a32[i]));
      lines.push(elbow(R_LEAF, la[2 * i + 1], R_R32, a32[i]));
    });
    r16.forEach((_, i) => {
      lines.push(elbow(R_R32, a32[2 * i], R_R16, a16[i]));
      lines.push(elbow(R_R32, a32[2 * i + 1], R_R16, a16[i]));
    });
    qf.forEach((_, i) => {
      lines.push(elbow(R_R16, a16[2 * i], R_QF, aQf[i]));
      lines.push(elbow(R_R16, a16[2 * i + 1], R_QF, aQf[i]));
    });
    sf.forEach((_, i) => {
      lines.push(elbow(R_QF, aQf[2 * i], R_SF, aSf[i]));
      lines.push(elbow(R_QF, aQf[2 * i + 1], R_SF, aSf[i]));
    });
    // Final: cada semifinalista hacia el centro (líneas horizontales).
    sf.forEach((_, i) => {
      const [x, y] = pos(R_SF, aSf[i]);
      lines.push(`M${x.toFixed(1)} ${y.toFixed(1)} L${CX} ${CY}`);
    });

    const nodes: BNode[] = [];
    const node = (
      id: string,
      r: number,
      ang: number,
      teamId: string | null,
      parent: SimMatch | null,
      side: Side,
      kind: BNode["kind"],
    ): BNode => {
      const [x, y] = pos(r, ang);
      return { id, x, y, r: kind === "leaf" ? FLAG_LEAF : FLAG_WIN, teamId, parent, side, kind };
    };

    // Hojas: las 32 selecciones de 16avos.
    r32.forEach((m, i) => {
      nodes.push(node(`leaf-${2 * i}`, R_LEAF, la[2 * i], m.home, m, "home", "leaf"));
      nodes.push(
        node(`leaf-${2 * i + 1}`, R_LEAF, la[2 * i + 1], m.away, m, "away", "leaf"),
      );
    });
    // Ganadores de cada ronda → alimentan el cruce de la ronda siguiente.
    r32.forEach((m, i) =>
      nodes.push(
        node(`r32-${i}`, R_R32, a32[i], winnerOf(m), r16[i >> 1], i % 2 === 0 ? "home" : "away", "win"),
      ),
    );
    r16.forEach((m, i) =>
      nodes.push(
        node(`r16-${i}`, R_R16, a16[i], winnerOf(m), qf[i >> 1], i % 2 === 0 ? "home" : "away", "win"),
      ),
    );
    qf.forEach((m, i) =>
      nodes.push(
        node(`qf-${i}`, R_QF, aQf[i], winnerOf(m), sf[i >> 1], i % 2 === 0 ? "home" : "away", "win"),
      ),
    );
    sf.forEach((m, i) =>
      nodes.push(
        node(`sf-${i}`, R_SF, aSf[i], winnerOf(m), fin, i % 2 === 0 ? "home" : "away", "win"),
      ),
    );

    return { lines, nodes, champion: winnerOf(fin) };
  }, [rounds, winnerOf]);

  const championTeam = getTeam(graph.champion);
  const pickedCount = ORDER.filter((id) => picks[id]).length;

  function choose(parent: SimMatch, side: Side) {
    if (!parent.home || !parent.away) return;
    setPicks((prev) => {
      const next = { ...prev, [parent.id]: side };
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
    const path = `/simulador?b=${encodePicks(picks)}`;
    window.history.replaceState(null, "", path);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // si no se puede copiar, al menos queda en la URL
    }
  }

  if (!hydrated) {
    return (
      <div className="aspect-square max-w-3xl mx-auto rounded-full bg-surface border border-border animate-pulse" />
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

      {/* Cuadro radial */}
      <div className="max-w-3xl mx-auto">
        <svg
          viewBox="0 0 1000 1000"
          className="w-full h-auto select-none"
          role="img"
          aria-label="Cuadro de eliminatorias del Mundial 2026"
        >
          <defs>
            <clipPath id="sim-clip-leaf">
              <circle cx="0" cy="0" r={FLAG_LEAF} />
            </clipPath>
            <clipPath id="sim-clip-win">
              <circle cx="0" cy="0" r={FLAG_WIN} />
            </clipPath>
            <clipPath id="sim-clip-champ">
              <circle cx="0" cy="0" r={FLAG_CHAMP} />
            </clipPath>
          </defs>

          {/* Conectores */}
          <g fill="none" stroke="var(--border-strong)" strokeWidth={1.4}>
            {graph.lines.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Nodos del cuadro */}
          {graph.nodes.map((n) => {
            const clickable = Boolean(n.parent?.home && n.parent?.away);
            const selected = n.parent ? picks[n.parent.id] === n.side : false;
            return (
              <SimNode
                key={n.id}
                node={n}
                clickable={clickable}
                selected={selected}
                onPick={() => n.parent && choose(n.parent, n.side)}
              />
            );
          })}

          {/* Centro: trofeo o campeón */}
          {championTeam ? (
            <g transform={`translate(${CX} ${CY})`}>
              <g key={graph.champion ?? "champ"}>
                <circle className="sim-pulse" r={FLAG_CHAMP} fill="var(--accent)" />
                <g className="sim-pop">
                  <circle
                    r={FLAG_CHAMP + 4}
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth={3}
                  />
                  <circle r={FLAG_CHAMP} fill="var(--surface)" />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={FLAG_CHAMP * 2.4}
                    clipPath="url(#sim-clip-champ)"
                  >
                    {championTeam.flag}
                  </text>
                </g>
              </g>
            </g>
          ) : (
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={64}
              aria-hidden
            >
              🏆
            </text>
          )}
        </svg>
      </div>

      <p className="text-[11px] text-muted-foreground mt-4 text-center max-w-xl mx-auto">
        Toca el equipo que crees que pasa en cada cruce; el ganador avanza solo
        hacia el centro hasta coronar a tu campeón. Tu quiniela se guarda en este
        navegador y puedes compartirla con el botón. {pickedCount}/{ORDER.length}{" "}
        cruces elegidos.
      </p>
    </div>
  );
}

function SimNode({
  node,
  clickable,
  selected,
  onPick,
}: {
  node: BNode;
  clickable: boolean;
  selected: boolean;
  onPick: () => void;
}) {
  const team = getTeam(node.teamId);
  const isLeaf = node.kind === "leaf";
  const clip = isLeaf ? "url(#sim-clip-leaf)" : "url(#sim-clip-win)";

  // Nodos internos vacíos: punto de unión (como en un cuadro clásico).
  if (!team) {
    if (isLeaf) {
      return (
        <g transform={`translate(${node.x} ${node.y})`}>
          <circle
            r={node.r}
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={18}
            fill="var(--muted-foreground)"
          >
            ?
          </text>
        </g>
      );
    }
    return (
      <circle cx={node.x} cy={node.y} r={4} fill="var(--border-strong)" />
    );
  }

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onClick={clickable ? onPick : undefined}
      style={{ cursor: clickable ? "pointer" : "default" }}
    >
      <title>{team.name}</title>
      {/* Aparición animada: la key por equipo reinicia la animación al avanzar */}
      <g key={node.teamId ?? "x"} className="sim-pop">
        {selected && <circle className="sim-pulse" r={node.r} fill="var(--accent)" />}
        <circle
          r={node.r + 2}
          fill="var(--surface)"
          stroke={selected ? "var(--accent)" : "var(--border-strong)"}
          strokeWidth={selected ? 3 : 1.5}
        />
        <circle r={node.r} fill="var(--surface)" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={node.r * 2.4}
          clipPath={clip}
        >
          {team.flag}
        </text>
      </g>
    </g>
  );
}
