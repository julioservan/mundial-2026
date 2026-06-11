"use client";

import { useAuth } from "@/lib/supabase/auth";
import { deviceTimezone, timezoneCity } from "@/lib/timezones";
import { formatMatchDate, formatMatchTime } from "@/lib/utils/format";

interface Props {
  iso: string;
  // "datetime" -> "Dom 14 jun · 21:00"; "time" -> "21:00"; "date" -> "Dom 14 jun"
  mode?: "datetime" | "time" | "date";
  // Añade el huso horario (p. ej. "GMT+2") junto a la hora.
  showZone?: boolean;
}

// Etiqueta de zona: ciudad + huso (p. ej. "Nueva York EDT", "Madrid GMT+2").
// Se usa locale en-US para el huso porque da abreviaturas tipo EDT/PDT en EE. UU.
function zoneLabel(iso: string, timeZone: string): string {
  const city = timezoneCity(timeZone);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      timeZoneName: "short",
    }).formatToParts(new Date(iso));
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return abbr ? `${city} ${abbr}` : city;
  } catch {
    return city;
  }
}

// Muestra la hora de un partido en la zona horaria elegida por el usuario en su
// perfil; si no ha elegido ninguna, usa la del dispositivo. suppressHydration
// evita el aviso de desajuste servidor/cliente al depender de la zona local.
export function LocalTime({ iso, mode = "datetime", showZone = true }: Props) {
  const { profile } = useAuth();
  const tz = profile?.timezone || deviceTimezone();

  let text: string;
  if (mode === "time") {
    text = formatMatchTime(iso, tz);
  } else if (mode === "date") {
    text = formatMatchDate(iso, tz);
  } else {
    text = `${formatMatchDate(iso, tz)} · ${formatMatchTime(iso, tz)}`;
  }

  // La zona solo tiene sentido cuando se muestra una hora.
  const zone = mode === "date" || !showZone ? "" : zoneLabel(iso, tz);

  return (
    <span suppressHydrationWarning>
      {text}
      {zone && <span className="opacity-60"> {zone}</span>}
    </span>
  );
}
