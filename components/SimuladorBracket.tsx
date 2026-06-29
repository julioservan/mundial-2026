"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { MatchStage } from "@/types";
import { KNOCKOUT_SLOTS } from "@/lib/data/matches";
import { getTeam } from "@/lib/data/teams";
import { fetchFixtureAssignments } from "@/lib/fixtures";
import type { SlotAssignment } from "@/lib/bracket";
import { fetchResults, type ResultMap } from "@/lib/results";
import { winnerOf as resultWinner } from "@/lib/scoring";
import { useAuth } from "@/lib/supabase/auth";
import {
  fetchMySimulador,
  saveMySimulador,
  fetchAllSimuladores,
  type SimuladorFriend,
} from "@/lib/simulador";
import { Avatar } from "@/components/Avatar";

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

// Fases de la eliminatoria, de la más temprana a la final, para el desglose.
const PHASES: { key: string; label: string; ids: string[]; roundIdx: number }[] =
  [
    { key: "round32", label: "Dieciseisavos", ids: KNOCKOUT_SLOTS.round32, roundIdx: 0 },
    { key: "round16", label: "Octavos", ids: KNOCKOUT_SLOTS.round16, roundIdx: 1 },
    { key: "quarterfinal", label: "Cuartos", ids: KNOCKOUT_SLOTS.quarterfinal, roundIdx: 2 },
    { key: "semifinal", label: "Semifinales", ids: KNOCKOUT_SLOTS.semifinal, roundIdx: 3 },
    { key: "final", label: "Final", ids: [KNOCKOUT_SLOTS.final], roundIdx: 4 },
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
// Trofeo central (~10% más pequeño que antes).
const TROPHY_W = 140;
const TROPHY_H = 166;

// Confetti determinista (sin Math.random para no romper la pureza de render).
const CONFETTI_COLORS = [
  "var(--accent)",
  "var(--pink)",
  "var(--cyan)",
  "var(--amber)",
  "var(--violet)",
  "#ffffff",
];
const CONFETTI = Array.from({ length: 160 }, (_, i) => ({
  left: (i * 31) % 100,
  delay: ((i * 47) % 220) / 100, // 0–2.2s (oleadas)
  duration: 2.2 + ((i * 29) % 22) / 10, // 2.2–4.4s
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 7 + (i % 6) * 2, // 7–17px
  round: i % 3 === 0,
  drift: ((i * 53) % 220) - 110, // -110–110px de deriva lateral
  spin: 540 + ((i * 67) % 540), // 540–1080° de giro
}));

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
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Record<string, SlotAssignment>>(
    {},
  );
  const [results, setResults] = useState<ResultMap>({});
  const [draft, setDraft] = useState<Picks>(readInitialPicks);
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mi cuadro guardado (bloqueado) y el de los amigos.
  const [lockedPicks, setLockedPicks] = useState<Picks | null>(null);
  const [friends, setFriends] = useState<SimuladorFriend[]>([]);
  const [viewing, setViewing] = useState<SimuladorFriend | null>(null); // null = el mío
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Equipos reales de 16avos + resultados desde la API. Al resolver marcamos
  // hidratado para pintar el cuadro real solo en cliente y evitar desajustes.
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchFixtureAssignments().catch(() => ({})),
      fetchResults().catch(() => ({})),
    ])
      .then(([a, r]) => {
        if (!active) return;
        setAssignments(a as Record<string, SlotAssignment>);
        setResults(r as ResultMap);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Carga mi cuadro guardado y la lista de amigos al iniciar sesión.
  useEffect(() => {
    let active = true;
    fetchAllSimuladores()
      .then((all) => active && setFriends(all))
      .catch(() => {});
    if (user) {
      fetchMySimulador(user.id)
        .then((row) => {
          if (active) setLockedPicks(row?.locked ? (row.picks as Picks) : null);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user]);

  const persist = useCallback((next: Picks) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora si no hay almacenamiento
    }
  }, []);

  // Mi cuadro bloqueado solo cuenta si hay sesión.
  const effectiveLocked = user ? lockedPicks : null;
  // Picks que se muestran: el de un amigo, o el mío (bloqueado o borrador).
  const picks = viewing ? (viewing.picks as Picks) : (effectiveLocked ?? draft);
  // Solo se edita el cuadro propio que aún no está guardado.
  const editable = !viewing && !effectiveLocked;

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
  const complete = pickedCount === ORDER.length;

  // Ganador REAL de cada cruce según la API (resultado + equipos del feed).
  // Independiente del resto de la web: solo mira cómo quedaron los partidos.
  const actualWinners = useMemo<Record<string, string | null>>(() => {
    const out: Record<string, string | null> = {};
    for (const id of ORDER) {
      const a = assignments[id];
      const r = results[id];
      if (!a?.homeTeamId || !a?.awayTeamId || !r) {
        out[id] = null;
        continue;
      }
      const w = resultWinner(Number(r.home), Number(r.away));
      out[id] = w === "home" ? a.homeTeamId : w === "away" ? a.awayTeamId : null;
    }
    return out;
  }, [assignments, results]);

  // Acierto = el equipo que pusiste como ganador del cruce ganó de verdad.
  const score = useMemo(() => {
    const byPhase: Record<string, { hits: number; played: number }> = {};
    let hits = 0;
    let played = 0;
    const matchById = new Map<string, SimMatch>(
      rounds.flatMap((rd) => rd.matches.map((m) => [m.id, m] as [string, SimMatch])),
    );
    for (const ph of PHASES) {
      let h = 0;
      let p = 0;
      for (const id of ph.ids) {
        const actual = actualWinners[id];
        if (!actual) continue; // aún no jugado / sin ganador claro
        p++;
        const m = matchById.get(id);
        const predicted = m ? winnerOf(m) : null;
        if (predicted && predicted === actual) h++;
      }
      byPhase[ph.key] = { hits: h, played: p };
      hits += h;
      played += p;
    }
    return { hits, played, byPhase };
  }, [actualWinners, rounds, winnerOf]);

  function choose(parent: SimMatch, side: Side) {
    if (!editable || !parent.home || !parent.away) return;
    setDraft((prev) => {
      const next = { ...prev, [parent.id]: side };
      persist(next);
      return next;
    });
  }

  function reset() {
    if (!editable) return;
    setDraft({});
    persist({});
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  async function save() {
    if (!user || !complete) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveMySimulador(user.id, draft);
      setLockedPicks(draft);
      setConfirmSave(false);
      // Refresca la lista de amigos para incluir el cuadro recién guardado.
      fetchAllSimuladores()
        .then(setFriends)
        .catch(() => {});
    } catch {
      setSaveError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
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
      {/* Banner de "estás viendo el cuadro de…" o "tu cuadro está guardado" */}
      {viewing ? (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Avatar url={viewing.avatarUrl} name={viewing.username} size={28} />
            <span>
              Estás viendo el cuadro de{" "}
              <span className="font-semibold">{viewing.username}</span>
            </span>
          </div>
          <button
            onClick={() => setViewing(null)}
            className="text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            ← Volver al mío
          </button>
        </div>
      ) : (
        effectiveLocked && (
          <div className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm flex items-center gap-2">
            <span aria-hidden>🔒</span>
            <span>
              Tu cuadro está <span className="font-semibold">guardado</span>. Ya no
              se puede cambiar; abajo se van anotando tus aciertos.
            </span>
          </div>
        )
      )}

      {/* Campeón + acciones */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🏆
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {viewing ? `Campeón de ${viewing.username}` : "Tu campeón"}
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
            className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-muted-foreground hover:bg-surface-muted transition-colors"
          >
            {copied ? "¡Enlace copiado!" : "Compartir"}
          </button>
          {editable && (
            <>
              <button
                onClick={reset}
                disabled={pickedCount === 0}
                className="px-4 py-2 rounded-full text-sm font-semibold border border-border text-muted-foreground hover:bg-surface-muted transition-colors disabled:opacity-40"
              >
                Reiniciar
              </button>
              <button
                onClick={() => (user ? setConfirmSave(true) : undefined)}
                disabled={!complete}
                title={
                  !complete
                    ? "Completa el cuadro hasta el campeón para guardar"
                    : undefined
                }
                className="px-4 py-2 rounded-full text-sm font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      {editable && !user && (
        <p className="-mt-2 mb-6 text-xs text-muted-foreground">
          <Link href="/login" className="text-accent font-semibold hover:underline underline-offset-4">
            Inicia sesión
          </Link>{" "}
          para guardar tu cuadro y compararlo con tus amigos.
        </p>
      )}

      {/* Cuadro radial */}
      <div className="max-w-3xl mx-auto relative">
        {championTeam && <Confetti key={graph.champion ?? "champ"} />}
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
            <linearGradient id="sim-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbe7a1" />
              <stop offset="40%" stopColor="#e8be53" />
              <stop offset="100%" stopColor="#a9791f" />
            </linearGradient>
          </defs>

          {/* Conectores */}
          <g fill="none" stroke="var(--border-strong)" strokeWidth={1.4}>
            {graph.lines.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Nodos del cuadro */}
          {graph.nodes.map((n) => {
            const clickable = editable && Boolean(n.parent?.home && n.parent?.away);
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

          {/* Trofeo: centrado y, al haber campeón, sube y encoge (se conserva).
              Respaldo dibujado debajo por si aún no hay imagen en /trofeo.svg. */}
          <g
            className="sim-trophy-move"
            style={{
              transform: championTeam
                ? `translate(${CX}px, ${CY - 138}px) scale(0.58)`
                : `translate(${CX}px, ${CY}px) scale(1)`,
            }}
          >
            <TrophyMark />
            <image
              href="/trofeo.svg"
              x={-TROPHY_W / 2}
              y={-TROPHY_H / 2}
              width={TROPHY_W}
              height={TROPHY_H}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>

          {/* Bandera del campeón en el centro */}
          {championTeam && (
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
          )}
        </svg>
      </div>

      {editable && (
        <p className="text-[11px] text-muted-foreground mt-4 text-center max-w-xl mx-auto">
          Toca el equipo que crees que pasa en cada cruce; el ganador avanza solo
          hacia el centro hasta coronar a tu campeón. {pickedCount}/{ORDER.length}{" "}
          cruces elegidos.
        </p>
      )}

      {/* Cuadros de los amigos */}
      {friends.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Cuadros de tus amigos
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {!viewing && effectiveLocked && (
              <span className="shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold bg-accent text-accent-foreground">
                Tú
              </span>
            )}
            {viewing && (
              <button
                onClick={() => setViewing(null)}
                className="shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border border-accent text-accent hover:bg-accent-soft transition-colors"
              >
                ← Mi cuadro
              </button>
            )}
            {friends
              .filter((f) => f.userId !== user?.id)
              .map((f) => (
                <button
                  key={f.userId}
                  onClick={() => setViewing(f)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    viewing?.userId === f.userId
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-surface-muted"
                  }`}
                >
                  <Avatar url={f.avatarUrl} name={f.username} size={20} />
                  {f.username}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Aciertos + desglose por fase */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-lg font-bold tracking-tight">
            {viewing ? `Votos de ${viewing.username}` : "Mis votos por fase"}
          </h3>
          <div className="text-sm">
            <span className="font-bold text-accent text-lg tabular-nums">
              {score.hits}
            </span>{" "}
            <span className="text-muted-foreground">
              {score.hits === 1 ? "acierto" : "aciertos"} de {score.played}{" "}
              {score.played === 1 ? "partido jugado" : "partidos jugados"}
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {PHASES.map((ph) => (
            <PhaseVotes
              key={ph.key}
              label={ph.label}
              matches={rounds[ph.roundIdx].matches}
              picks={picks}
              actualWinners={actualWinners}
              stats={score.byPhase[ph.key]}
            />
          ))}
        </div>
      </div>

      {/* Diálogo de guardado (bloqueo irreversible) */}
      {confirmSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-border p-6 text-center">
            <div className="text-4xl mb-3" aria-hidden>
              ⚠️
            </div>
            <h4 className="text-xl font-bold tracking-tight mb-2">
              ¿Guardar definitivamente?
            </h4>
            <p className="text-sm text-muted-foreground mb-6">
              Ojo: una vez guardes, <span className="font-semibold text-foreground">no podrás cambiar tu cuadro</span>. A
              partir de ahí solo se irán anotando tus aciertos según los
              resultados.
            </p>
            {saveError && (
              <p className="text-sm text-pink mb-3">{saveError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSave(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold border border-border text-muted-foreground hover:bg-surface-muted transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Sí, guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Desglose de los votos de una fase: cada cruce con el equipo elegido y, si ya
// se jugó, si fue acierto (✓) o fallo (✗).
function PhaseVotes({
  label,
  matches,
  picks,
  actualWinners,
  stats,
}: {
  label: string;
  matches: SimMatch[];
  picks: Picks;
  actualWinners: Record<string, string | null>;
  stats: { hits: number; played: number } | undefined;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h4>
        {stats && stats.played > 0 && (
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {stats.hits}/{stats.played}
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {matches.map((m) => {
          const picked = picks[m.id];
          const pickedTeam = getTeam(
            picked === "home" ? m.home : picked === "away" ? m.away : null,
          );
          const actual = actualWinners[m.id];
          const pickedId = picked === "home" ? m.home : picked === "away" ? m.away : null;
          const status: "hit" | "miss" | "pending" = !actual
            ? "pending"
            : pickedId && pickedId === actual
              ? "hit"
              : "miss";
          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                status === "hit"
                  ? "border-accent/50 bg-accent-soft"
                  : status === "miss"
                    ? "border-border bg-surface opacity-70"
                    : "border-border bg-surface"
              }`}
            >
              <span className="text-base shrink-0" aria-hidden>
                {pickedTeam?.flag ?? "•"}
              </span>
              <span className="truncate flex-1">
                {pickedTeam?.name ?? (
                  <span className="text-muted-foreground/60">Sin elegir</span>
                )}
              </span>
              {status === "hit" && (
                <span className="text-accent text-xs font-bold shrink-0" aria-hidden>
                  ✓
                </span>
              )}
              {status === "miss" && (
                <span
                  className="text-muted-foreground text-xs font-bold shrink-0"
                  aria-hidden
                >
                  ✗
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lluvia de confetti sobre el cuadro al coronar campeón.
function Confetti() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-10"
      aria-hidden
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="sim-confetti absolute top-0 block"
          style={
            {
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.4,
              background: c.color,
              borderRadius: c.round ? "9999px" : "1px",
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              "--dx": `${c.drift}px`,
              "--spin": `${c.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// Trofeo dorado genérico (ilustración propia), dibujado alrededor del origen;
// el grupo padre lo posiciona y escala.
function TrophyMark() {
  return (
    <g
      fill="url(#sim-gold)"
      stroke="#8a6314"
      strokeWidth={1.2}
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Asas */}
      <path
        d="M-30 -50 C-54 -47 -54 -10 -29 -16"
        fill="none"
        stroke="url(#sim-gold)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M30 -50 C54 -47 54 -10 29 -16"
        fill="none"
        stroke="url(#sim-gold)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* Copa */}
      <path d="M-31 -54 L31 -54 C31 -16 13 4 0 8 C-13 4 -31 -16 -31 -54 Z" />
      {/* Brillo */}
      <path
        d="M-18 -48 C-18 -24 -8 -8 -2 -4 C-12 -14 -14 -34 -12 -48 Z"
        fill="#fdf3cf"
        opacity={0.55}
        stroke="none"
      />
      {/* Cuello y pie */}
      <path d="M-6 8 L6 8 L5 24 L-5 24 Z" />
      <path d="M-17 24 L17 24 L14 33 L-14 33 Z" />
      <rect x={-25} y={33} width={50} height={11} rx={2} />
    </g>
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
