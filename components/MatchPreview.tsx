"use client";

import type { Team } from "@/types";
import { getTeam } from "@/lib/data/teams";
import { PlayerAvatar, initialsOf } from "@/components/PlayerAvatar";
import type { MatchPreview as Preview } from "@/lib/providers";

interface Props {
  preview: Preview;
  homeId: string | null;
  awayId: string | null;
  home?: Team;
  away?: Team;
}

// Previa del partido: pronóstico de la API, forma reciente, cara a cara y bajas.
export function MatchPreview({ preview, homeId, awayId, home, away }: Props) {
  const { prediction, form, h2h, injuries } = preview;
  const hasAny =
    prediction != null ||
    (form != null && (form.home || form.away)) ||
    h2h.length > 0 ||
    injuries.length > 0;
  if (!hasAny) return null;

  return (
    <div className="mb-8 space-y-6">
      <h2 className="text-xl font-bold tracking-tight">Previa</h2>

      {prediction && (
        <Prediction prediction={prediction} home={home} away={away} />
      )}

      {form && (form.home || form.away) && (
        <FormBlock form={form} home={home} away={away} />
      )}

      {h2h.length > 0 && <H2H matches={h2h} homeId={homeId} />}

      {injuries.length > 0 && (
        <Injuries injuries={injuries} homeId={homeId} awayId={awayId} />
      )}
    </div>
  );
}

function Prediction({
  prediction,
  home,
  away,
}: {
  prediction: NonNullable<Preview["prediction"]>;
  home?: Team;
  away?: Team;
}) {
  const { homePct, drawPct, awayPct, advice, winnerName } = prediction;
  const total = homePct + drawPct + awayPct || 1;
  const w = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
        Pronóstico de la IA
      </div>

      <div className="flex items-end justify-between text-sm mb-2">
        <span className="flex items-center gap-1.5">
          <span aria-hidden>{home?.flag}</span>
          <span className="font-semibold tabular-nums">{homePct}%</span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          Empate {drawPct}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-semibold tabular-nums">{awayPct}%</span>
          <span aria-hidden>{away?.flag}</span>
        </span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-border">
        <div className="bg-accent" style={{ width: w(homePct) }} />
        <div className="bg-muted-foreground/40" style={{ width: w(drawPct) }} />
        <div className="bg-cyan" style={{ width: w(awayPct) }} />
      </div>

      {(winnerName || advice) && (
        <div className="mt-4 space-y-1 text-sm">
          {winnerName && (
            <p>
              <span className="text-muted-foreground">Favorito:</span>{" "}
              <span className="font-semibold">{winnerName}</span>
            </p>
          )}
          {advice && (
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Consejo:</span> {advice}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Una racha "WWDLW" en pastillas de color (V verde / E gris / D rosa).
function FormPills({ form }: { form: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    W: { label: "V", cls: "bg-accent text-accent-foreground" },
    D: { label: "E", cls: "bg-border text-muted-foreground" },
    L: { label: "D", cls: "bg-pink/20 text-pink" },
  };
  const letters = form.split("").filter((c) => map[c]);
  if (letters.length === 0) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }
  return (
    <div className="flex gap-1">
      {letters.map((c, i) => {
        const m = map[c];
        return (
          <span
            key={i}
            className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center ${m.cls}`}
          >
            {m.label}
          </span>
        );
      })}
    </div>
  );
}

function FormBlock({
  form,
  home,
  away,
}: {
  form: NonNullable<Preview["form"]>;
  home?: Team;
  away?: Team;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
        Partidos anteriores
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight min-w-0">
            <span aria-hidden>{home?.flag}</span>
            <span className="truncate">{home?.name ?? "Local"}</span>
          </span>
          <FormPills form={form.home} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight min-w-0">
            <span aria-hidden>{away?.flag}</span>
            <span className="truncate">{away?.name ?? "Visitante"}</span>
          </span>
          <FormPills form={form.away} />
        </div>
      </div>
    </div>
  );
}

function H2H({
  matches,
  homeId,
}: {
  matches: Preview["h2h"];
  homeId: string | null;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
        Cara a cara
      </div>
      <ul className="space-y-2">
        {matches.map((m, i) => {
          const ht = getTeam(m.homeTeamId);
          const at = getTeam(m.awayTeamId);
          const hWon =
            m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore;
          const aWon =
            m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore;
          // Resalta el equipo cuya ficha estamos viendo si ganó.
          void homeId;
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-[11px] font-mono text-muted-foreground w-10 shrink-0">
                {m.date ? m.date.slice(0, 4) : "—"}
              </span>
              <span
                className={`flex-1 text-right truncate ${hWon ? "font-semibold" : ""}`}
              >
                {ht?.name ?? m.homeName}
                <span className="ml-1" aria-hidden>
                  {ht?.flag}
                </span>
              </span>
              <span className="font-mono font-bold tabular-nums shrink-0 px-1">
                {m.homeScore ?? "-"}–{m.awayScore ?? "-"}
              </span>
              <span
                className={`flex-1 truncate ${aWon ? "font-semibold" : ""}`}
              >
                <span className="mr-1" aria-hidden>
                  {at?.flag}
                </span>
                {at?.name ?? m.awayName}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// "Missing Fixture" = baja segura; "Questionable" = duda.
function injuryTag(type: string): { label: string; cls: string } {
  if (/quest/i.test(type))
    return { label: "Duda", cls: "bg-amber-500/15 text-amber-500" };
  return { label: "Baja", cls: "bg-pink/15 text-pink" };
}

// Traduce el motivo de baja/duda que devuelve API-Football (en inglés).
const REASON_EXACT: Record<string, string> = {
  suspended: "Sancionado",
  suspension: "Sanción",
  "red card": "Tarjeta roja",
  "coach's decision": "Decisión del entrenador",
  rest: "Descanso",
  rested: "Descanso",
  illness: "Enfermedad",
  ill: "Enfermedad",
  knock: "Golpe",
  fitness: "Condición física",
  "lack of fitness": "Falta de forma",
  concussion: "Conmoción cerebral",
  "personal reasons": "Motivos personales",
  "national selection": "Con su selección",
  doubtful: "En duda",
  other: "Otros",
  "covid-19": "COVID-19",
  coronavirus: "Coronavirus",
  "broken leg": "Pierna rota",
  "broken foot": "Pie roto",
  "broken ankle": "Tobillo roto",
  "broken arm": "Brazo roto",
};

const REASON_BODY: Record<string, string> = {
  hamstring: "isquiotibiales",
  quadriceps: "cuádriceps",
  knee: "rodilla",
  ankle: "tobillo",
  thigh: "muslo",
  calf: "gemelo",
  groin: "ingle",
  adductor: "aductores",
  achilles: "tendón de Aquiles",
  back: "espalda",
  shoulder: "hombro",
  foot: "pie",
  hip: "cadera",
  head: "cabeza",
  toe: "dedo del pie",
  wrist: "muñeca",
  elbow: "codo",
  chest: "pecho",
  rib: "costilla",
  neck: "cuello",
  finger: "dedo",
  hand: "mano",
  leg: "pierna",
  arm: "brazo",
  metatarsal: "metatarso",
};

const REASON_TYPE: Record<string, string> = {
  injury: "Lesión",
  strain: "Distensión",
  sprain: "Esguince",
  fracture: "Fractura",
  surgery: "Cirugía",
  problems: "Problemas",
};

function translateReason(reason: string): string {
  const r = reason.trim();
  if (!r) return "";
  const lower = r.toLowerCase();
  if (REASON_EXACT[lower]) return REASON_EXACT[lower];

  const muscle = /\bmuscle\b/i.test(r);
  let part: string | null = null;
  for (const [en, es] of Object.entries(REASON_BODY)) {
    if (new RegExp(`\\b${en}`, "i").test(r)) {
      part = es;
      break;
    }
  }
  let type: string | null = null;
  for (const [en, es] of Object.entries(REASON_TYPE)) {
    if (new RegExp(`\\b${en}`, "i").test(r)) {
      type = es;
      break;
    }
  }
  if (part || type) {
    const t = type ?? "Lesión";
    return part ? `${t}${muscle ? " muscular" : ""} de ${part}` : t;
  }
  // Motivo desconocido: lo dejamos tal cual.
  return r;
}

function InjuryRow({ item }: { item: Preview["injuries"][number] }) {
  const tag = injuryTag(item.type);
  return (
    <li className="flex items-center gap-3">
      <PlayerAvatar
        photo={item.photo}
        fallback={initialsOf(item.player)}
        size={36}
        alt={item.player}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{item.player}</div>
        {item.reason && (
          <div className="text-xs text-muted-foreground truncate">
            {translateReason(item.reason)}
          </div>
        )}
      </div>
      <span
        className={`shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${tag.cls}`}
      >
        {tag.label}
      </span>
    </li>
  );
}

function Injuries({
  injuries,
  homeId,
  awayId,
}: {
  injuries: Preview["injuries"];
  homeId: string | null;
  awayId: string | null;
}) {
  const homeList = injuries.filter((i) => i.teamId === homeId);
  const awayList = injuries.filter((i) => i.teamId === awayId);
  const others = injuries.filter(
    (i) => i.teamId !== homeId && i.teamId !== awayId,
  );
  const groups = [
    { team: getTeam(homeId), list: homeList },
    { team: getTeam(awayId), list: awayList },
  ].filter((g) => g.list.length > 0);
  // Si no se pudieron asignar a un equipo, los mostramos juntos.
  const flat = groups.length === 0 ? injuries : others;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
        Bajas y dudas
      </div>
      {groups.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
          {groups.map((g, i) => (
            <div key={i}>
              <p className="text-sm font-semibold tracking-tight mb-2 flex items-center gap-1.5">
                <span aria-hidden>{g.team?.flag}</span>
                {g.team?.name ?? "—"}
              </p>
              <ul className="space-y-2.5">
                {g.list.map((p, j) => (
                  <InjuryRow key={j} item={p} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {flat.map((p, j) => (
            <InjuryRow key={j} item={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
