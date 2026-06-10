"use client";

import { useAuth } from "@/lib/supabase/auth";
import { deviceTimezone } from "@/lib/timezones";
import { formatMatchDate, formatMatchTime } from "@/lib/utils/format";

interface Props {
  iso: string;
  // "datetime" -> "Dom 14 jun · 21:00"; "time" -> "21:00"; "date" -> "Dom 14 jun"
  mode?: "datetime" | "time" | "date";
}

// Muestra la hora de un partido en la zona horaria elegida por el usuario en su
// perfil; si no ha elegido ninguna, usa la del dispositivo. suppressHydration
// evita el aviso de desajuste servidor/cliente al depender de la zona local.
export function LocalTime({ iso, mode = "datetime" }: Props) {
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

  return <span suppressHydrationWarning>{text}</span>;
}
