import { SimuladorBracket } from "@/components/SimuladorBracket";

export const metadata = {
  title: "Simulador · Mundialistas2026",
};

export default function SimuladorPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <header className="mb-10">
        <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-accent mb-3">
          — Tu cuadro
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
          Simulador de{" "}
          <span className="font-display text-accent">eliminatorias.</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          Elige al ganador de cada cruce y el cuadro avanza solo hasta coronar a
          tu campeón. Guarda tu quiniela y compártela con un enlace.
        </p>
      </header>

      <SimuladorBracket />
    </div>
  );
}
