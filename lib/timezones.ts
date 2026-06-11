// Lista curada de zonas horarias para el selector del perfil. El valor "" significa
// "usar la del dispositivo". Cada valor es una IANA Time Zone.
export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: "", label: "Automática (mi dispositivo)" },
  { value: "Europe/Madrid", label: "España peninsular (Madrid)" },
  { value: "Atlantic/Canary", label: "Canarias" },
  { value: "Europe/London", label: "Reino Unido (Londres)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/New_York", label: "EE. UU. Este (Nueva York)" },
  { value: "America/Chicago", label: "EE. UU. Centro (Chicago)" },
  { value: "America/Los_Angeles", label: "EE. UU. Pacífico (Los Ángeles)" },
];

// Zona horaria del navegador/dispositivo.
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// Nombre de ciudad/lugar legible para una IANA Time Zone (en español).
const TZ_CITY: Record<string, string> = {
  "Europe/Madrid": "Madrid",
  "Atlantic/Canary": "Canarias",
  "Europe/London": "Londres",
  "Europe/Lisbon": "Lisboa",
  "Europe/Paris": "París",
  "Europe/Berlin": "Berlín",
  "Europe/Rome": "Roma",
  "America/Mexico_City": "Ciudad de México",
  "America/Monterrey": "Monterrey",
  "America/Bogota": "Bogotá",
  "America/Lima": "Lima",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Santiago": "Santiago",
  "America/New_York": "Nueva York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Ángeles",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
};

export function timezoneCity(tz: string): string {
  if (TZ_CITY[tz]) return TZ_CITY[tz];
  // Fallback: último segmento de la IANA tz ("Europe/Madrid" -> "Madrid").
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}
