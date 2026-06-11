"use client";

import { useAuth } from "@/lib/supabase/auth";
import { deviceTimezone } from "@/lib/timezones";
import { formatMatchDate, formatMatchTime } from "@/lib/utils/format";

interface Props {
  iso: string;
  // "datetime" -> "Dom 14 jun · 21:00"; "time" -> "21:00"; "date" -> "Dom 14 jun"
  mode?: "datetime" | "time" | "date";
  // Añade el huso horario (p. ej. "GMT+2") junto a la hora.
  showZone?: boolean;
}

// Abreviatura del huso horario para una fecha y zona (p. ej. "GMT+2", "CEST").
function zoneAbbr(iso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone,
      hour: "2-digit",
      timeZoneName: "short",
    }).formatToParts(new Date(iso));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
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
  const zone = mode === "date" || !showZone ? "" : zoneAbbr(iso, tz);

  return (
    <span suppressHydrationWarning>
      {text}
      {zone && <span className="opacity-60"> {zone}</span>}
    </span>
  );
}
