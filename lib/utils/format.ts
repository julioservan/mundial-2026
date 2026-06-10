// timeZone opcional: una IANA tz (p. ej. "Europe/Madrid"). Si no se pasa, se
// usa la zona horaria por defecto del entorno (como antes).
export function formatMatchDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(iso));
}

export function formatMatchTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function stageLabel(stage: string): string {
  switch (stage) {
    case "group":
      return "Fase de grupos";
    case "round32":
      return "Dieciseisavos";
    case "round16":
      return "Octavos";
    case "quarterfinal":
      return "Cuartos";
    case "semifinal":
      return "Semifinal";
    case "third_place":
      return "Tercer puesto";
    case "final":
      return "Final";
    default:
      return stage;
  }
}
