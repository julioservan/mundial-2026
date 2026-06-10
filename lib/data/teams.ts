import type { Team } from "@/types";

// Resultado del Sorteo Final (Washington D.C., 5 de diciembre de 2025).
// Equipos ordenados por bombo dentro de cada grupo (cabeza de serie primero).
export const TEAMS: Team[] = [
  // Group A
  { id: "mex", name: "México", code: "MEX", flag: "🇲🇽", confederation: "CONCACAF", group: "A", qualified: true },
  { id: "rsa", name: "Sudáfrica", code: "RSA", flag: "🇿🇦", confederation: "CAF", group: "A", qualified: true },
  { id: "kor", name: "Corea del Sur", code: "KOR", flag: "🇰🇷", confederation: "AFC", group: "A", qualified: true },
  { id: "cze", name: "Chequia", code: "CZE", flag: "🇨🇿", confederation: "UEFA", group: "A", qualified: true },

  // Group B
  { id: "can", name: "Canadá", code: "CAN", flag: "🇨🇦", confederation: "CONCACAF", group: "B", qualified: true },
  { id: "sui", name: "Suiza", code: "SUI", flag: "🇨🇭", confederation: "UEFA", group: "B", qualified: true },
  { id: "qat", name: "Qatar", code: "QAT", flag: "🇶🇦", confederation: "AFC", group: "B", qualified: true },
  { id: "bih", name: "Bosnia y Herzegovina", code: "BIH", flag: "🇧🇦", confederation: "UEFA", group: "B", qualified: true },

  // Group C
  { id: "bra", name: "Brasil", code: "BRA", flag: "🇧🇷", confederation: "CONMEBOL", group: "C", qualified: true },
  { id: "mar", name: "Marruecos", code: "MAR", flag: "🇲🇦", confederation: "CAF", group: "C", qualified: true },
  { id: "sco", name: "Escocia", code: "SCO", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", confederation: "UEFA", group: "C", qualified: true },
  { id: "hai", name: "Haití", code: "HAI", flag: "🇭🇹", confederation: "CONCACAF", group: "C", qualified: true },

  // Group D
  { id: "usa", name: "Estados Unidos", code: "USA", flag: "🇺🇸", confederation: "CONCACAF", group: "D", qualified: true },
  { id: "par", name: "Paraguay", code: "PAR", flag: "🇵🇾", confederation: "CONMEBOL", group: "D", qualified: true },
  { id: "aus", name: "Australia", code: "AUS", flag: "🇦🇺", confederation: "AFC", group: "D", qualified: true },
  { id: "tur", name: "Türkiye", code: "TUR", flag: "🇹🇷", confederation: "UEFA", group: "D", qualified: true },

  // Group E
  { id: "ger", name: "Alemania", code: "GER", flag: "🇩🇪", confederation: "UEFA", group: "E", qualified: true },
  { id: "ecu", name: "Ecuador", code: "ECU", flag: "🇪🇨", confederation: "CONMEBOL", group: "E", qualified: true },
  { id: "civ", name: "Costa de Marfil", code: "CIV", flag: "🇨🇮", confederation: "CAF", group: "E", qualified: true },
  { id: "cuw", name: "Curazao", code: "CUW", flag: "🇨🇼", confederation: "CONCACAF", group: "E", qualified: true },

  // Group F
  { id: "ned", name: "Países Bajos", code: "NED", flag: "🇳🇱", confederation: "UEFA", group: "F", qualified: true },
  { id: "jpn", name: "Japón", code: "JPN", flag: "🇯🇵", confederation: "AFC", group: "F", qualified: true },
  { id: "swe", name: "Suecia", code: "SWE", flag: "🇸🇪", confederation: "UEFA", group: "F", qualified: true },
  { id: "tun", name: "Túnez", code: "TUN", flag: "🇹🇳", confederation: "CAF", group: "F", qualified: true },

  // Group G
  { id: "bel", name: "Bélgica", code: "BEL", flag: "🇧🇪", confederation: "UEFA", group: "G", qualified: true },
  { id: "egy", name: "Egipto", code: "EGY", flag: "🇪🇬", confederation: "CAF", group: "G", qualified: true },
  { id: "irn", name: "Irán", code: "IRN", flag: "🇮🇷", confederation: "AFC", group: "G", qualified: true },
  { id: "nzl", name: "Nueva Zelanda", code: "NZL", flag: "🇳🇿", confederation: "OFC", group: "G", qualified: true },

  // Group H
  { id: "esp", name: "España", code: "ESP", flag: "🇪🇸", confederation: "UEFA", group: "H", qualified: true },
  { id: "uru", name: "Uruguay", code: "URU", flag: "🇺🇾", confederation: "CONMEBOL", group: "H", qualified: true },
  { id: "ksa", name: "Arabia Saudí", code: "KSA", flag: "🇸🇦", confederation: "AFC", group: "H", qualified: true },
  { id: "cpv", name: "Cabo Verde", code: "CPV", flag: "🇨🇻", confederation: "CAF", group: "H", qualified: true },

  // Group I
  { id: "fra", name: "Francia", code: "FRA", flag: "🇫🇷", confederation: "UEFA", group: "I", qualified: true },
  { id: "sen", name: "Senegal", code: "SEN", flag: "🇸🇳", confederation: "CAF", group: "I", qualified: true },
  { id: "irq", name: "Iraq", code: "IRQ", flag: "🇮🇶", confederation: "AFC", group: "I", qualified: true },
  { id: "nor", name: "Noruega", code: "NOR", flag: "🇳🇴", confederation: "UEFA", group: "I", qualified: true },

  // Group J
  { id: "arg", name: "Argentina", code: "ARG", flag: "🇦🇷", confederation: "CONMEBOL", group: "J", qualified: true },
  { id: "aut", name: "Austria", code: "AUT", flag: "🇦🇹", confederation: "UEFA", group: "J", qualified: true },
  { id: "alg", name: "Argelia", code: "ALG", flag: "🇩🇿", confederation: "CAF", group: "J", qualified: true },
  { id: "jor", name: "Jordania", code: "JOR", flag: "🇯🇴", confederation: "AFC", group: "J", qualified: true },

  // Group K
  { id: "por", name: "Portugal", code: "POR", flag: "🇵🇹", confederation: "UEFA", group: "K", qualified: true },
  { id: "col", name: "Colombia", code: "COL", flag: "🇨🇴", confederation: "CONMEBOL", group: "K", qualified: true },
  { id: "uzb", name: "Uzbekistán", code: "UZB", flag: "🇺🇿", confederation: "AFC", group: "K", qualified: true },
  { id: "cod", name: "RD Congo", code: "COD", flag: "🇨🇩", confederation: "CAF", group: "K", qualified: true },

  // Group L
  { id: "eng", name: "Inglaterra", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", confederation: "UEFA", group: "L", qualified: true },
  { id: "cro", name: "Croacia", code: "CRO", flag: "🇭🇷", confederation: "UEFA", group: "L", qualified: true },
  { id: "gha", name: "Ghana", code: "GHA", flag: "🇬🇭", confederation: "CAF", group: "L", qualified: true },
  { id: "pan", name: "Panamá", code: "PAN", flag: "🇵🇦", confederation: "CONCACAF", group: "L", qualified: true },
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
