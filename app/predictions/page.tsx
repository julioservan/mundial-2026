import { PredictionForm } from "@/components/PredictionForm";
import { GROUP_MATCHES } from "@/lib/data/matches";

export const metadata = {
  title: "Mis predicciones · Mundial 2026",
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
          Predice cada resultado. Se guardan en tu navegador hasta que conectemos
          la cuenta.
        </p>
        <div className="mt-6 bg-surface border border-border rounded-2xl p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl text-accent leading-none">3</span>
            <span className="text-muted-foreground">
              pts si aciertas el <span className="text-foreground font-semibold">resultado exacto</span>
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="font-display text-2xl text-cyan leading-none">1</span>
            <span className="text-muted-foreground">
              pt si solo aciertas el <span className="text-foreground font-semibold">ganador o empate</span>
            </span>
          </div>
        </div>
      </header>
      <PredictionForm matches={GROUP_MATCHES} />
    </div>
  );
}
