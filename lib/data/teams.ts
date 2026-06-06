import type { Team } from "@/types";

export const TEAMS: Team[] = [
  // Group A — Mexico City
  { id: "mex", name: "México", code: "MEX", flag: "🇲🇽", confederation: "CONCACAF", group: "A", qualified: true },
  { id: "nor", name: "Noruega", code: "NOR", flag: "🇳🇴", confederation: "UEFA", group: "A", qualified: true },
  { id: "ksa", name: "Arabia Saudí", code: "KSA", flag: "🇸🇦", confederation: "AFC", group: "A", qualified: true },
  { id: "gha", name: "Ghana", code: "GHA", flag: "🇬🇭", confederation: "CAF", group: "A", qualified: true },

  // Group B — Toronto
  { id: "can", name: "Canadá", code: "CAN", flag: "🇨🇦", confederation: "CONCACAF", group: "B", qualified: true },
  { id: "bel", name: "Bélgica", code: "BEL", flag: "🇧🇪", confederation: "UEFA", group: "B", qualified: true },
  { id: "irq", name: "Iraq", code: "IRQ", flag: "🇮🇶", confederation: "AFC", group: "B", qualified: true },
  { id: "sen", name: "Senegal", code: "SEN", flag: "🇸🇳", confederation: "CAF", group: "B", qualified: true },

  // Group C — Los Angeles
  { id: "usa", name: "Estados Unidos", code: "USA", flag: "🇺🇸", confederation: "CONCACAF", group: "C", qualified: true },
  { id: "cro", name: "Croacia", code: "CRO", flag: "🇭🇷", confederation: "UEFA", group: "C", qualified: true },
  { id: "ecu", name: "Ecuador", code: "ECU", flag: "🇪🇨", confederation: "CONMEBOL", group: "C", qualified: true },
  { id: "nzl", name: "Nueva Zelanda", code: "NZL", flag: "🇳🇿", confederation: "OFC", group: "C", qualified: true },

  // Group D
  { id: "arg", name: "Argentina", code: "ARG", flag: "🇦🇷", confederation: "CONMEBOL", group: "D", qualified: true },
  { id: "egy", name: "Egipto", code: "EGY", flag: "🇪🇬", confederation: "CAF", group: "D", qualified: true },
  { id: "irn", name: "Irán", code: "IRN", flag: "🇮🇷", confederation: "AFC", group: "D", qualified: true },
  { id: "crc", name: "Costa Rica", code: "CRC", flag: "🇨🇷", confederation: "CONCACAF", group: "D", qualified: true },

  // Group E
  { id: "fra", name: "Francia", code: "FRA", flag: "🇫🇷", confederation: "UEFA", group: "E", qualified: true },
  { id: "tur", name: "Türkiye", code: "TUR", flag: "🇹🇷", confederation: "UEFA", group: "E", qualified: true },
  { id: "alg", name: "Argelia", code: "ALG", flag: "🇩🇿", confederation: "CAF", group: "E", qualified: true },
  { id: "uzb", name: "Uzbekistán", code: "UZB", flag: "🇺🇿", confederation: "AFC", group: "E", qualified: true },

  // Group F
  { id: "bra", name: "Brasil", code: "BRA", flag: "🇧🇷", confederation: "CONMEBOL", group: "F", qualified: true },
  { id: "ned", name: "Países Bajos", code: "NED", flag: "🇳🇱", confederation: "UEFA", group: "F", qualified: true },
  { id: "pan", name: "Panamá", code: "PAN", flag: "🇵🇦", confederation: "CONCACAF", group: "F", qualified: true },
  { id: "cmr", name: "Camerún", code: "CMR", flag: "🇨🇲", confederation: "CAF", group: "F", qualified: true },

  // Group G
  { id: "esp", name: "España", code: "ESP", flag: "🇪🇸", confederation: "UEFA", group: "G", qualified: true },
  { id: "pol", name: "Polonia", code: "POL", flag: "🇵🇱", confederation: "UEFA", group: "G", qualified: true },
  { id: "kor", name: "Corea del Sur", code: "KOR", flag: "🇰🇷", confederation: "AFC", group: "G", qualified: true },
  { id: "civ", name: "Costa de Marfil", code: "CIV", flag: "🇨🇮", confederation: "CAF", group: "G", qualified: true },

  // Group H
  { id: "eng", name: "Inglaterra", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA", group: "H", qualified: true },
  { id: "sui", name: "Suiza", code: "SUI", flag: "🇨🇭", confederation: "UEFA", group: "H", qualified: true },
  { id: "tun", name: "Túnez", code: "TUN", flag: "🇹🇳", confederation: "CAF", group: "H", qualified: true },
  { id: "aus", name: "Australia", code: "AUS", flag: "🇦🇺", confederation: "AFC", group: "H", qualified: true },

  // Group I
  { id: "ger", name: "Alemania", code: "GER", flag: "🇩🇪", confederation: "UEFA", group: "I", qualified: true },
  { id: "den", name: "Dinamarca", code: "DEN", flag: "🇩🇰", confederation: "UEFA", group: "I", qualified: true },
  { id: "jpn", name: "Japón", code: "JPN", flag: "🇯🇵", confederation: "AFC", group: "I", qualified: true },
  { id: "mar", name: "Marruecos", code: "MAR", flag: "🇲🇦", confederation: "CAF", group: "I", qualified: true },

  // Group J
  { id: "por", name: "Portugal", code: "POR", flag: "🇵🇹", confederation: "UEFA", group: "J", qualified: true },
  { id: "srb", name: "Serbia", code: "SRB", flag: "🇷🇸", confederation: "UEFA", group: "J", qualified: true },
  { id: "jam", name: "Jamaica", code: "JAM", flag: "🇯🇲", confederation: "CONCACAF", group: "J", qualified: true },
  { id: "nga", name: "Nigeria", code: "NGA", flag: "🇳🇬", confederation: "CAF", group: "J", qualified: true },

  // Group K
  { id: "ita", name: "Italia", code: "ITA", flag: "🇮🇹", confederation: "UEFA", group: "K", qualified: true },
  { id: "aut", name: "Austria", code: "AUT", flag: "🇦🇹", confederation: "UEFA", group: "K", qualified: true },
  { id: "qat", name: "Qatar", code: "QAT", flag: "🇶🇦", confederation: "AFC", group: "K", qualified: true },
  { id: "par", name: "Paraguay", code: "PAR", flag: "🇵🇾", confederation: "CONMEBOL", group: "K", qualified: true },

  // Group L
  { id: "uru", name: "Uruguay", code: "URU", flag: "🇺🇾", confederation: "CONMEBOL", group: "L", qualified: true },
  { id: "col", name: "Colombia", code: "COL", flag: "🇨🇴", confederation: "CONMEBOL", group: "L", qualified: true },
  { id: "ven", name: "Venezuela", code: "VEN", flag: "🇻🇪", confederation: "CONMEBOL", group: "L", qualified: true },
  { id: "bol", name: "Bolivia", code: "BOL", flag: "🇧🇴", confederation: "CONMEBOL", group: "L", qualified: true },
];

export const TEAMS_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

export function getTeam(id: string | null): Team | undefined {
  if (!id) return undefined;
  return TEAMS_BY_ID[id];
}

export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;

export function teamsByGroup(group: string): Team[] {
  return TEAMS.filter((t) => t.group === group);
}
