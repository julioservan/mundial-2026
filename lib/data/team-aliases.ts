// Mapa de nombres de equipo (en inglés, como los devuelven los proveedores
// externos) a nuestros ids internos (ver lib/data/teams.ts). Compartido por
// todos los adaptadores de proveedor (API-Football, worldcup26.ir…).
export const NAME_TO_ID: Record<string, string> = {
  Mexico: "mex",
  "South Africa": "rsa",
  "South Korea": "kor",
  "Korea Republic": "kor",
  "Czech Republic": "cze",
  Czechia: "cze",
  Canada: "can",
  Switzerland: "sui",
  Qatar: "qat",
  "Bosnia and Herzegovina": "bih",
  "Bosnia & Herzegovina": "bih",
  Brazil: "bra",
  Morocco: "mar",
  Scotland: "sco",
  Haiti: "hai",
  "United States": "usa",
  "United States of America": "usa",
  USA: "usa",
  Paraguay: "par",
  Australia: "aus",
  Turkey: "tur",
  "Türkiye": "tur",
  Turkiye: "tur",
  Germany: "ger",
  Ecuador: "ecu",
  "Ivory Coast": "civ",
  "Côte d'Ivoire": "civ",
  "Cote d'Ivoire": "civ",
  Netherlands: "ned",
  Japan: "jpn",
  Sweden: "swe",
  Tunisia: "tun",
  "Curaçao": "cuw",
  Curacao: "cuw",
  Belgium: "bel",
  Egypt: "egy",
  Iran: "irn",
  "New Zealand": "nzl",
  Spain: "esp",
  Uruguay: "uru",
  "Saudi Arabia": "ksa",
  "Cape Verde": "cpv",
  "Cape Verde Islands": "cpv",
  "Cabo Verde": "cpv",
  France: "fra",
  Senegal: "sen",
  Iraq: "irq",
  Norway: "nor",
  Argentina: "arg",
  Austria: "aut",
  Algeria: "alg",
  Jordan: "jor",
  Portugal: "por",
  Colombia: "col",
  Uzbekistan: "uzb",
  "Democratic Republic of the Congo": "cod",
  "DR Congo": "cod",
  "Congo DR": "cod",
  England: "eng",
  Croatia: "cro",
  Ghana: "gha",
  Panama: "pan",
};

// Resuelve un nombre del proveedor a nuestro id, tolerando variaciones de
// mayúsculas/espacios. Devuelve null si no se reconoce.
export function teamIdFromName(name?: string | null): string | null {
  if (!name) return null;
  if (NAME_TO_ID[name]) return NAME_TO_ID[name];
  const norm = name.trim();
  if (NAME_TO_ID[norm]) return NAME_TO_ID[norm];
  // Normaliza "&" -> "and" por si el proveedor cambia el separador.
  const amp = norm.replace(/\s*&\s*/g, " and ");
  if (NAME_TO_ID[amp]) return NAME_TO_ID[amp];
  // Búsqueda case-insensitive como último recurso (con y sin normalizar "&").
  const lower = norm.toLowerCase();
  const lowerAmp = amp.toLowerCase();
  for (const [k, v] of Object.entries(NAME_TO_ID)) {
    const kl = k.toLowerCase();
    if (kl === lower || kl === lowerAmp) return v;
  }
  return null;
}
