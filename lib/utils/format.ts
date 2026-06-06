const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatMatchDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

export function formatMatchTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
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
