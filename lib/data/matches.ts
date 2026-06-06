import type { Match, GroupId, MatchStage } from "@/types";
import { GROUPS, teamsByGroup } from "./teams";
import { VENUES } from "./venues";

const GROUP_VENUE: Record<GroupId, string> = {
  A: "Ciudad de México",
  B: "Toronto",
  C: "Los Angeles",
  D: "Dallas",
  E: "Atlanta",
  F: "Miami",
  G: "Kansas City",
  H: "Filadelfia",
  I: "Houston",
  J: "Boston",
  K: "Nueva York / NJ",
  L: "Monterrey",
};

function venueByCity(city: string) {
  return VENUES.find((v) => v.city === city) ?? VENUES[0];
}

function kickoff(dateISO: string, hour: number): string {
  return `${dateISO}T${hour.toString().padStart(2, "0")}:00:00-04:00`;
}

const MATCHDAY_BASE_DATES: [string, string, string] = [
  "2026-06-11",
  "2026-06-19",
  "2026-06-25",
];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildGroupMatches(): Match[] {
  const matches: Match[] = [];

  GROUPS.forEach((group, groupIdx) => {
    const teams = teamsByGroup(group);
    const [t1, t2, t3, t4] = teams;
    const venue = venueByCity(GROUP_VENUE[group]);

    const dayOffset = groupIdx % 5;
    const fixtures: { home: typeof t1; away: typeof t1; md: 0 | 1 | 2 }[] = [
      { home: t1, away: t2, md: 0 },
      { home: t3, away: t4, md: 0 },
      { home: t1, away: t3, md: 1 },
      { home: t4, away: t2, md: 1 },
      { home: t4, away: t1, md: 2 },
      { home: t2, away: t3, md: 2 },
    ];

    fixtures.forEach((f, idx) => {
      const date = addDays(MATCHDAY_BASE_DATES[f.md], dayOffset);
      const hour = 12 + (idx % 3) * 3;
      matches.push({
        id: `G-${group}-${idx + 1}`,
        stage: "group",
        group,
        matchday: f.md + 1,
        kickoff: kickoff(date, hour),
        venue,
        homeTeamId: f.home.id,
        awayTeamId: f.away.id,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
      });
    });
  });

  return matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
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
  {
    stage: "semifinal",
    date: "2026-07-14",
    hour: 15,
    city: "Dallas",
    label: "Semifinal 1",
  },
  {
    stage: "semifinal",
    date: "2026-07-15",
    hour: 15,
    city: "Atlanta",
    label: "Semifinal 2",
  },
  {
    stage: "third_place",
    date: "2026-07-18",
    hour: 15,
    city: "Miami",
    label: "Tercer puesto",
  },
  {
    stage: "final",
    date: "2026-07-19",
    hour: 15,
    city: "Nueva York / NJ",
    label: "Final",
  },
];

function buildKnockoutMatches(): Match[] {
  return KNOCKOUT_STUBS.map((stub, idx) => ({
    id: `K-${stub.stage}-${idx + 1}`,
    stage: stub.stage,
    kickoff: kickoff(stub.date, stub.hour),
    venue: venueByCity(stub.city),
    homeTeamId: null,
    awayTeamId: null,
    homeScore: null,
    awayScore: null,
    status: "scheduled",
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
