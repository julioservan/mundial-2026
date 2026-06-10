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
