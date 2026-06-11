import type { Match, GroupId, MatchStage } from "@/types";
import { VENUES } from "./venues";

function venueByCity(city: string) {
  return VENUES.find((v) => v.city === city) ?? VENUES[0];
}

// Las horas están en hora del Este de EE. UU. (EDT = UTC-4 en junio/julio).
// El componente <LocalTime> las convierte a la zona horaria de cada usuario.
function kickoff(date: string, time: string): string {
  return `${date}T${time}:00-04:00`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Fixture {
  group: GroupId;
  md: 1 | 2 | 3;
  date: string;
  time: string; // HH:MM en hora del Este (ET)
  city: string;
  home: string;
  away: string;
}

// Calendario oficial del Mundial 2026 (fase de grupos). Fechas, horarios (ET),
// sedes y enfrentamientos según el sorteo final y el fixture publicado.
const GROUP_FIXTURES: Fixture[] = [
  // Grupo A
  { group: "A", md: 1, date: "2026-06-11", time: "15:00", city: "Ciudad de México", home: "mex", away: "rsa" },
  { group: "A", md: 1, date: "2026-06-11", time: "22:00", city: "Guadalajara", home: "kor", away: "cze" },
  { group: "A", md: 2, date: "2026-06-18", time: "12:00", city: "Atlanta", home: "cze", away: "rsa" },
  { group: "A", md: 2, date: "2026-06-18", time: "23:00", city: "Guadalajara", home: "mex", away: "kor" },
  { group: "A", md: 3, date: "2026-06-24", time: "21:00", city: "Ciudad de México", home: "cze", away: "mex" },
  { group: "A", md: 3, date: "2026-06-24", time: "21:00", city: "Monterrey", home: "rsa", away: "kor" },

  // Grupo B
  { group: "B", md: 1, date: "2026-06-12", time: "15:00", city: "Toronto", home: "can", away: "bih" },
  { group: "B", md: 1, date: "2026-06-13", time: "15:00", city: "San Francisco", home: "qat", away: "sui" },
  { group: "B", md: 2, date: "2026-06-18", time: "15:00", city: "Los Angeles", home: "sui", away: "bih" },
  { group: "B", md: 2, date: "2026-06-18", time: "18:00", city: "Vancouver", home: "can", away: "qat" },
  { group: "B", md: 3, date: "2026-06-24", time: "15:00", city: "Vancouver", home: "sui", away: "can" },
  { group: "B", md: 3, date: "2026-06-24", time: "15:00", city: "Seattle", home: "bih", away: "qat" },

  // Grupo C
  { group: "C", md: 1, date: "2026-06-13", time: "18:00", city: "Nueva York / NJ", home: "bra", away: "mar" },
  { group: "C", md: 1, date: "2026-06-13", time: "21:00", city: "Boston", home: "hai", away: "sco" },
  { group: "C", md: 2, date: "2026-06-19", time: "18:00", city: "Boston", home: "sco", away: "mar" },
  { group: "C", md: 2, date: "2026-06-19", time: "20:30", city: "Filadelfia", home: "bra", away: "hai" },
  { group: "C", md: 3, date: "2026-06-24", time: "18:00", city: "Miami", home: "sco", away: "bra" },
  { group: "C", md: 3, date: "2026-06-24", time: "18:00", city: "Atlanta", home: "mar", away: "hai" },

  // Grupo D
  { group: "D", md: 1, date: "2026-06-12", time: "21:00", city: "Los Angeles", home: "usa", away: "par" },
  { group: "D", md: 1, date: "2026-06-13", time: "00:00", city: "Vancouver", home: "aus", away: "tur" },
  { group: "D", md: 2, date: "2026-06-19", time: "15:00", city: "Seattle", home: "usa", away: "aus" },
  { group: "D", md: 2, date: "2026-06-19", time: "23:00", city: "San Francisco", home: "tur", away: "par" },
  { group: "D", md: 3, date: "2026-06-25", time: "22:00", city: "Los Angeles", home: "tur", away: "usa" },
  { group: "D", md: 3, date: "2026-06-25", time: "22:00", city: "San Francisco", home: "par", away: "aus" },

  // Grupo E
  { group: "E", md: 1, date: "2026-06-14", time: "13:00", city: "Houston", home: "ger", away: "cuw" },
  { group: "E", md: 1, date: "2026-06-14", time: "19:00", city: "Filadelfia", home: "civ", away: "ecu" },
  { group: "E", md: 2, date: "2026-06-20", time: "16:00", city: "Toronto", home: "ger", away: "civ" },
  { group: "E", md: 2, date: "2026-06-20", time: "20:00", city: "Kansas City", home: "ecu", away: "cuw" },
  { group: "E", md: 3, date: "2026-06-25", time: "16:00", city: "Filadelfia", home: "cuw", away: "civ" },
  { group: "E", md: 3, date: "2026-06-25", time: "16:00", city: "Nueva York / NJ", home: "ecu", away: "ger" },

  // Grupo F
  { group: "F", md: 1, date: "2026-06-14", time: "16:00", city: "Dallas", home: "ned", away: "jpn" },
  { group: "F", md: 1, date: "2026-06-14", time: "22:00", city: "Monterrey", home: "swe", away: "tun" },
  { group: "F", md: 2, date: "2026-06-20", time: "13:00", city: "Houston", home: "ned", away: "swe" },
  { group: "F", md: 2, date: "2026-06-20", time: "00:00", city: "Monterrey", home: "tun", away: "jpn" },
  { group: "F", md: 3, date: "2026-06-25", time: "19:00", city: "Dallas", home: "jpn", away: "swe" },
  { group: "F", md: 3, date: "2026-06-25", time: "19:00", city: "Kansas City", home: "tun", away: "ned" },

  // Grupo G
  { group: "G", md: 1, date: "2026-06-15", time: "15:00", city: "Seattle", home: "bel", away: "egy" },
  { group: "G", md: 1, date: "2026-06-15", time: "21:00", city: "Los Angeles", home: "irn", away: "nzl" },
  { group: "G", md: 2, date: "2026-06-21", time: "15:00", city: "Los Angeles", home: "bel", away: "irn" },
  { group: "G", md: 2, date: "2026-06-21", time: "21:00", city: "Vancouver", home: "nzl", away: "egy" },
  { group: "G", md: 3, date: "2026-06-26", time: "23:00", city: "Seattle", home: "egy", away: "irn" },
  { group: "G", md: 3, date: "2026-06-26", time: "23:00", city: "Vancouver", home: "nzl", away: "bel" },

  // Grupo H
  { group: "H", md: 1, date: "2026-06-15", time: "12:00", city: "Atlanta", home: "esp", away: "cpv" },
  { group: "H", md: 1, date: "2026-06-15", time: "18:00", city: "Miami", home: "ksa", away: "uru" },
  { group: "H", md: 2, date: "2026-06-21", time: "12:00", city: "Atlanta", home: "esp", away: "ksa" },
  { group: "H", md: 2, date: "2026-06-21", time: "18:00", city: "Miami", home: "uru", away: "cpv" },
  { group: "H", md: 3, date: "2026-06-26", time: "20:00", city: "Houston", home: "cpv", away: "ksa" },
  { group: "H", md: 3, date: "2026-06-26", time: "20:00", city: "Guadalajara", home: "uru", away: "esp" },

  // Grupo I
  { group: "I", md: 1, date: "2026-06-16", time: "15:00", city: "Nueva York / NJ", home: "fra", away: "sen" },
  { group: "I", md: 1, date: "2026-06-16", time: "18:00", city: "Boston", home: "irq", away: "nor" },
  { group: "I", md: 2, date: "2026-06-22", time: "17:00", city: "Filadelfia", home: "fra", away: "irq" },
  { group: "I", md: 2, date: "2026-06-22", time: "20:00", city: "Nueva York / NJ", home: "nor", away: "sen" },
  { group: "I", md: 3, date: "2026-06-26", time: "15:00", city: "Boston", home: "nor", away: "fra" },
  { group: "I", md: 3, date: "2026-06-26", time: "15:00", city: "Toronto", home: "sen", away: "irq" },

  // Grupo J
  { group: "J", md: 1, date: "2026-06-16", time: "21:00", city: "Kansas City", home: "arg", away: "alg" },
  { group: "J", md: 1, date: "2026-06-17", time: "00:00", city: "San Francisco", home: "aut", away: "jor" },
  { group: "J", md: 2, date: "2026-06-22", time: "13:00", city: "Dallas", home: "arg", away: "aut" },
  { group: "J", md: 2, date: "2026-06-22", time: "23:00", city: "San Francisco", home: "jor", away: "alg" },
  { group: "J", md: 3, date: "2026-06-27", time: "22:00", city: "Kansas City", home: "alg", away: "aut" },
  { group: "J", md: 3, date: "2026-06-27", time: "22:00", city: "Dallas", home: "jor", away: "arg" },

  // Grupo K
  { group: "K", md: 1, date: "2026-06-17", time: "13:00", city: "Houston", home: "por", away: "cod" },
  { group: "K", md: 1, date: "2026-06-17", time: "22:00", city: "Ciudad de México", home: "uzb", away: "col" },
  { group: "K", md: 2, date: "2026-06-23", time: "13:00", city: "Houston", home: "por", away: "uzb" },
  { group: "K", md: 2, date: "2026-06-23", time: "22:00", city: "Guadalajara", home: "col", away: "cod" },
  { group: "K", md: 3, date: "2026-06-27", time: "19:30", city: "Miami", home: "col", away: "por" },
  { group: "K", md: 3, date: "2026-06-27", time: "19:30", city: "Atlanta", home: "cod", away: "uzb" },

  // Grupo L
  { group: "L", md: 1, date: "2026-06-17", time: "16:00", city: "Dallas", home: "eng", away: "cro" },
  { group: "L", md: 1, date: "2026-06-17", time: "19:00", city: "Toronto", home: "gha", away: "pan" },
  { group: "L", md: 2, date: "2026-06-23", time: "16:00", city: "Boston", home: "eng", away: "gha" },
  { group: "L", md: 2, date: "2026-06-23", time: "19:00", city: "Toronto", home: "pan", away: "cro" },
  { group: "L", md: 3, date: "2026-06-27", time: "17:00", city: "Nueva York / NJ", home: "pan", away: "eng" },
  { group: "L", md: 3, date: "2026-06-27", time: "17:00", city: "Filadelfia", home: "cro", away: "gha" },
];

function buildGroupMatches(): Match[] {
  const perGroupCount: Record<string, number> = {};
  return GROUP_FIXTURES.map((f) => {
    perGroupCount[f.group] = (perGroupCount[f.group] ?? 0) + 1;
    return {
      // IDs nuevos (prefijo wc-) para no colisionar con el calendario antiguo.
      id: `wc-${f.group}-${perGroupCount[f.group]}`,
      stage: "group" as MatchStage,
      group: f.group,
      matchday: f.md,
      kickoff: kickoff(f.date, f.time),
      venue: venueByCity(f.city),
      homeTeamId: f.home,
      awayTeamId: f.away,
      homeScore: null,
      awayScore: null,
      status: "scheduled" as const,
    };
  }).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

interface KnockoutStub {
  stage: MatchStage;
  date: string;
  hour: number;
  city: string;
  label: string;
}

const KNOCKOUT_STUBS: KnockoutStub[] = [
  ...Array.from({ length: 16 }, (_, i) => ({
    stage: "round32" as const,
    date: addDays("2026-06-28", Math.floor(i / 4)),
    hour: 13 + (i % 4) * 3,
    city: VENUES[(i + 4) % VENUES.length].city,
    label: `Dieciseisavos ${i + 1}`,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    stage: "round16" as const,
    date: addDays("2026-07-04", Math.floor(i / 2)),
    hour: 14 + (i % 2) * 4,
    city: VENUES[(i + 2) % VENUES.length].city,
    label: `Octavos ${i + 1}`,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    stage: "quarterfinal" as const,
    date: addDays("2026-07-09", Math.floor(i / 2)),
    hour: 15 + (i % 2) * 4,
    city: VENUES[(i + 5) % VENUES.length].city,
    label: `Cuartos ${i + 1}`,
  })),
  { stage: "semifinal", date: "2026-07-14", hour: 15, city: "Dallas", label: "Semifinal 1" },
  { stage: "semifinal", date: "2026-07-15", hour: 15, city: "Atlanta", label: "Semifinal 2" },
  { stage: "third_place", date: "2026-07-18", hour: 15, city: "Miami", label: "Tercer puesto" },
  { stage: "final", date: "2026-07-19", hour: 15, city: "Nueva York / NJ", label: "Final" },
];

function buildKnockoutMatches(): Match[] {
  return KNOCKOUT_STUBS.map((stub, idx) => ({
    id: `K-${stub.stage}-${idx + 1}`,
    stage: stub.stage,
    kickoff: kickoff(stub.date, `${stub.hour.toString().padStart(2, "0")}:00`),
    venue: venueByCity(stub.city),
    homeTeamId: null,
    awayTeamId: null,
    homeScore: null,
    awayScore: null,
    status: "scheduled" as const,
  }));
}

export const MATCHES: Match[] = [
  ...buildGroupMatches(),
  ...buildKnockoutMatches(),
];

export const GROUP_MATCHES = MATCHES.filter((m) => m.stage === "group");
export const KNOCKOUT_MATCHES = MATCHES.filter((m) => m.stage !== "group");

export function matchesByGroup(group: GroupId): Match[] {
  return GROUP_MATCHES.filter((m) => m.group === group);
}

export function matchesByDate(): Record<string, Match[]> {
  const grouped: Record<string, Match[]> = {};
  MATCHES.forEach((m) => {
    const date = m.kickoff.slice(0, 10);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
  });
  return grouped;
}
