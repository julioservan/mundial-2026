import { PredictionForm } from "@/components/PredictionForm";
import { GROUP_MATCHES } from "@/lib/data/matches";

export const metadata = {
  title: "Mis predicciones · Mundialistas2026",
};

export default function PredictionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tu quiniela
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          Tus{" "}
          <span className="font-display text-accent">predicciones.</span>
        </h1>
        <p className="text-muted-foreground mt-4">
          Elige quién gana cada partido de la fase de grupos: local, empate o
          visitante. Con tu cuenta se guardan automáticamente; sin cuenta, solo
          en este navegador.
        </p>
      </header>
      <PredictionForm matches={GROUP_MATCHES} />
    </div>
  );
}
